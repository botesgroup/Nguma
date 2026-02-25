
-- Migration: Blocage Complet de l'Accès Utilisateur
-- Date: 2026-02-24
-- Description: Met à jour auth.users.banned_until pour bloquer la connexion des utilisateurs désactivés.

-- 1. admin_deactivate_user: Met à jour auth.users.banned_until
CREATE OR REPLACE FUNCTION public.admin_deactivate_user(user_id_to_deactivate UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_data RECORD;
    v_auth_user_email TEXT;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
    END IF;

    -- Obtenir les données du profil pour l'email de notification
    SELECT first_name, last_name, email INTO v_profile_data FROM public.profiles WHERE id = user_id_to_deactivate;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profil utilisateur non trouvé');
    END IF;

    -- Mettre à jour public.profiles (pour les RLS existantes et cohérence)
    UPDATE public.profiles SET banned_until = '9999-12-31'::TIMESTAMPTZ WHERE id = user_id_to_deactivate;

    -- Mettre à jour auth.users.banned_until pour bloquer la connexion
    UPDATE auth.users SET banned_until = '9999-12-31'::TIMESTAMPTZ WHERE id = user_id_to_deactivate RETURNING email INTO v_auth_user_email;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur Auth non trouvé pour la désactivation.');
    END IF;

    -- Mise en file d'attente de l'email de suspension
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES ('account_suspended', user_id_to_deactivate, v_profile_data.email, jsonb_build_object(
        'name', COALESCE(v_profile_data.first_name || ' ' || v_profile_data.last_name, 'Utilisateur'),
        'reason', 'Action administrative'
    ));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. admin_activate_user: Met à jour auth.users.banned_until
CREATE OR REPLACE FUNCTION public.admin_activate_user(user_id_to_activate UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_data RECORD;
    v_auth_user_email TEXT;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
    END IF;

    -- Obtenir les données du profil pour l'email de notification
    SELECT first_name, last_name, email INTO v_profile_data FROM public.profiles WHERE id = user_id_to_activate;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profil utilisateur non trouvé');
    END IF;

    -- Mettre à jour public.profiles (pour les RLS existantes et cohérence)
    UPDATE public.profiles SET banned_until = NULL WHERE id = user_id_to_activate;

    -- Mettre à jour auth.users.banned_until pour réactiver la connexion
    UPDATE auth.users SET banned_until = NULL WHERE id = user_id_to_activate RETURNING email INTO v_auth_user_email;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur Auth non trouvé pour la réactivation.');
    END IF;

    -- Mise en file d'attente de l'email de réactivation
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES ('account_reactivated', user_id_to_activate, v_profile_data.email, jsonb_build_object(
        'name', COALESCE(v_profile_data.first_name || ' ' || v_profile_data.last_name, 'Utilisateur')
    ));

    RETURN jsonb_build_object('success', true);
END;
$$;
