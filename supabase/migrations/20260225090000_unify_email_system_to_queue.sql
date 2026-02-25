
-- Migration: Unification du Système de Mail via File d'Attente
-- Date: 2026-02-25
-- Description: Supprime tous les appels HTTP directs (fragiles) et harmonise l'envoi vers notifications_queue.

-- 1. Harmonisation de reject_deposit
CREATE OR REPLACE FUNCTION public.reject_deposit(transaction_id_to_reject uuid, reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable.');
    END IF;

    UPDATE public.transactions
    SET status = 'rejected', description = 'Rejeté par admin. Raison: ' || reason, updated_at = now()
    WHERE id = transaction_id_to_reject;

    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;

    -- Notification In-App
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été rejeté. Raison: ' || reason, transaction_id_to_reject, '/transactions', 'transaction', 'high');

    -- File d'attente Email (FIABLE)
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- 2. Harmonisation de approve_withdrawal (Déjà entamée, renforcée ici)
CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID, p_proof_url TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_data RECORD;
    profile_data RECORD;
    v_support_phone TEXT;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    IF p_proof_url IS NULL OR p_proof_url = '' THEN
        RETURN json_build_object('success', false, 'error', 'Preuve obligatoire.');
    END IF;

    SELECT * INTO transaction_data FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending';
    IF transaction_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable.');
    END IF;

    -- Update Transaction & Wallet
    UPDATE public.transactions SET status = 'completed', proof_url = p_proof_url, updated_at = now() WHERE id = transaction_id_to_approve;
    UPDATE public.wallets SET locked_balance = locked_balance - transaction_data.amount, updated_at = now() WHERE user_id = transaction_data.user_id;

    SELECT email, first_name, last_name INTO profile_data FROM public.profiles WHERE id = transaction_data.user_id;
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- File d'attente Email (FIABLE)
    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_approved_with_proof',
            transaction_data.user_id,
            profile_data.email,
            jsonb_build_object(
                'name', COALESCE(profile_data.first_name || ' ' || profile_data.last_name, 'Investisseur'),
                'amount', transaction_data.amount,
                'method', COALESCE(transaction_data.method, 'Virement'),
                'proof_url', p_proof_url,
                'date', to_char(now(), 'DD/MM/YYYY'),
                'support_phone', v_support_phone
            )
        );
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- 3. Harmonisation de reject_withdrawal
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record RECORD;
    user_profile RECORD;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_reject AND status = 'pending';
    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable.');
    END IF;

    -- Return funds
    UPDATE public.wallets 
    SET locked_balance = locked_balance - transaction_record.amount,
        profit_balance = profit_balance + transaction_record.amount,
        updated_at = now()
    WHERE user_id = transaction_record.user_id;

    UPDATE public.transactions SET status = 'rejected', updated_at = now() WHERE id = transaction_id_to_reject;

    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;

    -- File d'attente Email (FIABLE)
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- 4. Attribution des permissions
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
