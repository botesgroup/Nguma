-- Migration for debugging the request_deposit function.
-- Adds a RAISE WARNING to show the value of v_deposit_enabled.

CREATE OR REPLACE FUNCTION public.request_deposit(
  deposit_amount NUMERIC(20,8),
  deposit_method TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_payment_phone_number TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
  
  -- Deposit control settings
  v_deposit_enabled BOOLEAN;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_max_deposits_per_period INT;
  v_deposit_count INT;
BEGIN
  -- 1. Get deposit control settings from the settings table
  -- Use COALESCE with default values to handle cases where settings might not exist yet (though they should from 001_add_deposit_control_settings.sql)
  SELECT
    COALESCE((SELECT value FROM settings WHERE key = 'deposit_enabled')::BOOLEAN, TRUE),
    COALESCE((SELECT value FROM settings WHERE key = 'deposit_period_start')::TIMESTAMPTZ, '2024-01-01T00:00:00.000Z'::TIMESTAMPTZ),
    COALESCE((SELECT value FROM settings WHERE key = 'deposit_period_end')::TIMESTAMPTZ, '2024-12-31T23:59:59.999Z'::TIMESTAMPTZ),
    COALESCE((SELECT value FROM settings WHERE key = 'max_deposits_per_period')::INT, 5)
  INTO
    v_deposit_enabled,
    v_period_start,
    v_period_end,
    v_max_deposits_per_period;

  -- DEBUG: Raise a warning to show the value of v_deposit_enabled
  RAISE WARNING 'DEBUG: v_deposit_enabled = %', v_deposit_enabled;

  -- 2. Check if deposits are globally enabled
  IF NOT v_deposit_enabled THEN
    RAISE EXCEPTION 'Les dépôts sont actuellement désactivés par l''administrateur.';
  END IF;

  -- 3. Check if the current time is within the deposit period
  IF now() NOT BETWEEN v_period_start AND v_period_end THEN
    RAISE EXCEPTION 'La période de dépôt est actuellement fermée.';
  END IF;

  -- 4. Check if the user has reached the deposit limit for the current period
  SELECT count(*)
  INTO v_deposit_count
  FROM public.transactions
  WHERE user_id = current_user_id
    AND type = 'deposit'
    AND status IN ('pending', 'completed') -- Count pending and completed to prevent spamming requests
    AND created_at BETWEEN v_period_start AND v_period_end;

  IF v_deposit_count >= v_max_deposits_per_period THEN
    RAISE EXCEPTION 'Vous avez atteint la limite de % dépôts pour la période actuelle.', v_max_deposits_per_period;
  END IF;

  -- 5. Original function logic: proceed if all checks pass
  IF deposit_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du dépôt doit être positif.';
  END IF;

  SELECT currency INTO user_currency
  FROM public.wallets
  WHERE user_id = current_user_id;
  
  IF NOT FOUND THEN
    user_currency := 'USD'; -- Fallback to default currency
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description, payment_reference, payment_phone_number, proof_url)
  VALUES (
    current_user_id,
    'deposit',
    deposit_amount,
    user_currency,
    'pending',
    deposit_method,
    'User deposit request via ' || deposit_method,
    p_payment_reference,
    p_payment_phone_number,
    p_proof_url
  );

  PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' ' || user_currency, '/admin/deposits');

  RETURN jsonb_build_object('success', true, 'message', 'Votre demande de dépôt a été créée et est en attente d''approbation.');
END;
$$;
