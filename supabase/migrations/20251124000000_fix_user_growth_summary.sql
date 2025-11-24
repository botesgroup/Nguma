-- Fix get_user_growth_summary function
-- Problem: The function uses profiles.created_at which exists but the GROUP BY and ORDER BY clauses
-- need to reference the same expression consistently

DROP FUNCTION IF EXISTS get_user_growth_summary();

CREATE OR REPLACE FUNCTION get_user_growth_summary()
RETURNS TABLE (
  month_year text,
  new_users_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(created_at, 'Mon YYYY') as month_year,
    count(*) as new_users_count
  FROM profiles
  WHERE created_at IS NOT NULL
  GROUP BY to_char(created_at, 'Mon YYYY'), date_trunc('month', created_at)
  ORDER BY date_trunc('month', created_at) DESC
  LIMIT 12;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_growth_summary() TO authenticated;
