-- Fix all calls to notify_all_admins to include type and priority parameters
-- The function was updated to accept type and priority, but old calls still use only 3 parameters

-- Drop existing function to avoid return type conflict
DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, text, text);

-- Recreate user_withdraw function to include type='admin' and priority='high' in notify_all_admins call
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
    v_current_balance NUMERIC(20,8);
    profile_data record;
    admin_record record;
    new_transaction_id UUID;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    -- Validation: Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated.');
    END IF;

    -- Validation: Check if withdrawal amount is positive
    IF withdraw_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du retrait doit être positif.');
    END IF;

    -- Get current total balance
    SELECT total_balance INTO v_current_balance FROM public.wallets WHERE user_id = v_user_id;
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found for user.');
    END IF;

    -- Check if balance is sufficient
    IF v_current_balance < withdraw_amount THEN
        RETURN json_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait.');
    END IF;

    -- Get user profile for email
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

    -- Create the withdrawal transaction (pending status by default)
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
        withdraw_amount, 
        'withdrawal', 
        'pending', 
        withdraw_method, 
        p_payment_reference, 
        p_payment_phone_number,
        'Retrait via ' || withdraw_method
    )
    RETURNING id INTO new_transaction_id;

    -- Loop through all admins and enqueue email notification
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

    -- Send in-app notification to all admins WITH type and priority
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || profile_data.email,
        '/admin/withdrawals',
        'admin',
        'high'
    );

    RETURN json_build_object('success', true, 'transaction_id', new_transaction_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Database error: ' || SQLERRM);
END;
$$;
