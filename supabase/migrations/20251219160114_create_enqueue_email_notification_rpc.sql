-- Migration: create_enqueue_email_notification_rpc
-- Date: 2025-12-19
-- Description: Crée une fonction RPC pour insérer des notifications dans la file d'attente depuis le frontend.

CREATE OR REPLACE FUNCTION public.enqueue_email_notification(
    p_template_id TEXT,
    p_params JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_recipient_email TEXT;
    v_recipient_user_id UUID;
    v_name TEXT;
    v_admin_emails JSONB;
    admin_record RECORD;
BEGIN
    IF v_user_id IS NULL AND NOT p_params ? 'to' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User not authenticated and no recipient specified in params.');
    END IF;

    -- Déterminer le destinataire principal (utilisateur ou admin en boucle)
    IF p_template_id LIKE '%_admin' THEN
        -- Si c'est un template admin, on boucle sur tous les admins
        -- p_params doit contenir les détails de l'événement (qui a fait quoi)
        FOR admin_record IN
            SELECT u.id, u.email FROM auth.users u
            JOIN public.user_roles ur ON u.id = ur.user_id
            WHERE ur.role = 'admin'
        LOOP
            INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
            VALUES (
                p_template_id,
                admin_record.id,
                admin_record.email,
                p_params
            );
        END LOOP;
        RETURN jsonb_build_object('success', TRUE, 'message', 'Admin notifications enqueued.');
    ELSE
        -- Pour les notifications utilisateur, le user_id est l'utilisateur courant
        v_recipient_user_id := v_user_id;

        -- L'email du destinataire est soit dans p_params->'to' (pour les cas spéciaux), soit celui de l'utilisateur courant
        IF p_params ? 'to' AND jsonb_typeof(p_params->'to') = 'string' THEN
            v_recipient_email := p_params->>'to';
            -- Si un 'userId' est passé dans p_params, on l'utilise
            IF p_params ? 'userId' AND jsonb_typeof(p_params->'userId') = 'string' THEN
                BEGIN
                    v_recipient_user_id := (p_params->>'userId')::UUID;
                EXCEPTION WHEN invalid_text_representation THEN
                    RAISE WARNING 'Invalid UUID format for userId in params: %', p_params->>'userId';
                    -- Fallback to current user if userId is invalid UUID
                END;
            END IF;
        ELSE
            SELECT email INTO v_recipient_email FROM auth.users WHERE id = v_user_id;
            IF v_recipient_email IS NULL THEN
                RETURN jsonb_build_object('success', FALSE, 'error', 'Recipient email not found.');
            END IF;
        END IF;

        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            p_template_id,
            v_recipient_user_id,
            v_recipient_email,
            p_params
        );
        RETURN jsonb_build_object('success', TRUE, 'message', 'User notification enqueued.');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;
