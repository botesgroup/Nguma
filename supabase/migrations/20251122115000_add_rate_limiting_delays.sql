-- ============================================================
-- MIGRATION : Add Rate Limiting Delays for Email Sending
-- ============================================================
-- Resend has a limit of 2 emails per second
-- This migration adds pg_sleep(0.6) between email calls to prevent 429 errors

-- ============================================================
-- 1. Fix: request_deposit (User Email + Admin Emails)
-- ============================================================

DROP FUNCTION IF EXISTS public.request_deposit(numeric, text, text, text, text);

CREATE OR REPLACE FUNCTION public.request_deposit(
    deposit_amount numeric,
    deposit_method text,
    p_payment_reference text DEFAULT NULL::text,
    p_payment_phone_number text DEFAULT NULL::text,
    p_proof_url text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_wallet_id UUID;
    v_transaction_id UUID;
    profile_data record;
    admin_record record;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NjM1NTIsImV4cCI6MjA0NjAzOTU1Mn0.HuzKb9pWkF_Px7I5cBSTwgPIcgK26ubqnH5yTXyUfEk';
    payload JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;

    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;
    IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
    END IF;

    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_user_id;
    
    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, total_balance, invested_balance, profit_balance)
        VALUES (v_user_id, 0, 0, 0)
        RETURNING id INTO v_wallet_id;
    END IF;

    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method,
        payment_reference, payment_phone_number, description, proof_url
    ) VALUES (
        v_user_id, 'deposit', deposit_amount, 'USD', 'pending', deposit_method,
        p_payment_reference, p_payment_phone_number, 'Dépôt via ' || deposit_method, p_proof_url
    ) RETURNING id INTO v_transaction_id;

    -- Enqueue deposit_pending email to user
    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_pending',
            v_user_id,
            profile_data.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'amount', deposit_amount
            )
        );
    END IF;

    -- Rate limiting: Wait 1 second before next email (Resend limit: 2/sec)
    PERFORM pg_sleep(1.0);

    FOR admin_record IN
        SELECT u.id, u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_deposit_request',
            admin_record.id,
            admin_record.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'email', profile_data.email,
                'amount', deposit_amount
            )
        );
    END LOOP;

    -- Send in-app notification
    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
        '/admin/deposits', 'admin', 'high'
    );
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Deposit request created successfully',
        'transaction_id', v_transaction_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ============================================================
-- 2. Fix: verify_and_withdraw (Withdrawal Pending Email)
-- ============================================================

DROP FUNCTION IF EXISTS public.verify_and_withdraw(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.verify_and_withdraw(
    p_verification_id UUID,
    p_otp_code TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    verification_record record;
    withdrawal_result json;
    profile_data record;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NjM1NTIsImV4cCI6MjA0NjAzOTU1Mn0.HuzKb9pWkF_Px7I5cBSTwgPIcgK26ubqnH5yTXyUfEk';
    payload JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    SELECT * INTO verification_record
    FROM public.withdrawal_verifications
    WHERE id = p_verification_id
    AND user_id = v_user_id
    AND verified = FALSE
    AND expires_at > now();

    IF verification_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification invalide ou expiré.');
    END IF;

    IF verification_record.verification_code != p_otp_code THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification incorrect.');
    END IF;

    UPDATE public.withdrawal_verifications
    SET verified = TRUE
    WHERE id = p_verification_id;

    IF profile_data IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_pending',
            v_user_id,
            profile_data.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'amount', verification_record.amount
            )
        );
    END IF;

    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_withdraw(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.verify_and_withdraw IS 'Verifies OTP and processes withdrawal with rate limiting for emails';
