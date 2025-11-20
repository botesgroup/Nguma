-- Function to get admin dashboard stats
DROP FUNCTION IF EXISTS get_admin_stats();

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users integer;
  active_users integer;
  total_invested numeric;
  total_profits numeric;
BEGIN
  -- Count total users (profiles)
  SELECT count(*) INTO total_users FROM profiles;

  -- Count active users (users with at least one active contract)
  SELECT count(DISTINCT user_id) INTO active_users 
  FROM contracts 
  WHERE status = 'active';

  -- Sum total invested
  SELECT COALESCE(sum(amount), 0) INTO total_invested FROM contracts;

  -- Sum total profits paid
  SELECT COALESCE(sum(total_profit_paid), 0) INTO total_profits FROM contracts;

  RETURN json_build_object(
    'total_investors', total_users,
    'active_investors', active_users,
    'total_invested', total_invested,
    'total_profits', total_profits
  );
END;
$$;

-- Function to get user growth summary by month
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
  GROUP BY 1, date_trunc('month', created_at)
  ORDER BY date_trunc('month', created_at) DESC
  LIMIT 12;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_growth_summary() TO authenticated;
