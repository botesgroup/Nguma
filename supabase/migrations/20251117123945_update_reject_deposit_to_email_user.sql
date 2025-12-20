-- Met à jour la fonction reject_deposit pour envoyer un e-mail à l'utilisateur via la nouvelle Edge Function.

CREATE OR REPLACE FUNCTION public.reject_deposit(
    transaction_id_to_reject uuid,
    reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
BEGIN
    -- 1. Check if the user is an admin
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent rejeter les dépôts.');
    END IF;

    -- 2. Validate the reason
    IF reason IS NULL OR trim(reason) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Une raison pour le rejet est obligatoire.');
    END IF;

    -- 3. Get the transaction details
    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    -- Get user profile for email details
    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    -- 4. Update the transaction status and add rejection reason
    UPDATE public.transactions
    SET 
        status = 'failed',
        description = 'Rejeté par l''admin. Raison: ' || reason,
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    -- 5. Create an in-app notification for the user
    INSERT INTO public.notifications (user_id, message, reference_id, link_to)
    VALUES (
        transaction_record.user_id, 
        'Votre dépôt de ' || transaction_record.amount || ' a été rejeté. Raison: ' || reason, 
        transaction_id_to_reject, 
        '/wallet'
    );

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors du rejet du dépôt.');
END;
$$;