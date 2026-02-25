
-- Migration: Add missing GRANT EXECUTE for admin user management functions
-- Date: 2026-02-25
-- Description: Ensures admin_deactivate_user and admin_activate_user are executable by authenticated users (admins).

GRANT EXECUTE ON FUNCTION public.admin_deactivate_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_user(UUID) TO authenticated;
