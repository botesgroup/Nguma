-- Fix HTTP headers causing errors in email functions
-- Remove problematic Authorization header that was causing "unexpected error"

-- The problem: current_setting('request.headers') doesn't work in this context
-- Solution: Use simple headers like in withdrawal functions (which work)

ALTER FUNCTION public.approve_deposit(uuid) OWNER TO postgres;
ALTER FUNCTION public.reject_deposit(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.create_new_contract(numeric) OWNER TO postgres;
ALTER FUNCTION public.calculate_monthly_profits() OWNER TO postgres;

-- Recreate with CORRECT headers (no Authorization)
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
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

    -- FIXED: Use simple headers like withdrawal functions
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_approved',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', transaction_record.amount
            )
        );
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors de l''approbation du dépôt.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_deposit(transaction_id_to_reject uuid, reason text)
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

    -- FIXED: Use simple headers
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors du rejet du dépôt.');
END;
$function$;

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

  -- FIXED: Use simple headers
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'new_investment',
          current_user_id,
          user_profile.email,
          jsonb_build_object(
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'amount', investment_amount
          )
      );
  END IF;

  result := jsonb_build_object('success', true, 'contract_id', new_contract_id);
  RETURN result;
END;
$function$;
