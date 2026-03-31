-- Table to store password reset OTPs
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    used BOOLEAN DEFAULT FALSE
);

-- Index for faster cleanup and lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON public.password_reset_otps(expires_at);

-- Function to request a password reset OTP
CREATE OR REPLACE FUNCTION public.request_password_reset_otp(p_email TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp_code TEXT;
    v_user_uuid UUID;
    v_first_name TEXT;
    v_last_name TEXT;
    v_recent_requests INTEGER;
BEGIN
    -- Check if user exists
    SELECT id, first_name, last_name INTO v_user_uuid, v_first_name, v_last_name
    FROM public.profiles
    WHERE email = p_email;

    -- If user doesn't exist, we still return success to prevent email enumeration
    -- but we don't send anything.
    IF v_user_uuid IS NULL THEN
        RETURN json_build_object('success', true, 'message', 'Si cet email correspond à un compte, un code a été envoyé.');
    END IF;

    -- Rate limiting: Max 3 requests per 15 minutes for this email
    SELECT COUNT(*) INTO v_recent_requests
    FROM public.password_reset_otps
    WHERE email = p_email
    AND created_at > now() - INTERVAL '15 minutes';

    IF v_recent_requests >= 3 THEN
        RETURN json_build_object('success', false, 'error', 'Trop de demandes. Veuillez patienter avant de réessayer.');
    END IF;

    -- Generate 6-digit OTP code
    v_otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Store OTP
    INSERT INTO public.password_reset_otps (email, otp_code, expires_at)
    VALUES (p_email, v_otp_code, now() + INTERVAL '15 minutes');

    -- Add to notification queue
    INSERT INTO public.notifications_queue (
        template_id, 
        recipient_user_id, 
        recipient_email, 
        notification_params,
        priority
    )
    VALUES (
        'password_reset_otp',
        v_user_uuid,
        p_email,
        jsonb_build_object(
            'name', COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, ''),
            'otp_code', v_otp_code
        ),
        'high'
    );

    RETURN json_build_object('success', true, 'message', 'Code de vérification envoyé par email.');
END;
$$;

-- Function for the Edge Function to verify OTP internally
CREATE OR REPLACE FUNCTION public.verify_password_reset_otp_internal(p_email TEXT, p_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id UUID;
BEGIN
    SELECT id INTO v_record_id
    FROM public.password_reset_otps
    WHERE email = p_email
    AND otp_code = p_code
    AND used = FALSE
    AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_record_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Code invalide ou expiré.');
    END IF;

    -- Mark as used
    UPDATE public.password_reset_otps
    SET used = TRUE
    WHERE id = v_record_id;

    RETURN json_build_object('success', true);
END;
$$;

-- Grant permissions
GRANT ALL ON public.password_reset_otps TO postgres, service_role;
GRANT SELECT ON public.password_reset_otps TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_password_reset_otp(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password_reset_otp_internal(TEXT, TEXT) TO service_role;
