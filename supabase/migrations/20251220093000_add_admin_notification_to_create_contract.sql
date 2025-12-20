-- Migration: Add admin notification to create_new_contract
-- Date: 2025-12-20
-- Description: Integrates notify_admins_new_contract() call into create_new_contract function

DROP FUNCTION IF EXISTS public.create_new_contract(numeric);

CREATE OR REPLACE FUNCTION public.create_new_contract(investment_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  user_profile record;
  current_monthly_rate NUMERIC(10,8);
  contract_duration_months_val INTEGER;
  new_contract_id UUID;
  v_support_phone TEXT;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
  result JSONB;
  
  -- Accounting variables
  v_deposits_liability_account_id UUID;
  v_invested_liability_account_id UUID;
BEGIN
  SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set');
  END IF;

  SELECT value::INTEGER INTO contract_duration_months_val FROM public.settings WHERE key = 'contract_duration_months';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set');
  END IF;

  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.total_balance < investment_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = current_user_id;

  UPDATE public.wallets
  SET total_balance = total_balance - investment_amount, invested_balance = invested_balance + investment_amount, updated_at = now()
  WHERE user_id = current_user_id;

  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (current_user_id, investment_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_months_val || ' months')::interval, contract_duration_months_val)
  RETURNING id INTO new_contract_id;

  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (current_user_id, 'investment', investment_amount, user_wallet.currency, new_contract_id, 'New investment contract created');

  -- *** ACCOUNTING LOGIC ***
  SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
  SELECT id INTO v_invested_liability_account_id FROM public.company_accounts WHERE name = 'Capital Investi Clients';

  INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount, created_by)
  VALUES (
      (SELECT id FROM public.transactions WHERE reference_id = new_contract_id AND description = 'New investment contract created' LIMIT 1),
      'Allocation de capital au contrat #' || substr(new_contract_id::text, 1, 8),
      v_deposits_liability_account_id,
      v_invested_liability_account_id,
      investment_amount,
      auth.uid()
  );

  -- Fetch Support Phone
  SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

  -- Send email to USER (new_investment)
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'new_investment',
          current_user_id,
          user_profile.email,
          jsonb_build_object(
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'amount', investment_amount,
              'support_phone', v_support_phone
          )
      );
  END IF;

  -- ✅ NEW: Notify admins of new contract
  PERFORM public.notify_admins_new_contract(
    new_contract_id,
    current_user_id,
    investment_amount,
    contract_duration_months_val,
    current_monthly_rate
  );

  result := jsonb_build_object('success', true, 'contract_id', new_contract_id);
  RETURN result;
END;
$function$;
