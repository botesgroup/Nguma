-- ============================================================
-- MIGRATION 2/2 : Fix verify_and_withdraw Authorization Header
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

    SELECT public.user_withdraw(
        verification_record.amount,
        verification_record.method,
        CASE WHEN verification_record.method = 'crypto' THEN verification_record.payment_details ELSE NULL END,
        CASE WHEN verification_record.method = 'mobile_money' THEN verification_record.payment_details ELSE NULL END
    ) INTO withdrawal_result;

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
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', anon_key,
                'Authorization', 'Bearer ' || anon_key
            ),
            body := payload
        );
    END IF;

    PERFORM public.cleanup_expired_withdrawal_verifications();

    RETURN withdrawal_result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_withdraw(UUID, TEXT) TO authenticated;
