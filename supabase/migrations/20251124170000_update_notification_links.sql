-- Migration pour mettre à jour les liens de notification de /wallet vers /transactions
-- Cette migration met à jour les fonctions RPC et les notifications existantes

-- 1. Mettre à jour les notifications existantes
UPDATE public.notifications
SET link_to = '/transactions'
WHERE link_to = '/wallet';

-- 2. Mettre à jour approve_deposit
DROP FUNCTION IF EXISTS public.approve_deposit(uuid);
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

    -- ✅ MARK RELATED ADMIN NOTIFICATIONS AS READ
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_approve;

    -- Create an in-app notification for the user (UPDATED LINK)
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id, 
        'Votre dépôt de ' || transaction_record.amount || ' ' || transaction_record.currency || ' a été approuvé.',
        transaction_id_to_approve,
        '/transactions', -- CHANGED FROM /wallet
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

-- 3. Mettre à jour reject_deposit
DROP FUNCTION IF EXISTS public.reject_deposit(uuid, text);
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

    -- ✅ MARK RELATED ADMIN NOTIFICATIONS AS READ
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_reject;

    -- UPDATED LINK
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id,
        'Votre dépôt de ' || transaction_record.amount || ' ' || transaction_record.currency || ' a été rejeté. Raison: ' || reason,
        transaction_id_to_reject,
        '/transactions', -- CHANGED FROM /wallet
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

-- 4. Mettre à jour approve_withdrawal
DROP FUNCTION IF EXISTS public.approve_withdrawal(uuid);
CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve uuid)
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
    WHERE id = transaction_id_to_approve AND type = 'withdrawal' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de retrait en attente non trouvée ou déjà traitée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    -- Update transaction status
    UPDATE public.transactions
    SET status = 'completed',
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- ✅ MARK RELATED ADMIN NOTIFICATIONS AS READ
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_approve;

    -- UPDATED LINK
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id, 
        'Votre retrait de ' || transaction_record.amount || ' ' || transaction_record.currency || ' a été approuvé.',
        transaction_id_to_approve,
        '/transactions', -- CHANGED FROM /wallet
        'transaction',
        'medium'
    );

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_approved',
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

-- 5. Mettre à jour reject_withdrawal
DROP FUNCTION IF EXISTS public.reject_withdrawal(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject uuid, reason text)
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
    WHERE id = transaction_id_to_reject AND type = 'withdrawal' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de retrait en attente non trouvée ou déjà traitée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    -- Refund the amount to the user's wallet
    UPDATE public.wallets
    SET total_balance = total_balance + transaction_record.amount,
        updated_at = now()
    WHERE user_id = transaction_record.user_id;

    -- Update transaction status
    UPDATE public.transactions
    SET status = 'rejected',
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    -- ✅ MARK RELATED ADMIN NOTIFICATIONS AS READ
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_reject;

    -- UPDATED LINK
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id,
        'Votre retrait a été rejeté. Raison: ' || reason,
        transaction_id_to_reject,
        '/transactions', -- CHANGED FROM /wallet
        'transaction',
        'high'
    );

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_rejected',
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
