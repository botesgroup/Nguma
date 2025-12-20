-- Migration to simplify the request_deposit function by removing period and max_deposits checks.

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
BEGIN
  -- 1. Get deposit control settings from the settings table
  -- Only retrieve deposit_enabled
  SELECT
    COALESCE((SELECT value FROM settings WHERE key = 'deposit_enabled')::BOOLEAN, TRUE)
  INTO
    v_deposit_enabled;

  -- 2. Check if deposits are globally enabled
  IF NOT v_deposit_enabled THEN
    RAISE EXCEPTION 'Les dépôts sont actuellement désactivés par l''administrateur.';
  END IF;

  -- 3. Original function logic: proceed if all checks pass
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