-- Migration: Enrich user_withdraw admin emails and migrate to notifications_queue
-- Date: 2025-12-20
-- Description: 
-- 1. Migrates from net.http_post to notifications_queue for reliability
-- 2. Adds enriched parameters: userName, transactionId, withdrawalMethod, recipientName

DROP FUNCTION IF EXISTS public.user_withdraw(numeric, text, jsonb, jsonb);

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
    v_admin_emails TEXT;
    v_user_name TEXT;
    v_recipient_name TEXT;
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
    SELECT 
        email,
        COALESCE(first_name || ' ' || last_name, email) as full_name
    INTO 
        user_profile
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Extract recipient name from payment details
    v_recipient_name := COALESCE(
        mobile_money_details->>'recipient_name',
        mobile_money_details->>'phone_number',
        crypto_details->>'wallet_address',
        'Non spécifié'
    );

    -- Send notification to USER (withdrawal_pending)
    INSERT INTO public.notifications_queue (
        template_id,
        recipient_email,
        notification_params
    ) VALUES (
        'withdrawal_pending',
        user_profile.email,
        jsonb_build_object(
            'to', user_profile.email,
            'name', user_profile.full_name,
            'amount', withdraw_amount
        )
    );

    -- Get admin emails
    SELECT string_agg(email, ',')
    INTO v_admin_emails
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE ur.role = 'admin';

    -- Send ENRICHED notification to ADMINS (new_withdrawal_request)
    IF v_admin_emails IS NOT NULL THEN
        INSERT INTO public.notifications_queue (
            template_id,
            recipient_email,
            notification_params
        ) VALUES (
            'new_withdrawal_request',
            v_admin_emails,
            jsonb_build_object(
                'to', v_admin_emails,
                'amount', withdraw_amount,
                'email', user_profile.email,
                'userName', user_profile.full_name,           -- ✅ NEW
                'transactionId', new_transaction_id::TEXT,    -- ✅ NEW
                'withdrawalMethod', withdraw_method,          -- ✅ NEW
                'recipientName', v_recipient_name             -- ✅ NEW
            )
        );
    END IF;

    -- Send in-app notification to admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de retrait de ' || withdraw_amount || ' USD par ' || user_profile.email,
        '/admin/withdrawals',
        'admin',
        'high',
        new_transaction_id
    );

    RETURN json_build_object('success', true, 'message', 'Demande de retrait créée avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;
