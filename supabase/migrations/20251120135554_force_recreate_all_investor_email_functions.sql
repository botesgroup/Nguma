-- AGGRESSIVE FIX: Force recreation of ALL investor email functions with CASCADE
-- This ensures old cached versions are completely removed

-- Step 1: Drop ALL existing versions with CASCADE (removes dependencies)
DROP FUNCTION IF EXISTS public.approve_deposit(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.reject_deposit(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_new_contract(numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_monthly_profits() CASCADE;

-- Step 2: Recreate functions with EXPLICIT email sending

-- Function 1: approve_deposit
CREATE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$ 
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
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

    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été approuvé.', transaction_id_to_approve, '/wallet', 'transaction', 'high');

    -- CRITICAL EMAIL SENDING
    IF user_profile.email IS NOT NULL THEN
        payload := jsonb_build_object(
            'template_id', 'deposit_approved',
            'to', user_profile.email,
            'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
            'amount', transaction_record.amount
        );
        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'),
            body := payload
        );
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors de l''approbation du dépôt.');
END;
$function$;

-- Function 2: reject_deposit  
CREATE FUNCTION public.reject_deposit(transaction_id_to_reject uuid, reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$ 
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent rejeter les dépôts.');
    END IF;

    IF reason IS NULL OR trim(reason) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Une raison pour le rejet est obligatoire.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    UPDATE public.transactions
    SET status = 'failed', description = 'Rejeté par l''admin. Raison: ' || reason, updated_at = now()
    WHERE id = transaction_id_to_reject;

    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été rejeté. Raison: ' || reason, transaction_id_to_reject, '/wallet', 'transaction', 'high');

    -- CRITICAL EMAIL SENDING
    IF user_profile.email IS NOT NULL THEN
        payload := jsonb_build_object(
            'template_id', 'deposit_rejected',
            'to', user_profile.email,
            'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
            'amount', transaction_record.amount,
            'reason', reason
        );
        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'),
            body := payload
        );
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors du rejet du dépôt.');
END;
$function$;

-- Function 3: create_new_contract
CREATE FUNCTION public.create_new_contract(investment_amount numeric)
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
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
  result JSONB;
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

  -- CRITICAL EMAIL SENDING
  IF user_profile.email IS NOT NULL THEN
      payload := jsonb_build_object(
          'template_id', 'new_investment',
          'to', user_profile.email,
          'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
          'amount', investment_amount
      );
      PERFORM net.http_post(
          url := project_url || '/functions/v1/send-resend-email',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'),
          body := payload
      );
  END IF;

  result := jsonb_build_object('success', true, 'contract_id', new_contract_id);
  RETURN result;
END;
$function$;

-- Function 4: calculate_monthly_profits
CREATE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  contract_record RECORD;
  user_profile record;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
BEGIN
  FOR contract_record IN 
    SELECT * FROM public.contracts 
    WHERE status = 'active' AND months_paid < duration_months 
  LOOP
    IF now() >= (contract_record.start_date + (contract_record.months_paid + 1) * interval '1 month') THEN
      
      current_month := contract_record.months_paid + 1;
      profit_amount := contract_record.amount * contract_record.monthly_rate;
      
      SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = contract_record.user_id;

      INSERT INTO public.profits (contract_id, user_id, amount, month_number) 
      VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
      
      UPDATE public.wallets SET profit_balance = profit_balance + profit_amount WHERE user_id = contract_record.user_id;
      
      INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
      VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Monthly profit from contract month ' || current_month::TEXT);
      
      UPDATE public.contracts 
      SET months_paid = current_month, total_profit_paid = total_profit_paid + profit_amount, last_profit_distribution_date = now(), status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END 
      WHERE id = contract_record.id;
      
      INSERT INTO public.notifications (user_id, message, link_to, type, priority) 
      VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet', 'profit', 'medium');

      -- CRITICAL EMAIL SENDING
      IF user_profile.email IS NOT NULL THEN
          payload := jsonb_build_object(
              'template_id', 'monthly_profit',
              'to', user_profile.email,
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'amount', profit_amount
          );
          PERFORM net.http_post(
              url := project_url || '/functions/v1/send-resend-email',
              headers := jsonb_build_object('Content-Type', 'application/json'),
              body := payload
          );
      END IF;

    END IF;
  END LOOP;
END;
$function$;
