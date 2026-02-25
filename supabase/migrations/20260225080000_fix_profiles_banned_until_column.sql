
-- Migration: Fix Missing Column and Access Control
-- Date: 2026-02-25
-- Description: Adds banned_until to public.profiles and fixes admin functions.

-- 1. Ajouter la colonne manquante à public.profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='banned_until') THEN
        ALTER TABLE public.profiles ADD COLUMN banned_until TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- 2. Recréer admin_deactivate_user avec une gestion robuste
CREATE OR REPLACE FUNCTION public.admin_deactivate_user(user_id_to_deactivate UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_data RECORD;
    v_auth_user_email TEXT;
BEGIN
    -- Check Admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
    END IF;

    -- Update profiles (important for UI and RLS)
    UPDATE public.profiles 
    SET banned_until = '9999-12-31'::TIMESTAMPTZ 
    WHERE id = user_id_to_deactivate 
    RETURNING email, first_name, last_name INTO v_profile_data;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profil introuvable');
    END IF;

    -- Update auth.users (THIS BLOCKS LOGIN COMPLETELY)
    UPDATE auth.users 
    SET banned_until = '9999-12-31'::TIMESTAMPTZ 
    WHERE id = user_id_to_deactivate;

    -- Enqueue Notification
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES ('account_suspended', user_id_to_deactivate, v_profile_data.email, jsonb_build_object(
        'name', COALESCE(v_profile_data.first_name || ' ' || v_profile_data.last_name, 'Utilisateur'),
        'reason', 'Violation des règles et conditions'
    ));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Recréer admin_activate_user
CREATE OR REPLACE FUNCTION public.admin_activate_user(user_id_to_activate UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_data RECORD;
BEGIN
    -- Check Admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
    END IF;

    -- Update profiles
    UPDATE public.profiles 
    SET banned_until = NULL 
    WHERE id = user_id_to_activate 
    RETURNING email INTO v_profile_data;

    -- Update auth.users (RESTORES LOGIN ACCESS)
    UPDATE auth.users 
    SET banned_until = NULL 
    WHERE id = user_id_to_activate;

    -- Enqueue Notification
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES ('account_reactivated', user_id_to_activate, v_profile_data.email, jsonb_build_object(
        'name', 'Utilisateur'
    ));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Redonner les permissions
GRANT EXECUTE ON FUNCTION public.admin_deactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_user(UUID) TO authenticated;
