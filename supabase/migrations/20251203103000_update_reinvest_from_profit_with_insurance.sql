CREATE OR REPLACE FUNCTION public.reinvest_from_profit(reinvestment_amount numeric, p_is_insured boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  contract_creation_result JSONB;
BEGIN
  -- Get user wallet and check PROFIT balance
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;

  IF user_wallet.profit_balance < reinvestment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde de profit insuffisant pour le réinvestissement.');
  END IF;
  
  -- Check for minimum reinvestment amount
  IF reinvestment_amount < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant minimum pour réinvestir est de 500 USD.');
  END IF;

  -- Move funds from profit balance to total balance so create_new_contract can use it
  UPDATE public.wallets
  SET
    profit_balance = profit_balance - reinvestment_amount,
    total_balance = total_balance + reinvestment_amount
  WHERE user_id = current_user_id;

  -- Call the existing contract creation function which handles all logic including insurance
  SELECT public.create_new_contract(reinvestment_amount, p_is_insured) INTO contract_creation_result;

  -- Check if the nested call was successful. If not, revert the balance transfer.
  IF NOT (contract_creation_result->>'success')::boolean THEN
      -- Revert the balance transfer
      UPDATE public.wallets
      SET
        profit_balance = profit_balance + reinvestment_amount,
        total_balance = total_balance - reinvestment_amount
      WHERE user_id = current_user_id;

      RETURN contract_creation_result;
  END IF;

  -- Add reinvestment-specific details to the successful response and return
  RETURN contract_creation_result;

END;
$function$;
