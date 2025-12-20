-- Add deposit_pending email notification to request_deposit function
-- This migration updates the request_deposit function to send a confirmation email to the user

DROP FUNCTION IF EXISTS public.request_deposit(numeric, text, text, text, text);

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
    -- Get current user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;

    -- Data validation
    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    -- Get user profile for validation and email
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;
    IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
    END IF;

    -- Get user's wallet
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_user_id;
    
    IF v_wallet_id IS NULL THEN
        -- Create wallet if it doesn't exist (should exist, but for safety)
        INSERT INTO public.wallets (user_id, total_balance, invested_balance, profit_balance)
        VALUES (v_user_id, 0, 0, 0)
        RETURNING id INTO v_wallet_id;
    END IF;

    -- Create pending transaction with proof_url
    INSERT INTO public.transactions (
        user_id,
        type,
        amount,
        currency,
        status,
        method,
        payment_reference,
        payment_phone_number,
        description,
        proof_url
    ) VALUES (
        v_user_id,
        'deposit',
        deposit_amount,
        'USD',
        'pending',
        deposit_method,
        p_payment_reference,
        p_payment_phone_number,
        'Dépôt via ' || deposit_method,
        p_proof_url
    ) RETURNING id INTO v_transaction_id;

    IF profile_data.email IS NOT NULL THEN
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
    END IF;

    -- Loop through all admins and enqueue email notification
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

    -- Also, send an in-app notification to admins with type and priority
    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email,
        '/admin/deposits',
        'admin',
        'high'
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

COMMENT ON FUNCTION public.request_deposit IS 'Creates a pending deposit transaction and sends confirmation email to user and notification to admins';
