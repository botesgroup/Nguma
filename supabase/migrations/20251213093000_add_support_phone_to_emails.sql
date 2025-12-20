-- Migration: Add support_phone to email payloads
-- This migration updates request_deposit, approve_deposit, and create_new_contract 
-- to fetch the support_whatsapp_number from settings and pass it to the email edge function.

-- 1. Update request_deposit (includes batch admin email fix from previous step)
DROP FUNCTION IF EXISTS public.request_deposit(numeric, text, text, text, text);

CREATE OR REPLACE FUNCTION public.request_deposit(
    deposit_amount numeric,
    deposit_method text,
    p_payment_reference text DEFAULT NULL::text,
    p_payment_phone_number text DEFAULT NULL::text,
    p_proof_url text DEFAULT NULL::text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_wallet_id UUID;
    v_transaction_id UUID;
    profile_data record;
    admin_emails jsonb;
    v_support_phone TEXT;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NjM1NTIsImV4cCI6MjA0NjAzOTU1Mn0.HuzKb9pWkF_Px7I5cBSTwgPIcgK26ubqnH5yTXyUfEk';
    payload JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;

    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;
    IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
    END IF;

    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_user_id;
    
    IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, total_balance, invested_balance, profit_balance)
        VALUES (v_user_id, 0, 0, 0)
        RETURNING id INTO v_wallet_id;
    END IF;

    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method,
        payment_reference, payment_phone_number, description, proof_url
    ) VALUES (
        v_user_id, 'deposit', deposit_amount, 'USD', 'pending', deposit_method,
        p_payment_reference, p_payment_phone_number, 'Dépôt via ' || deposit_method, p_proof_url
    ) RETURNING id INTO v_transaction_id;

    -- Fetch Support Phone
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- Enqueue deposit_pending email to user
    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_pending',
            v_user_id,
            profile_data.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'amount', deposit_amount,
                'support_phone', v_support_phone
            )
        );
    END IF;

    -- Aggregate all admin emails into a JSON array
    SELECT json_agg(u.email) INTO admin_emails
    FROM auth.users u
    JOIN public.user_roles ur ON u.id = ur.user_id
    WHERE ur.role = 'admin';

    -- If there are admins, send one single request
    IF admin_emails IS NOT NULL AND jsonb_array_length(admin_emails) > 0 THEN
        payload := jsonb_build_object(
            'template_id', 'new_deposit_request',
            'to', admin_emails, 
            'name', profile_data.first_name || ' ' || profile_data.last_name,
            'email', profile_data.email,
            'amount', deposit_amount
        );

        PERFORM net.http_post(
            url := project_url || '/functions/v1/send-resend-email',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', anon_key,
                'Authorization', 'Bearer ' || anon_key
            ),
            body := payload
        );
    END IF;

    -- Send in-app notification WITH REFERENCE ID
    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
        '/admin/deposits', 
        'admin', 
        'high',
        v_transaction_id
    );
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Deposit request created successfully',
        'transaction_id', v_transaction_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 2. Update approve_deposit
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
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors de l''approbation du dépôt.');
END;
$function$;

-- 3. Update create_new_contract
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
