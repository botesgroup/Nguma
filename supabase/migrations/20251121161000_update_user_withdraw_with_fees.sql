-- Update user_withdraw to enforce limits and deduct fees
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
    v_min_withdrawal NUMERIC(20,8);
    v_max_withdrawal NUMERIC(20,8);
    v_fee_percent NUMERIC(10,4);
    v_fee_fixed NUMERIC(20,8);
    v_total_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
BEGIN
    -- Validation: Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Load withdrawal settings
    SELECT value::NUMERIC INTO v_min_withdrawal FROM public.settings WHERE key = 'min_withdrawal_amount';
    SELECT value::NUMERIC INTO v_max_withdrawal FROM public.settings WHERE key = 'max_withdrawal_amount';
    SELECT value::NUMERIC INTO v_fee_percent FROM public.settings WHERE key = 'withdrawal_fee_percent';
    SELECT value::NUMERIC INTO v_fee_fixed FROM public.settings WHERE key = 'withdrawal_fee_fixed';

    -- Set defaults if not found
    v_min_withdrawal := COALESCE(v_min_withdrawal, 10);
    v_max_withdrawal := COALESCE(v_max_withdrawal, 10000);
    v_fee_percent := COALESCE(v_fee_percent, 2);
    v_fee_fixed := COALESCE(v_fee_fixed, 1);

    -- Validation: Check minimum withdrawal
    IF withdraw_amount < v_min_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant minimum de retrait est de ' || v_min_withdrawal || ' USD.');
    END IF;

    -- Validation: Check maximum withdrawal
    IF withdraw_amount > v_max_withdrawal THEN
        RETURN json_build_object('success', false, 'error', 'Le montant maximum de retrait est de ' || v_max_withdrawal || ' USD.');
    END IF;

    -- Get profit balance
    SELECT profit_balance INTO v_profit_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_profit_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found for user.');
    END IF;

    -- Check if profit balance is sufficient
    IF v_profit_balance < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant pour ce retrait.');
    END IF;

    -- Calculate fees
    v_total_fee := (withdraw_amount * v_fee_percent / 100) + v_fee_fixed;
    v_net_amount := withdraw_amount - v_total_fee;

    -- Get user profile for email
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    -- Lock the funds (move from profit_balance to locked_balance)
    UPDATE public.wallets
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Create the withdrawal transaction (pending status)
    -- Store the net amount (after fees) in the transaction
    INSERT INTO public.transactions (
        user_id, 
        amount, 
        type, 
        status, 
        method, 
        payment_reference, 
        payment_phone_number,
        description
    )
    VALUES (
        v_user_id, 
        v_net_amount,  -- Net amount after fees
        'withdrawal', 
        'pending', 
        withdraw_method, 
        p_payment_reference, 
        p_payment_phone_number,
        'Retrait via ' || withdraw_method || ' (Frais: ' || v_total_fee::TEXT || ' USD)'
    )
    RETURNING id INTO new_transaction_id;

    -- Notify admins via email
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
                'amount', v_net_amount
            )
        );
    END LOOP;

    -- Send in-app notification to all admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || v_net_amount || ' USD par ' || profile_data.email,
        '/admin/withdrawals',
        'admin',
        'high'
    );

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id, 'net_amount', v_net_amount, 'fee', v_total_fee);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
