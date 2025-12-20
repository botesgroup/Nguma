-- Migration: Fix approve_deposit and create_new_contract (Merge Accounting + Support Phone)
-- Date: 2025-12-13
-- Description: 
-- 1. Restores accounting logic in approve_deposit (accidental regression in previous migration).
-- 2. Restores accounting logic in create_new_contract.
-- 3. Retains the new support_phone in emails features.
-- 4. Runs a reconciliation script to fix missing accounting entries.

-- 1. FIX approve_deposit
DROP FUNCTION IF EXISTS public.approve_deposit(uuid);

CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$ 
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    v_support_phone TEXT;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    
    -- Accounting variables
    v_bank_account_id UUID;
    v_deposits_liability_account_id UUID;
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent approuver les dépôts.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_approve AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    UPDATE public.wallets
    SET total_balance = total_balance + transaction_record.amount
    WHERE user_id = transaction_record.user_id;

    UPDATE public.transactions
    SET status = 'completed', updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- *** ACCOUNTING LOGIC (RESTORED) ***
    SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';
    
    IF v_bank_account_id IS NOT NULL AND v_deposits_liability_account_id IS NOT NULL THEN
        INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount, created_by)
        VALUES (
            transaction_id_to_approve,
            'Approbation du dépôt de ' || transaction_record.amount || ' USD pour ' || (SELECT email FROM auth.users WHERE id = transaction_record.user_id),
            v_bank_account_id,
            v_deposits_liability_account_id,
            transaction_record.amount,
            auth.uid()
        );
    END IF;
    -- ************************************

    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été approuvé.', transaction_id_to_approve, '/wallet', 'transaction', 'high');

    -- Fetch Support Phone
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- Enqueue email notification
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_approved',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', transaction_record.amount,
                'support_phone', v_support_phone
            )
        );
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM || ' (State: ' || SQLSTATE || ')');
END;
$function$;

-- 2. FIX create_new_contract
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

  -- *** ACCOUNTING LOGIC (RESTORED) ***
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
  -- ************************************

  -- Fetch Support Phone
  SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

  -- Enqueue email notification
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

  result := jsonb_build_object('success', true, 'contract_id', new_contract_id);
  RETURN result;
END;
$function$;


-- 3. RECONCILIATION SCRIPT
-- Find any completed DEPOSITS that do not have an accounting entry and create them.
DO $$
DECLARE
    r RECORD;
    v_bank_account_id UUID;
    v_deposits_liability_account_id UUID;
BEGIN
    SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';

    FOR r IN 
        SELECT t.* 
        FROM public.transactions t
        LEFT JOIN public.accounting_entries ae ON t.id = ae.related_transaction_id
        WHERE t.type = 'deposit' AND t.status = 'completed' AND ae.id IS NULL
    LOOP
        INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount, created_at)
        VALUES (
            r.id,
            'Régularisation : Dépôt de ' || r.amount || ' USD',
            v_bank_account_id,
            v_deposits_liability_account_id,
            r.amount,
            r.updated_at -- Keep original date if possible, or now()
        );
    END LOOP;
END;
$$;
