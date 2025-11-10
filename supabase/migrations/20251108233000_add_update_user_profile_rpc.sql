-- This migration adds an RPC function for an admin to update a user's profile information.

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
BEGIN
    -- 1. Security: Ensure the caller is an admin
    IF NOT is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Accès non autorisé.');
    END IF;

    -- 2. Update the profiles table
    UPDATE public.profiles
    SET
        first_name = p_first_name,
        last_name = p_last_name,
        post_nom = p_post_nom,
        phone = p_phone,
        updated_at = now()
    WHERE id = p_user_id;

    -- 3. Return success
    RETURN jsonb_build_object('success', TRUE, 'message', 'Profil utilisateur mis à jour avec succès.');
END;
$$;
