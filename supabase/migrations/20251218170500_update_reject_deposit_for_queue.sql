-- This migration updates the reject_deposit function to use the new notifications_queue table
-- instead of making a direct HTTP call. This decouples the transaction from the notification process.

DROP FUNCTION IF EXISTS public.reject_deposit(uuid, text, text, text); -- Drop the old function with many params
DROP FUNCTION IF EXISTS public.reject_deposit(uuid, text); -- Drop the original function

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
    admin_email_address TEXT;
BEGIN
    -- This function now only handles the core database logic and queues notifications.
    
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    SELECT * INTO transaction_record FROM public.transactions WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';
    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction non trouvée ou déjà traitée.');
    END IF;
    
    SELECT id, email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = transaction_record.user_id;

    -- Core logic
    UPDATE public.transactions SET status = 'rejected', updated_at = now() WHERE id = transaction_id_to_reject;
    UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_reject;
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été rejeté. Raison: ' || reason, transaction_id_to_reject, '/transactions', 'transaction', 'high');

    -- 1. Queue notification for the USER
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_rejected',
            user_profile.id,
            user_profile.email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    -- 2. Queue notification for the ADMIN
    -- We get the admin email from a settings table or a hardcoded value if it's static
    SELECT value INTO admin_email_address FROM public.settings WHERE key = 'admin_notification_email' LIMIT 1;
    IF admin_email_address IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_email, notification_params)
        VALUES (
            'new_deposit_request', -- We can reuse this template to show the item needs attention
            admin_email_address,
            jsonb_build_object(
                'name', 'Admin',
                'amount', transaction_record.amount,
                'email', user_profile.email,
                'status', 'REJECTED' -- Add extra info for the admin template if needed
            )
        );
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;
