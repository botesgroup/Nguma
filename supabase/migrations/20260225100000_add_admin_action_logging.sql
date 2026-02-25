
-- Migration: Admin Action Logging System
-- Date: 2026-02-25
-- Description: Adds automatic email logging for all administrative actions to all registered admins.

-- 1. Helper function to notify all admins via email queue
CREATE OR REPLACE FUNCTION public.log_admin_action_to_emails(
    p_action_type TEXT,
    p_target_user_id UUID,
    p_amount NUMERIC DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_record RECORD;
    v_admin_performer_name TEXT;
    v_target_user_name TEXT;
BEGIN
    -- 1. Récupérer le nom de l'admin qui fait l'action
    SELECT COALESCE(first_name || ' ' || last_name, 'Un administrateur') INTO v_admin_performer_name 
    FROM public.profiles WHERE id = auth.uid();

    -- 2. Récupérer le nom de l'utilisateur cible
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO v_target_user_name 
    FROM public.profiles WHERE id = p_target_user_id;

    -- 3. Envoyer un email à TOUS les admins
    FOR v_admin_record IN 
        SELECT p.email, p.id 
        FROM public.profiles p
        JOIN public.user_roles ur ON p.id = ur.user_id
        WHERE ur.role = 'admin' AND p.email IS NOT NULL
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'admin_action_log',
            v_admin_record.id,
            v_admin_record.email,
            jsonb_build_object(
                'adminName', v_admin_performer_name,
                'actionType', p_action_type,
                'targetUserName', v_target_user_name,
                'amount', p_amount,
                'reason', p_reason
            )
        );
    END LOOP;
END;
$$;

-- 2. Mettre à jour approve_deposit pour inclure le log
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    v_support_phone TEXT;
BEGIN
    -- [LOGIQUE EXISTANTE D'APPROBATION...]
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN RETURN json_build_object('success', false, 'error', 'Accès refusé.'); END IF;

    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending';
    IF transaction_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Transaction introuvable.'); END IF;

    -- Actions
    UPDATE public.wallets SET total_balance = total_balance + transaction_record.amount WHERE user_id = transaction_record.user_id;
    UPDATE public.transactions SET status = 'completed', updated_at = now() WHERE id = transaction_id_to_approve;

    -- Notification Utilisateur
    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('deposit_approved', transaction_record.user_id, user_profile.email, jsonb_build_object(
            'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
            'amount', transaction_record.amount,
            'support_phone', v_support_phone
        ));
    END IF;

    -- LOG ADMIN (NOUVEAU)
    PERFORM public.log_admin_action_to_emails('Approbation de Dépôt', transaction_record.user_id, transaction_record.amount, 'Validation manuelle');

    RETURN json_build_object('success', true);
END;
$$;

-- 3. Mettre à jour reject_deposit pour inclure le log
CREATE OR REPLACE FUNCTION public.reject_deposit(transaction_id_to_reject uuid, reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record record;
    user_profile record;
BEGIN
    -- [LOGIQUE EXISTANTE DE REJET...]
    IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN json_build_object('success', false, 'error', 'Accès refusé.'); END IF;

    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_reject AND status = 'pending';
    IF transaction_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Transaction introuvable.'); END IF;

    UPDATE public.transactions SET status = 'rejected', description = reason, updated_at = now() WHERE id = transaction_id_to_reject;
    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('deposit_rejected', transaction_record.user_id, user_profile.email, jsonb_build_object(
            'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
            'amount', transaction_record.amount,
            'reason', reason
        ));
    END IF;

    -- LOG ADMIN (NOUVEAU)
    PERFORM public.log_admin_action_to_emails('Rejet de Dépôt', transaction_record.user_id, transaction_record.amount, reason);

    RETURN json_build_object('success', true);
END;
$$;

-- 4. Mettre à jour approve_withdrawal pour inclure le log
CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID, p_proof_url TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_data RECORD;
    profile_data RECORD;
BEGIN
    -- [LOGIQUE EXISTANTE D'APPROBATION RETRAIT...]
    IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN json_build_object('success', false, 'error', 'Accès refusé.'); END IF;

    SELECT * INTO transaction_data FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending';
    IF transaction_data IS NULL THEN RETURN json_build_object('success', false, 'error', 'Transaction introuvable.'); END IF;

    UPDATE public.transactions SET status = 'completed', proof_url = p_proof_url, updated_at = now() WHERE id = transaction_id_to_approve;
    UPDATE public.wallets SET locked_balance = locked_balance - transaction_data.amount, updated_at = now() WHERE user_id = transaction_data.user_id;

    SELECT email, first_name, last_name INTO profile_data FROM public.profiles WHERE id = transaction_data.user_id;

    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('withdrawal_approved_with_proof', transaction_data.user_id, profile_data.email, jsonb_build_object(
            'name', COALESCE(profile_data.first_name || ' ' || profile_data.last_name, 'Investisseur'),
            'amount', transaction_data.amount,
            'proof_url', p_proof_url
        ));
    END IF;

    -- LOG ADMIN (NOUVEAU)
    PERFORM public.log_admin_action_to_emails('Approbation de Retrait', transaction_data.user_id, transaction_data.amount, 'Transfert effectué avec preuve');

    RETURN json_build_object('success', true);
END;
$$;

-- 5. Mettre à jour reject_withdrawal pour inclure le log
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record RECORD;
    user_profile RECORD;
BEGIN
    -- [LOGIQUE EXISTANTE DE REJET RETRAIT...]
    IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN json_build_object('success', false, 'error', 'Accès refusé.'); END IF;

    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_reject AND status = 'pending';
    IF transaction_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Transaction introuvable.'); END IF;

    UPDATE public.wallets SET locked_balance = locked_balance - transaction_record.amount, profit_balance = profit_balance + transaction_record.amount, updated_at = now() WHERE user_id = transaction_record.user_id;
    UPDATE public.transactions SET status = 'rejected', updated_at = now() WHERE id = transaction_id_to_reject;

    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES ('withdrawal_rejected', transaction_record.user_id, user_profile.email, jsonb_build_object(
            'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
            'amount', transaction_record.amount,
            'reason', reason
        ));
    END IF;

    -- LOG ADMIN (NOUVEAU)
    PERFORM public.log_admin_action_to_emails('Rejet de Retrait', transaction_record.user_id, transaction_record.amount, reason);

    RETURN json_build_object('success', true);
END;
$$;
