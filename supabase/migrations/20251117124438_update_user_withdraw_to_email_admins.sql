-- Met à jour la fonction user_withdraw pour envoyer un e-mail aux admins via la nouvelle Edge Function.

CREATE OR REPLACE FUNCTION public.user_withdraw(
    withdraw_amount NUMERIC,
    withdraw_method TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_payment_phone_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
    _user_id UUID := auth.uid();
    _wallet_id UUID;
    _profit_balance NUMERIC;
    _locked_balance NUMERIC;
    _transaction_id UUID;
    user_profile record;
    admin_record record;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    -- Get user's wallet and check balances
    SELECT id, profit_balance, locked_balance INTO _wallet_id, _profit_balance, _locked_balance
    FROM public.wallets
    WHERE user_id = _user_id;

    IF _wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found.');
    END IF;

    -- Check if there are sufficient profits for withdrawal
    IF withdraw_amount <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Le montant du retrait doit être positif.');
    END IF;

    IF _profit_balance < withdraw_amount THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Fonds insuffisants pour le retrait. Solde de profits: ' || _profit_balance);
    END IF;

    -- Deduct amount from profit_balance and add to locked_balance
    UPDATE public.wallets
    SET
        profit_balance = profit_balance - withdraw_amount,
        locked_balance = locked_balance + withdraw_amount,
        updated_at = now()
    WHERE id = _wallet_id;

    -- Create a pending withdrawal transaction
    INSERT INTO public.transactions (user_id, type, amount, currency, status, method, payment_reference, payment_phone_number, description)
    VALUES (
        _user_id,
        'withdrawal',
        withdraw_amount,
        (SELECT currency FROM public.wallets WHERE id = _wallet_id),
        'pending',
        withdraw_method,
        p_payment_reference,
        p_payment_phone_number,
        'Demande de retrait en attente'
    )
    RETURNING id INTO _transaction_id;

    -- Get user profile for email details
    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = _user_id;

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
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'email', user_profile.email,
                'amount', withdraw_amount
            )
        );
    END LOOP;

    -- Notify admins about the new pending withdrawal with the CORRECT link (in-app notification)
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait en attente',
        '/admin/withdrawals',
        _transaction_id
    );

    RETURN jsonb_build_object('success', TRUE, 'transaction_id', _transaction_id);
END;
$$;