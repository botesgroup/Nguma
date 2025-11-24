-- Fix: Add reference_id to notify_all_admins to enable auto-marking as read
-- This migration updates notify_all_admins and the functions that call it

-- 1. Update notify_all_admins to accept reference_id
CREATE OR REPLACE FUNCTION public.notify_all_admins(
  message_text TEXT, 
  link TEXT DEFAULT NULL,
  notification_type TEXT DEFAULT 'admin',
  notification_priority TEXT DEFAULT 'medium',
  ref_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, message, link_to, type, priority, reference_id)
    VALUES (admin_record.user_id, message_text, link, notification_type, notification_priority, ref_id);
  END LOOP;
END;
$$;

-- 2. Update request_deposit to pass transaction_id
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
    admin_record record;
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

    -- Send deposit_pending email to user
    payload := jsonb_build_object(
        'template_id', 'deposit_pending',
        'to', profile_data.email,
        'name', profile_data.first_name || ' ' || profile_data.last_name,
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

    -- Rate limiting: Wait 1 second before next email
    PERFORM pg_sleep(1.0);

    -- Send notification to all admins
    FOR admin_record IN
        SELECT u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        payload := jsonb_build_object(
            'template_id', 'new_deposit_request',
            'to', admin_record.email,
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

        -- Rate limiting: Wait 1 second between admin emails
        PERFORM pg_sleep(1.0);
    END LOOP;

    -- Send in-app notification WITH REFERENCE ID
    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
        '/admin/deposits', 
        'admin', 
        'high',
        v_transaction_id -- Pass transaction ID here
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

-- 3. Update user_withdraw to pass transaction_id
CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount numeric, 
    withdraw_method text, 
    crypto_details jsonb DEFAULT NULL::jsonb, 
    mobile_money_details jsonb DEFAULT NULL::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_wallet record;
    new_transaction_id uuid;
    user_profile record;
    admin_record record;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcXhvYXZub2FiY25zenptd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NjM1NTIsImV4cCI6MjA0NjAzOTU1Mn0.HuzKb9pWkF_Px7I5cBSTwgPIcgK26ubqnH5yTXyUfEk';
    payload JSONB;
BEGIN
    -- Get user wallet
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = auth.uid();

    IF user_wallet IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    -- Check balance
    IF user_wallet.total_balance < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde insuffisant.');
    END IF;

    -- Deduct from wallet
    UPDATE public.wallets 
    SET total_balance = total_balance - withdraw_amount,
        updated_at = now()
    WHERE user_id = auth.uid();

    -- Create transaction
    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method, 
        payment_details, description
    )
    VALUES (
        auth.uid(), 'withdrawal', withdraw_amount, 'USD', 'pending', withdraw_method,
        CASE 
            WHEN withdraw_method = 'crypto' THEN crypto_details
            WHEN withdraw_method = 'mobile_money' THEN mobile_money_details
            ELSE NULL
        END,
        'Retrait via ' || withdraw_method
    ) RETURNING id INTO new_transaction_id;

    -- Get user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();

    -- Send notification to admins WITH REFERENCE ID
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || user_profile.email,
        '/admin/withdrawals',
        'admin',
        'high',
        new_transaction_id -- Pass transaction ID here
    );

    -- Send email to admins
    FOR admin_record IN
        SELECT u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        payload := jsonb_build_object(
            'template_id', 'new_withdrawal_request',
            'to', admin_record.email,
            'name', user_profile.first_name || ' ' || user_profile.last_name,
            'email', user_profile.email,
            'amount', withdraw_amount
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
        
        PERFORM pg_sleep(1.0);
    END LOOP;

    RETURN json_build_object('success', true, 'message', 'Demande de retrait créée avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;
