-- This migration provides a definitive fix for the 'positive_balances' check constraint violation
-- by making the exception handler's rollback logic safe.

DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, jsonb);

CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount numeric, 
    withdraw_method text, 
    p_payment_details jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    new_transaction_id uuid;
    user_profile record;
    admin_record record;
    v_description TEXT;
    v_recipient_info TEXT := '';
BEGIN
    -- Atomically move funds from profit_balance to locked_balance
    -- The WHERE clause ensures we never violate the positive balance constraint.
    UPDATE public.wallets
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id AND profit_balance >= withdraw_amount;

    -- Check if the update affected any row. If not, the balance was insufficient.
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant au moment de la confirmation.');
    END IF;

    -- Build a readable description from JSON details
    IF p_payment_details ? 'recipient_number' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_number');
    ELSIF p_payment_details ? 'recipient_wallet' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_wallet');
    ELSIF p_payment_details ? 'recipient_binance_id' THEN
        v_recipient_info := 'Binance ID: ' || (p_payment_details->>'recipient_binance_id');
    END IF;

    v_description := 'Retrait via ' || withdraw_method;
    IF v_recipient_info != '' THEN
        v_description := v_description || ' (' || v_recipient_info || ')';
    END IF;

    -- Create transaction
    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method, 
        payment_details, description
    )
    VALUES (
        v_user_id, 'withdrawal', withdraw_amount, 'USD', 'pending', withdraw_method,
        p_payment_details,
        v_description
    ) RETURNING id INTO new_transaction_id;

    -- Get user profile for notification
    SELECT * INTO user_profile FROM public.profiles WHERE id = v_user_id;

    -- Enqueue email to admins via notifications_queue
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

    -- Send in-app notification to all admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || user_profile.email,
        '/admin/withdrawals',
        'admin',
        'high',
        new_transaction_id
    );

    RETURN json_build_object('success', true, 'message', 'Demande de retrait créée avec succès.', 'transaction_id', new_transaction_id);

EXCEPTION 
    WHEN OTHERS THEN
        -- SAFE ROLLBACK: If any error occurs after the initial fund lock,
        -- this block will safely attempt to return the funds.
        UPDATE public.wallets
        SET 
            profit_balance = profit_balance + withdraw_amount,
            locked_balance = locked_balance - withdraw_amount
        WHERE 
            user_id = v_user_id 
            -- Crucially, only if the locked amount is sufficient to be returned
            AND locked_balance >= withdraw_amount; 

        RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_withdraw(numeric, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.user_withdraw(numeric, text, jsonb) IS 'Processes a withdrawal with an atomic balance check and a safe exception handler.';
