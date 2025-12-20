-- Add immediate confirmation notifications for pending deposit and withdrawal requests
-- This reassures users that their request has been received and is being processed

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.request_deposit(numeric, text, text, text, text);
DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, text, text);

-- Update request_deposit to send confirmation notification to user
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
        user_id, type, amount, currency, status, method, payment_reference, payment_phone_number, description, proof_url
    ) VALUES (
        v_user_id, 'deposit', deposit_amount, 'USD', 'pending', deposit_method, p_payment_reference, p_payment_phone_number, 'Dépôt via ' || deposit_method, p_proof_url
    ) RETURNING id INTO v_transaction_id;

    -- NEW: Send confirmation notification to user
    INSERT INTO public.notifications (user_id, message, link_to, type, priority)
    VALUES (
        v_user_id,
        '✅ Demande de dépôt reçue ! Votre dépôt de ' || deposit_amount || ' USD est en cours de traitement. Vous recevrez une notification une fois validé.',
        '/transactions',
        'transaction',
        'medium'
    );

    -- Enqueue notifications for admins
    FOR admin_record IN
        SELECT u.id, u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_deposit_request',
            admin_record.id,
            admin_record.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'email', profile_data.email,
                'amount', deposit_amount
            )
        );
    END LOOP;

    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
        '/admin/deposits',
        'admin',
        'high'
    );
    
    RETURN json_build_object('success', true, 'message', 'Deposit request created successfully', 'transaction_id', v_transaction_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Update user_withdraw to send confirmation notification to user
CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount numeric,
    withdraw_method text DEFAULT 'crypto'::text,
    p_payment_reference text DEFAULT NULL::text,
    p_payment_phone_number text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profit_balance NUMERIC(20,8);
    profile_data record;
    admin_record record;
    new_transaction_id UUID;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    IF withdraw_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du retrait doit être positif.');
    END IF;

    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_profit_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found for user.');
    END IF;

    IF v_profit_balance < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant pour ce retrait.');
    END IF;

    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    -- Lock funds
    UPDATE public.wallets
    SET profit_balance = profit_balance - withdraw_amount, locked_balance = locked_balance + withdraw_amount, updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO public.transactions (
        user_id, amount, type, status, method, payment_reference, payment_phone_number, description
    )
    VALUES (
        v_user_id, withdraw_amount, 'withdrawal', 'pending', withdraw_method, p_payment_reference, p_payment_phone_number, 'Retrait via ' || withdraw_method
    )
    RETURNING id INTO new_transaction_id;

    -- NEW: Send confirmation notification to user
    INSERT INTO public.notifications (user_id, message, link_to, type, priority)
    VALUES (
        v_user_id,
        '✅ Demande de retrait reçue ! Votre retrait de ' || withdraw_amount || ' USD est en cours de traitement. Vous recevrez une notification une fois validé.',
        '/transactions',
        'transaction',
        'medium'
    );

    -- Enqueue notifications for admins
    FOR admin_record IN
        SELECT u.id, u.email FROM auth.users u
        JOIN public.user_roles ur ON u.id = ur.user_id
        WHERE ur.role = 'admin'
    LOOP
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'new_withdrawal_request',
            admin_record.id,
            admin_record.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'email', profile_data.email,
                'amount', withdraw_amount
            )
        );
    END LOOP;

    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || profile_data.email,
        '/admin/withdrawals',
        'admin',
        'high'
    );

    RETURN json_build_object(' success', true, 'transaction_id', new_transaction_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
