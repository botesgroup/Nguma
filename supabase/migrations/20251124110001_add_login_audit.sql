-- Phase 3: Login audit trail
-- Track all login attempts (success and failures) with IP and user agent

CREATE TABLE IF NOT EXISTS public.login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_login_audit_user ON public.login_audit(user_id);
CREATE INDEX idx_login_audit_email ON public.login_audit(email);
CREATE INDEX idx_login_audit_created ON public.login_audit(created_at DESC);
CREATE INDEX idx_login_audit_success ON public.login_audit(success);

-- RLS Policies
ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view login audit logs
CREATE POLICY "Admins can view all login audit logs"
  ON public.login_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Authenticated users can insert their own login attempts (via service)
CREATE POLICY "Service can insert login audit logs"
  ON public.login_audit FOR INSERT
  WITH CHECK (true);

-- Function to log login attempt (called from frontend)
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.login_audit (
    user_id,
    email,
    success,
    ip_address,
    user_agent,
    error_message
  ) VALUES (
    p_user_id,
    p_email,
    p_success,
    p_ip_address,
    p_user_agent,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.log_login_attempt(TEXT, BOOLEAN, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Function to get recent failed login attempts for an email (rate limiting helper)
CREATE OR REPLACE FUNCTION public.get_recent_failed_logins(
  p_email TEXT,
  p_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  attempt_count BIGINT,
  last_attempt TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as attempt_count,
    MAX(created_at) as last_attempt
  FROM public.login_audit
  WHERE email = p_email
    AND success = FALSE
    AND created_at > NOW() - (p_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_recent_failed_logins(TEXT, INTEGER) TO anon, authenticated;

COMMENT ON TABLE public.login_audit IS 'Audit trail of all login attempts (success and failures)';
COMMENT ON FUNCTION public.log_login_attempt IS 'Log a login attempt with IP and user agent';
COMMENT ON FUNCTION public.get_recent_failed_logins IS 'Get count of recent failed login attempts for rate limiting';
