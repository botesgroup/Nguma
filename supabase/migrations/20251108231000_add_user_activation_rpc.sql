-- This migration adds RPC functions for an admin to activate or deactivate a user account.
-- Deactivation is achieved by setting 'banned_until' to a far-future date.
-- Activation is achieved by setting 'banned_until' to a past date (effectively un-banning).

-- RPC to deactivate a user
CREATE OR REPLACE FUNCTION public.admin_deactivate_user(user_id_to_deactivate uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the caller is an admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Accès non autorisé.');
  END IF;

  -- Use the service_role key to update the auth.users table
  UPDATE auth.users
  SET banned_until = '9999-12-31T23:59:59Z'
  WHERE id = user_id_to_deactivate;

  RETURN jsonb_build_object('success', TRUE, 'message', 'Utilisateur désactivé avec succès.');
END;
$$;

-- RPC to activate a user
CREATE OR REPLACE FUNCTION public.admin_activate_user(user_id_to_activate uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the caller is an admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Accès non autorisé.');
  END IF;

  -- Use the service_role key to update the auth.users table
  UPDATE auth.users
  SET banned_until = '1970-01-01T00:00:00Z'
  WHERE id = user_id_to_activate;

  RETURN jsonb_build_object('success', TRUE, 'message', 'Utilisateur activé avec succès.');
END;
$$;