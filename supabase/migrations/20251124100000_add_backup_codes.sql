-- Add backup codes table for 2FA recovery
-- Users can use these codes if they lose access to their authenticator app

CREATE TABLE IF NOT EXISTS public.backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON public.backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_code ON public.backup_codes(code) WHERE used_at IS NULL;

-- RLS Policies
ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own backup codes
DROP POLICY IF EXISTS "Users can view their own backup codes" ON public.backup_codes;
CREATE POLICY "Users can view their own backup codes"
  ON public.backup_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own backup codes (generated during 2FA setup)
DROP POLICY IF EXISTS "Users can insert their own backup codes" ON public.backup_codes;
CREATE POLICY "Users can insert their own backup codes"
  ON public.backup_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own backup codes (mark as used)
DROP POLICY IF EXISTS "Users can update their own backup codes" ON public.backup_codes;
CREATE POLICY "Users can update their own backup codes"
  ON public.backup_codes FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to verify and use a backup code
CREATE OR REPLACE FUNCTION public.verify_backup_code(
  p_code TEXT
)
RETURNS TABLE (
  valid BOOLEAN,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code_record RECORD;
BEGIN
  -- Check if code exists and is unused
  SELECT * INTO v_code_record
  FROM public.backup_codes
  WHERE code = p_code
    AND user_id = v_user_id
    AND used_at IS NULL;

  IF v_code_record.id IS NOT NULL THEN
    -- Mark code as used
    UPDATE public.backup_codes
    SET used_at = NOW()
    WHERE id = v_code_record.id;

    RETURN QUERY SELECT true AS valid, v_user_id AS user_id;
  ELSE
    RETURN QUERY SELECT false AS valid, NULL::UUID AS user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_backup_code(TEXT) TO authenticated;

COMMENT ON TABLE public.backup_codes IS 'Backup codes for 2FA recovery (10 codes per user)';
COMMENT ON FUNCTION public.verify_backup_code IS 'Verify and mark a backup code as used';
