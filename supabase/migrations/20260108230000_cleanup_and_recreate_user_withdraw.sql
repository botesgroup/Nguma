-- This migration cleans up and recreates the user_withdraw function to resolve ambiguity.

-- It assumes all ambiguous versions of user_withdraw have been manually dropped.

-- Drop any potential remaining versions with known signatures to be safe.
DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, jsonb);

-- Create the single, definitive version of the user_withdraw function.
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
    user_wallet record;
    new_transaction_id uuid;
    user_profile record;
    admin_record record;
    v_description TEXT;
    v_recipient_info TEXT := '';
BEGIN
    -- Get user wallet
    SELECT * INTO user_wallet FROM public.wallets WHERE user_id = v_user_id;
    IF user_wallet IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Portefeuille introuvable.');
    END IF;

    -- IMPORTANT: This check should be in request_withdrawal_otp, but as a safeguard:
    IF user_wallet.profit_balance < withdraw_amount THEN
        -- In a real scenario, we might need to unlock funds here if they were locked previously.
        -- For now, we return an error.
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant.');
    END IF;
    
    -- This function's main job is to move funds and create the transaction for admin approval.
    -- The balance check and fund locking should ideally happen before OTP.
    -- Assuming funds are available (checked in request_withdrawal_otp)

    -- Move funds from profit_balance to locked_balance to await admin approval
    UPDATE public.wallets 
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id;

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

EXCEPTION WHEN OTHERS THEN
    -- If anything fails, try to roll back the fund lock.
    UPDATE public.wallets
    SET 
        profit_balance = profit_balance + withdraw_amount,
        locked_balance = locked_balance - withdraw_amount
    WHERE user_id = v_user_id;

    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_withdraw(numeric, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.user_withdraw(numeric, text, jsonb) IS 'Definitive version: Processes a withdrawal after OTP, creates the transaction, and notifies admins via the queue.';
