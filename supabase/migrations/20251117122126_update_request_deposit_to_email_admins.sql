-- Met à jour la fonction request_deposit pour envoyer un e-mail aux admins via la nouvelle Edge Function.

CREATE OR REPLACE FUNCTION public.request_deposit(
    deposit_amount numeric,
    deposit_method text,
    p_payment_reference text DEFAULT NULL,
    p_payment_phone_number text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
    v_user_id uuid;
    profile_data record;
    admin_record record;
    new_transaction_id uuid;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    -- Data validation
    IF deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant du dépôt doit être positif.');
    END IF;

    -- Get user profile
    SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;
    IF profile_data.first_name IS NULL OR profile_data.last_name IS NULL OR profile_data.phone IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Veuillez compléter votre profil avant de faire un dépôt.');
    END IF;

    -- Insert the pending deposit transaction
    INSERT INTO public.transactions (user_id, amount, type, status, method, payment_reference, payment_phone_number)
    VALUES (v_user_id, deposit_amount, 'deposit', 'pending', deposit_method, p_payment_reference, p_payment_phone_number)
    RETURNING id INTO new_transaction_id;

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

    -- Also, send an in-app notification to admins
    PERFORM public.notify_all_admins(
        'Nouvelle demande de dépôt de ' || deposit_amount || ' USD par ' || profile_data.email, 
        '/admin/deposits', 
        new_transaction_id
    );

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Erreur BDD: ' || SQLERRM);
END;
$$;