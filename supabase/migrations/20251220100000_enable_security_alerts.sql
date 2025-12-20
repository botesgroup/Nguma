-- Migration: Enable Security Alerts for Suspicious Logins
-- Date: 2025-12-20
-- Description: 
-- 1. Creates a trigger function to detect logins from new IP addresses.
-- 2. Sends a 'security_alert' email notification when a new IP is detected.

CREATE OR REPLACE FUNCTION public.check_suspicious_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    previous_ip_count INTEGER;
    user_profile RECORD;
    v_support_phone TEXT;
BEGIN
    -- Only check successful logins with an IP address
    IF NEW.success = true AND NEW.ip_address IS NOT NULL THEN
        
        -- Check if this IP has been used by this user BEFORE this login
        -- We exclude the current record (NEW.id) just in case, though usually triggers fire after insert visibility depending on isolation
        SELECT COUNT(*)
        INTO previous_ip_count
        FROM public.login_audit
        WHERE user_id = NEW.user_id
        AND ip_address = NEW.ip_address
        AND success = true
        AND id != NEW.id;

        -- If this is the FIRST time seeing this IP (count = 0)
        IF previous_ip_count = 0 THEN
            
            -- Get user profile for name and email
            SELECT email, first_name, last_name, COALESCE(first_name || ' ' || last_name, email) as full_name
            INTO user_profile
            FROM public.profiles
            WHERE id = NEW.user_id;

            IF user_profile.email IS NOT NULL THEN
                
                -- Send Email Notification via Queue
                INSERT INTO public.notifications_queue (
                    template_id,
                    recipient_email,
                    recipient_user_id,
                    notification_params
                ) VALUES (
                    'security_alert',
                    user_profile.email,
                    NEW.user_id,
                    jsonb_build_object(
                        'to', user_profile.email,
                        'name', user_profile.full_name,
                        'activityType', 'Connexion depuis un nouvel appareil',
                        'ipAddress', NEW.ip_address,
                        'date', to_char(NEW.created_at, 'DD/MM/YYYY HH24:MI')
                    )
                );

                -- Send In-App Notification
                INSERT INTO public.notifications (
                    user_id,
                    type,
                    message,
                    link_to,
                    priority
                ) VALUES (
                    NEW.user_id,
                    'security',
                    'Alerte : Connexion détectée depuis un nouvel appareil/IP (' || NEW.ip_address || ').',
                    '/settings',
                    'high'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists to ensure clean slate
DROP TRIGGER IF EXISTS on_suspicious_login ON public.login_audit;

-- Create Trigger
CREATE TRIGGER on_suspicious_login
AFTER INSERT ON public.login_audit
FOR EACH ROW
EXECUTE FUNCTION public.check_suspicious_login();

COMMENT ON FUNCTION public.check_suspicious_login IS 'Detects new IP logins and sends security alerts';
