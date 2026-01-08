-- Migration to update email sending functions to use the notifications_queue system

-- 1. Create or replace the public.get_secret function for secure secret access from SQL
-- This function is crucial for securely retrieving secrets (like service role key)
-- without hardcoding them in SQL functions.
CREATE OR REPLACE FUNCTION public.get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    secret_value TEXT;
BEGIN
    SELECT value INTO secret_value
    FROM vault.decrypted_secrets
    WHERE name = secret_name;

    RETURN secret_value;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret(TEXT) TO service_role;

-- 2. Drop the old function "request_deposit" to allow changing its return type
DROP FUNCTION IF EXISTS public.request_deposit(numeric,text,text,text,text);

-- 3. Recreate the "request_deposit" function with the new queue-based logic
CREATE FUNCTION public.request_deposit(
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

    -- Enqueue deposit_pending email to user
    INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
    VALUES (
        'deposit_pending',
        v_user_id,
        profile_data.email,
        jsonb_build_object(
            'name', profile_data.first_name || ' ' || profile_data.last_name,
            'amount', deposit_amount
        )
    );

    -- Enqueue notification to all admins
    FOR admin_record IN
        SELECT u.id as admin_id, u.email as admin_email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_deposit_request',
            admin_record.admin_id,
            admin_record.admin_email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'email', profile_data.email,
                'amount', deposit_amount
            )
        );
    END LOOP;

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

-- 4. Drop the old function "user_withdraw"
DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, jsonb, jsonb);

-- 5. Recreate the "user_withdraw" function with the new queue-based logic
CREATE FUNCTION public.user_withdraw(
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

    -- Enqueue email to admins
    FOR admin_record IN
        SELECT u.id as admin_id, u.email as admin_email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_withdrawal_request',
            admin_record.admin_id,
            admin_record.admin_email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'email', user_profile.email,
                'amount', withdraw_amount
            )
        );
    END LOOP;

    RETURN json_build_object('success', true, 'message', 'Demande de retrait créée avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;