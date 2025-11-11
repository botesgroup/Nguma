-- Step 5: Create a function for admins to get pending refunds
-- FIX: Correctly select user's name by concatenating first_name and last_name.
CREATE OR REPLACE FUNCTION public.get_pending_refunds()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  amount NUMERIC,
  currency TEXT,
  start_date TIMESTAMPTZ,
  months_paid INT,
  duration_months INT,
  total_profit_paid NUMERIC,
  email TEXT,
  full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.amount,
    c.currency,
    c.start_date,
    c.months_paid,
    c.duration_months,
    c.total_profit_paid,
    p.email,
    TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) as full_name
  FROM public.contracts c
  JOIN public.profiles p ON c.user_id = p.id
  WHERE c.status = 'pending_refund'
  ORDER BY c.updated_at ASC;
END;
$$;
