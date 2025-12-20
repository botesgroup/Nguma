-- Met à jour la fonction create_new_contract pour envoyer un e-mail à l'utilisateur via la nouvelle Edge Function.

CREATE OR REPLACE FUNCTION public.create_new_contract(investment_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  user_profile record;
  current_monthly_rate NUMERIC(10,8);
  contract_duration_months_val INTEGER;
  new_contract_id UUID;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
  result JSONB;
BEGIN
  -- 1. Get current settings
  SELECT value::NUMERIC INTO current_monthly_rate
  FROM public.settings
  WHERE key = 'monthly_profit_rate';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set');
  END IF;

  SELECT value::INTEGER INTO contract_duration_months_val
  FROM public.settings
  WHERE key = 'contract_duration_months';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set');
  END IF;

  -- 2. Get user wallet and check balance
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = current_user_id;

  IF user_wallet.total_balance < investment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Get user profile for email details
  SELECT email, first_name, last_name INTO user_profile
  FROM public.profiles
  WHERE id = current_user_id;

  -- 3. Update wallet balance
  UPDATE public.wallets
  SET
    total_balance = total_balance - investment_amount,
    invested_balance = invested_balance + investment_amount,
    updated_at = now()
  WHERE user_id = current_user_id;

  -- 4. Create the new contract
  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (
    current_user_id,
    investment_amount,
    user_wallet.currency,
    current_monthly_rate,
    now() + (contract_duration_months_val || ' months')::interval, -- Use months here
    contract_duration_months_val
  )
  RETURNING id INTO new_contract_id;

  -- 5. Create investment transaction
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (
    current_user_id,
    'investment',
    investment_amount,
    user_wallet.currency,
    new_contract_id,
    'New investment contract created'
  );

  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'new_investment',
          current_user_id,
          user_profile.email,
          jsonb_build_object(
              'name', user_profile.first_name || ' ' || user_profile.last_name,
              'amount', investment_amount
          )
      );
  END IF;

  result := jsonb_build_object(
    'success', true,
    'contract_id', new_contract_id
  );

  RETURN result;
END;
$$;