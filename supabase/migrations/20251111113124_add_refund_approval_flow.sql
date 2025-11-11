-- Step 1: The 'status' column is TEXT, so no type alteration is needed.

-- Step 2: Create the new user-facing function to request a refund.
CREATE OR REPLACE FUNCTION public.request_refund(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  current_user_id UUID := auth.uid();
BEGIN
  -- Find the active contract for the current user
  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND user_id = current_user_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not active.');
  END IF;

  -- Check business logic: refund only possible within the first 5 months
  IF contract_record.months_paid >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Early refund is only possible within the first 5 months.');
  END IF;

  -- Update contract status to 'pending_refund'
  UPDATE public.contracts SET status = 'pending_refund' WHERE id = _contract_id;

  -- Notify admins
  PERFORM public.notify_all_admins('Nouvelle demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8), '/admin/refunds');

  RETURN jsonb_build_object('success', true, 'message', 'Your refund request has been submitted for approval.');
END;
$$;


-- Step 3: Create the admin function to approve a refund.
-- This contains the logic from the old 'execute_refund' function.
CREATE OR REPLACE FUNCTION public.approve_refund(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  refund_amount NUMERIC(20,8);
BEGIN
  -- Ensure caller is an admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
  END IF;

  -- Find the contract pending refund
  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND status = 'pending_refund';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not pending refund.');
  END IF;

  -- Calculate refund amount
  refund_amount := contract_record.amount - contract_record.total_profit_paid;
  IF refund_amount < 0 THEN refund_amount := 0; END IF;

  -- Update user's wallet
  UPDATE public.wallets 
  SET 
    total_balance = total_balance + refund_amount, 
    invested_balance = invested_balance - contract_record.amount 
  WHERE user_id = contract_record.user_id;

  -- Create the transaction record
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description, status)
  VALUES (contract_record.user_id, 'refund', refund_amount, contract_record.currency, _contract_id, 'Early refund from contract', 'completed');

  -- Update contract status to 'refunded'
  UPDATE public.contracts SET status = 'refunded' WHERE id = _contract_id;

  -- Notify user
  INSERT INTO public.notifications(user_id, message, link_to)
  VALUES (contract_record.user_id, 'Votre demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8) || ' a été approuvée.', '/contracts');

  RETURN jsonb_build_object('success', true, 'message', 'Refund approved successfully.');
END;
$$;


-- Step 4: Create the admin function to reject a refund.
CREATE OR REPLACE FUNCTION public.reject_refund(_contract_id UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
BEGIN
  -- Ensure caller is an admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
  END IF;

  -- Find the contract pending refund
  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND status = 'pending_refund';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not pending refund.');
  END IF;

  -- Revert status to 'active'
  UPDATE public.contracts SET status = 'active' WHERE id = _contract_id;

  -- Notify user
  INSERT INTO public.notifications(user_id, message, link_to)
  VALUES (contract_record.user_id, 'Votre demande de remboursement a été rejetée. Raison: ' || reason, '/contracts');

  RETURN jsonb_build_object('success', true, 'message', 'Refund request rejected.');
END;
$$;


-- Step 5: Create a function for admins to get pending refunds
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
    p.full_name
  FROM public.contracts c
  JOIN public.profiles p ON c.user_id = p.id
  WHERE c.status = 'pending_refund'
  ORDER BY c.updated_at ASC;
END;
$$;


-- Step 6: Drop the old, now-obsolete function
DROP FUNCTION IF EXISTS public.execute_refund(uuid, uuid);
