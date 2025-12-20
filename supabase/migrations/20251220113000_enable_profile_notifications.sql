-- Migration: Enable Email Notifications for Profile Updates
-- Date: 2025-12-20
-- Description: 
-- Updates admin_update_user_profile to send email notification (profile_updated_by_admin)

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    p_user_id UUID,
    p_first_name TEXT,
    p_last_name TEXT,
    p_post_nom TEXT,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_profile RECORD;
    v_updated_fields TEXT := '';
BEGIN
    -- 1. Security: Ensure the caller is an admin
    IF NOT is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Accès non autorisé.');
    END IF;

    -- Get current profile before update to check what changed (optional, simplified here)
    -- or just get email for notification
    SELECT email INTO user_profile FROM public.profiles WHERE id = p_user_id;

    -- 2. Update the profiles table
    UPDATE public.profiles
    SET
        first_name = p_first_name,
        last_name = p_last_name,
        post_nom = p_post_nom,
        phone = p_phone,
        updated_at = now()
    WHERE id = p_user_id;

    -- Construct updated fields string (simplified for now as "Informations personnelles")
    -- Could be more specific by comparing old vs new if needed, but for now generic is fine.
    v_updated_fields := 'Informations personnelles (Nom, Prénom, Téléphone)';

    -- 3. Send Notification to User
    IF user_profile.email IS NOT NULL THEN
        -- Email Notification
        INSERT INTO public.notifications_queue (
            template_id,
            recipient_email,
            notification_params
        ) VALUES (
            'profile_updated_by_admin',
            user_profile.email,
            jsonb_build_object(
                'to', user_profile.email,
                'name', COALESCE(p_first_name || ' ' || p_last_name, 'Utilisateur'),
                'updatedFields', v_updated_fields,
                'date', to_char(now(), 'DD/MM/YYYY HH24:MI')
            )
        );

        -- In-App Notification
        INSERT INTO public.notifications (
            user_id,
            type,
            message,
            link_to,
            priority
        ) VALUES (
            p_user_id,
            'security',
            'Vos informations de profil ont été mises à jour par un administrateur.',
            '/settings',
            'medium'
        );
    END IF;

    -- 4. Return success
    RETURN jsonb_build_object('success', TRUE, 'message', 'Profil utilisateur mis à jour avec succès.');
END;
$$;
