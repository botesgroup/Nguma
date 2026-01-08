-- Update request_withdrawal_otp function to allow admin OTP bypass

DROP FUNCTION IF EXISTS public.request_withdrawal_otp(NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.request_withdrawal_otp(
    p_amount NUMERIC,
    p_method TEXT,
    p_payment_details JSONB
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_otp_code TEXT;
    v_verification_id UUID;
    v_profit_balance NUMERIC(20,8);
    v_min_withdrawal NUMERIC(20,8);
    v_max_withdrawal NUMERIC(20,8);
    profile_data record;
    v_recent_requests INTEGER;
    v_otp_enabled_setting TEXT; -- New variable for the setting
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Rate limiting: Max 3 OTP requests per hour
    SELECT COUNT(*) INTO v_recent_requests
    FROM public.withdrawal_verifications
    WHERE user_id = v_user_id
    AND created_at > now() - INTERVAL '1 hour';

    IF v_recent_requests >= 3 THEN
        RETURN json_build_object('success', false, 'error', 'Trop de demandes de code. Veuillez patienter avant de réessayer.');
    END IF;

    -- Load withdrawal settings
    SELECT value::NUMERIC INTO v_min_withdrawal FROM public.settings WHERE key = 'min_withdrawal_amount';
    SELECT value::NUMERIC INTO v_max_withdrawal FROM public.settings WHERE key = 'max_withdrawal_amount';
    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);

    -- Validate amount
    IF p_amount < v_min_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum de retrait est de ' || v_min_withdrawal || ' USD.');
    END IF;

    IF p_amount > v_max_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant maximum de retrait est de ' || v_max_withdrawal || ' USD.');
    END IF;

    -- Check profit balance
    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_profit_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found.');
    END IF;

    IF v_profit_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant.');
    END IF;

    -- Get OTP enabled setting
    SELECT value INTO v_otp_enabled_setting FROM public.settings WHERE key = 'withdrawal_otp_enabled';
    v_otp_enabled_setting := COALESCE(v_otp_enabled_setting, 'true'); -- Default to true if setting is missing

    -- Get user profile
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    IF v_otp_enabled_setting = 'true' THEN
        -- Generate 6-digit OTP code
        v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

        -- Store verification code (not verified yet)
        INSERT INTO public.withdrawal_verifications (
            user_id,
            verification_code,
            amount,
            method,
            payment_details,
            verified
        )
        VALUES (
            v_user_id,
            v_otp_code,
            p_amount,
            p_method,
            p_payment_details,
            FALSE
        )
        RETURNING id INTO v_verification_id;

        -- Enqueue the OTP email
        IF profile_data.email IS NOT NULL THEN
            INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
            VALUES (
                'withdrawal_otp',
                v_user_id,
                profile_data.email,
                jsonb_build_object(
                    'name', profile_data.first_name || ' ' || profile_data.last_name,
                    'otp_code', v_otp_code,
                    'amount', p_amount
                )
            );
        END IF;

        RETURN json_build_object(
            'success', true, 
            'verification_id', v_verification_id,
            'message', 'Code de vérification envoyé par email.'
        );
    ELSE
        -- OTP is disabled, bypass verification
        v_otp_code := 'BYPASSED_ADMIN'; -- Special code to indicate bypass

        -- Store verification code (marked as verified immediately)
        INSERT INTO public.withdrawal_verifications (
            user_id,
            verification_code,
            amount,
            method,
            payment_details,
            verified
        )
        VALUES (
            v_user_id,
            v_otp_code,
            p_amount,
            p_method,
            p_payment_details,
            TRUE -- Mark as verified directly
        )
        RETURNING id INTO v_verification_id;

        RETURN json_build_object(
            'success', true, 
            'verification_id', v_verification_id,
            'message', 'OTP verification bypassed by admin setting.'
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal_otp(NUMERIC, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.request_withdrawal_otp(NUMERIC, TEXT, JSONB) IS 'Generates and sends OTP code for withdrawal verification, with admin bypass option.';