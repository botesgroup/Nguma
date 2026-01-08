-- Final fix for the admin withdrawal notification email.
-- This version ensures all required parameters, including a fallback for recipientName,
-- are included in the payload for the 'new_withdrawal_request' template.

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
    v_recipient_name TEXT;
    v_key TEXT;
    v_value TEXT;
BEGIN
    -- Atomically move funds from profit_balance to locked_balance
    UPDATE public.wallets
    SET 
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE user_id = v_user_id AND profit_balance >= withdraw_amount;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Solde de profits insuffisant au moment de la confirmation.');
    END IF;

    -- Build a readable description and get recipient name from JSON details
    v_recipient_name := COALESCE(p_payment_details->>'recipient_name', 'Non spécifié');
    
    IF p_payment_details ? 'recipient_number' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_number');
    ELSIF p_payment_details ? 'recipient_wallet' THEN
        v_recipient_info := 'Vers: ' || (p_payment_details->>'recipient_wallet');
    END IF;

    v_description := 'Retrait via ' || withdraw_method;
    IF v_recipient_info != '' THEN
        v_description := v_description || ' (' || v_recipient_info || ')';
    END IF;

    -- Create transaction
    INSERT INTO public.transactions (
        user_id, type, amount, currency, status, method, description
    )
    VALUES (
        v_user_id, 'withdrawal', withdraw_amount, 'USD', 'pending', withdraw_method, v_description
    ) RETURNING id INTO new_transaction_id;

    -- Save metadata
    IF p_payment_details IS NOT NULL THEN
        FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_payment_details) LOOP
            INSERT INTO public.transaction_metadata (transaction_id, field_key, field_value)
            VALUES (new_transaction_id, v_key, v_value);
        END LOOP;
    END IF;

    -- Get user profile for notification
    SELECT * INTO user_profile FROM public.profiles WHERE id = v_user_id;

    -- Enqueue email for admins WITH ALL REQUIRED FIELDS
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
                'to', admin_record.admin_email,
                'amount', withdraw_amount,
                'email', user_profile.email,
                'userName', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, user_profile.email),
                'transactionId', new_transaction_id,
                'withdrawalMethod', withdraw_method,
                'recipientName', v_recipient_name
            )
        );
    END LOOP;

    -- In-app notification for admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || user_profile.email,
        '/admin/withdrawals', 'admin', 'high', new_transaction_id
    );

    RETURN json_build_object('success', true, 'message', 'Demande de retrait créée avec succès.', 'transaction_id', new_transaction_id);

EXCEPTION 
    WHEN OTHERS THEN
        UPDATE public.wallets
        SET 
            profit_balance = profit_balance + withdraw_amount,
            locked_balance = locked_balance - withdraw_amount
        WHERE 
            user_id = v_user_id AND locked_balance >= withdraw_amount; 
        RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_withdraw(numeric, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.user_withdraw(numeric, text, jsonb) IS 'Final version that correctly provides all parameters for the admin withdrawal notification email.';
