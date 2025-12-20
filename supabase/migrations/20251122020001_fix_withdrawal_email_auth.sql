-- Fix: Use anon key instead of service_role for email calls
-- The Edge Function will validate requests internally

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
    -- Use anon key (public) - Edge Function will handle internal auth
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NjM1NTIsImV4cCI6MjA0NjAzOTU1Mn0.HuzKb9pWkF_Px7I5cBSTwgPIcgK26ubqnH5yTXyUfEk';
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

    -- Process the withdrawal
    SELECT public.user_withdraw(
        verification_record.amount,
        verification_record.method,
        CASE WHEN verification_record.method = 'crypto' THEN verification_record.payment_details ELSE NULL END,
        CASE WHEN verification_record.method = 'mobile_money' THEN verification_record.payment_details ELSE NULL END
    ) INTO withdrawal_result;

    -- Send withdrawal_pending confirmation email to the user
    SELECT email, first_name, last_name INTO profile_data
    FROM public.profiles
    WHERE id = v_user_id;

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

    -- Clean up old verification codes
    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_withdraw(UUID, TEXT) TO authenticated;
