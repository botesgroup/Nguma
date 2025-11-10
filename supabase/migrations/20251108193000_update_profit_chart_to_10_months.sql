-- This migration updates the get_aggregate_profits_by_month function
-- to fetch data for the last 10 months instead of the last 6 months,
-- matching the updated frontend label.

CREATE OR REPLACE FUNCTION public.get_aggregate_profits_by_month()
RETURNS TABLE(month_year TEXT, total_profit NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: Not an admin';
  END IF;

  RETURN QUERY
  WITH months AS (
    -- Generate a series of the last 10 months (current month + 9 previous months)
    SELECT date_trunc('month', generate_series(now() - interval '9 months', now(), '1 month')) as month_start
  ),
  monthly_profits AS (
    -- Calculate profits per month
    SELECT
      date_trunc('month', p.created_at) AS month_start,
      SUM(p.amount) AS monthly_total
    FROM
      public.profits p
    GROUP BY
      1 -- Group by the truncated date
  )
  SELECT
    to_char(m.month_start, 'Mon YYYY') as month_year,
    COALESCE(mp.monthly_total, 0) AS total_profit
  FROM
    months m
  LEFT JOIN
    monthly_profits mp ON m.month_start = mp.month_start
  ORDER BY
    m.month_start ASC;
END;
$$;
