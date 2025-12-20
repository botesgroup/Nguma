-- Fix: Auto-mark admin notifications as read when actions are processed
-- This ensures that notifications for pending actions (deposits, withdrawals, refunds)
-- are automatically marked as read when an admin approves or rejects them

-- IMPORTANT: This migration adds "UPDATE public.notifications SET is_read = true WHERE reference_id = ..."
-- to all approve/reject functions to automatically mark admin notifications as processed

-- =====================================================================
-- 1. Fix approve_deposit to mark related admin notifications as read
-- =====================================================================
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    wallet_updated_count INTEGER;
    transaction_updated_count INTEGER;
BEGIN
    -- Check if the user is an admin
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent approuver les dépôts.');
    END IF;

    -- Get the transaction details
    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_approve AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée ou déjà traitée.');
    END IF;

    -- Get user profile for email details
    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    -- Update the user's wallet
    UPDATE public.wallets
    SET total_balance = total_balance + transaction_record.amount,
        updated_at = now()
    WHERE user_id = transaction_record.user_id;
    
    GET DIAGNOSTICS wallet_updated_count = ROW_COUNT;

    -- If no wallet was updated, it means the user doesn't have a wallet. Create one.
    IF wallet_updated_count = 0 THEN
        INSERT INTO public.wallets (user_id, total_balance)
        VALUES (transaction_record.user_id, transaction_record.amount);
    END IF;

    -- Update the transaction status
    UPDATE public.transactions
    SET status = 'completed',
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    GET DIAGNOSTICS transaction_updated_count = ROW_COUNT;

    IF transaction_updated_count = 0 THEN
        RAISE EXCEPTION 'Impossible de mettre à jour le statut de la transaction.';
    END IF;

    -- ✅ MARK RELATED ADMIN NOTIFICATIONS AS READ (AUTO-FIX!)
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_approve;

    -- Create an in-app notification for the user
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id, 
        'Votre dépôt de ' || transaction_record.amount || ' ' || transaction_record.currency || ' a été approuvé.',
        transaction_id_to_approve,
        '/wallet',
        'transaction',
        'medium'
    );

    -- Enqueue email to the user
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_approved',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'amount', transaction_record.amount
            )
        );
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.approve_deposit(uuid) IS 
'Approves a pending deposit, updates wallet, marks related admin notifications as read, sends user notification and email';


-- =====================================================================
-- 2. Fix reject_deposit to mark related admin notifications as read
-- =====================================================================
-- NOTE: Cette fonction existe déjà dans les migrations précédentes mais nous la mettons à jour
-- pour s'assurer qu'elle marque bien les notifications comme lues
CREATE OR REPLACE FUNCTION public.reject_deposit(transaction_id_to_reject uuid, reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée ou déjà traitée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    UPDATE public.transactions
    SET status = 'rejected',
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    -- ✅ MARK RELATED ADMIN NOTIFICATIONS AS READ (AUTO-FIX!)
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_reject;

    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id,
        'Votre dépôt de ' || transaction_record.amount || ' ' || transaction_record.currency || ' a été rejeté. Raison: ' || reason,
        transaction_id_to_reject,
        '/wallet',
        'transaction',
        'high'
    );

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.reject_deposit(uuid, text) IS 
'Rejects a pending deposit, marks related admin notifications as read, sends user notification and email';


-- ===================================================================
-- NOTES FOR OTHER FUNCTIONS:
-- ===================================================================
-- Les fonctions approve_withdrawal, reject_withdrawal, approve_refund, reject_refund
-- ont déjà été mises à jour dans les migrations précédentes: reference_id = ...
-- pour marquer les notifications comme lues.
-- 
-- Vérifiez les migrations suivantes pour confirmation :
-- - 20251101110000_update_notifications_logic.sql
-- - 20251120123908_fix_approve_withdrawal_notification_type.sql
-- - 20251117130807_update_reject_withdrawal_to_email_user.sql
-- - 20251111113124_add_refund_approval_flow.sql
--
-- Cette migration se concentre sur approve_deposit et reject_deposit qui n'avaient
-- pas encore cette fonctionnalité.
