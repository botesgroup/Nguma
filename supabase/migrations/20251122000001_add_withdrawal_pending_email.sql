-- Add withdrawal_pending email notification to verify_and_withdraw function
-- This migration updates the verify_and_withdraw function to send a confirmation email to the user

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
    payload JSONB;
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Get verification record
    SELECT * INTO verification_record
    FROM public.withdrawal_verifications
    WHERE id = p_verification_id
    AND user_id = v_user_id
    AND verified = FALSE
    AND expires_at > now();

    -- Check if verification exists and is valid
    IF verification_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification invalide ou expiré.');
    END IF;

    -- Verify OTP code
    IF verification_record.verification_code != p_otp_code THEN
        RETURN json_build_object('success', false, 'error', 'Code de vérification incorrect.');
    END IF;

    -- Mark verification as used
    UPDATE public.withdrawal_verifications
    SET verified = TRUE
    WHERE id = p_verification_id;

    -- Process the withdrawal using the existing user_withdraw function
    SELECT public.user_withdraw(
        verification_record.amount,
        verification_record.method,
        CASE WHEN verification_record.method = 'crypto' THEN verification_record.payment_details ELSE NULL END,
        CASE WHEN verification_record.method = 'mobile_money' THEN verification_record.payment_details ELSE NULL END
    ) INTO withdrawal_result;

    -- ✅ NEW: Send withdrawal_pending confirmation email to the user
    -- Get user profile for email
    SELECT email, first_name, last_name INTO profile_data
    FROM public.profiles
    WHERE id = v_user_id;

    IF profile_data IS NOT NULL THEN
        payload := jsonb_build_object(
            'template_id', 'withdrawal_pending',
            'to', profile_data.email,
            'name', profile_data.first_name || ' ' || profile_data.last_name,
            'amount', verification_record.amount
        );

        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := payload
        );
    END IF;

    -- Clean up old verification codes
    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_withdraw(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.verify_and_withdraw IS 'Verifies OTP code, processes withdrawal if valid, and sends confirmation email to user';
