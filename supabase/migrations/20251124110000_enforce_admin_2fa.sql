-- Phase 2: Make 2FA mandatory for admin users
-- Add columns to track 2FA setup requirement

-- Add columns to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS must_setup_2fa BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS setup_2fa_deadline TIMESTAMPTZ;

-- Mark existing admins without 2FA as requiring setup (7 days deadline)
UPDATE public.user_roles 
SET 
  must_setup_2fa = TRUE,
  setup_2fa_deadline = NOW() + INTERVAL '7 days'
WHERE role = 'admin' 
  AND user_id NOT IN (
    SELECT user_id 
    FROM auth.mfa_factors 
    WHERE status = 'verified'
  );

-- Trigger function to automatically flag new admins for 2FA setup
CREATE OR REPLACE FUNCTION public.enforce_admin_2fa()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being set to admin, require 2FA setup
  IF NEW.role = 'admin' THEN
    NEW.must_setup_2fa := TRUE;
    NEW.setup_2fa_deadline := NOW() + INTERVAL '7 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new admin assignments
DROP TRIGGER IF EXISTS enforce_admin_2fa_trigger ON public.user_roles;
CREATE TRIGGER enforce_admin_2fa_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_2fa();

-- Function to check if user has verified 2FA
CREATE OR REPLACE FUNCTION public.user_has_verified_2fa(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.mfa_factors 
    WHERE user_id = p_user_id 
      AND status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.user_has_verified_2fa(UUID) TO authenticated;

-- Function to clear 2FA requirement after successful setup
CREATE OR REPLACE FUNCTION public.clear_2fa_requirement(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_roles
  SET must_setup_2fa = FALSE,
      setup_2fa_deadline = NULL
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.clear_2fa_requirement(UUID) TO authenticated;

COMMENT ON COLUMN public.user_roles.must_setup_2fa IS 'Whether user must setup 2FA (auto-set for admins)';
COMMENT ON COLUMN public.user_roles.setup_2fa_deadline IS 'Deadline to setup 2FA (typically 7 days)';
COMMENT ON FUNCTION public.enforce_admin_2fa IS 'Automatically flag new admins for mandatory 2FA setup';
COMMENT ON FUNCTION public.user_has_verified_2fa IS 'Check if user has verified 2FA enabled';
