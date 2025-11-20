-- Fix field names in get_admin_stats to match frontend expectations

DROP FUNCTION IF EXISTS get_admin_stats();

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_users integer;
  active_users integer;
  funds_managed numeric;
  profits_paid numeric;
  pending_deposit_amount numeric;
  pending_withdrawal_amount numeric;
BEGIN
  -- Count total users (profiles)
  SELECT count(*) INTO total_users FROM profiles;

  -- Count active users (users with at least one active contract)
  SELECT count(DISTINCT user_id) INTO active_users 
  FROM contracts 
  WHERE status = 'active';

  -- Sum funds under management (all active contracts)
  SELECT COALESCE(sum(amount), 0) INTO funds_managed 
  FROM contracts 
  WHERE status = 'active';

  -- Sum total profits paid across all contracts
  SELECT COALESCE(sum(total_profit_paid), 0) INTO profits_paid FROM contracts;

  -- Sum pending deposits
  SELECT COALESCE(sum(amount), 0) INTO pending_deposit_amount
  FROM transactions
  WHERE type = 'deposit' AND status = 'pending';

  -- Sum pending withdrawals
  SELECT COALESCE(sum(amount), 0) INTO pending_withdrawal_amount
  FROM transactions
  WHERE type = 'withdrawal' AND status = 'pending';

  RETURN json_build_object(
    'total_investors', total_users,
    'active_investors', active_users,
    'funds_under_management', funds_managed,
    'total_profit', profits_paid,
    'pending_deposits', pending_deposit_amount,
    'pending_withdrawals', pending_withdrawal_amount
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated;
