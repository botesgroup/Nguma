-- Migration: Fix Mark as Read Notification Logic
-- Description: Updates the mark_conversation_as_read function to also mark related support notifications as read.

CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Vérifier si l'utilisateur est admin
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_user_id AND role = 'admin'
    ) INTO v_is_admin;

    -- Marquer les messages comme lus
    UPDATE chat_messages
    SET read_at = now()
    WHERE conversation_id = p_conversation_id
    AND read_at IS NULL
    AND sender_id != v_user_id;

    -- Réinitialiser le compteur approprié et marquer les notifications comme lues
    IF v_is_admin THEN
        UPDATE chat_conversations
        SET admin_unread_count = 0
        WHERE id = p_conversation_id;

        -- Marquer les notifications de l'admin comme lues
        UPDATE notifications
        SET is_read = true
        WHERE user_id = v_user_id AND type = 'support';

    ELSE
        UPDATE chat_conversations
        SET user_unread_count = 0
        WHERE id = p_conversation_id;

        -- Marquer les notifications de l'utilisateur comme lues
        UPDATE notifications
        SET is_read = true
        WHERE user_id = v_user_id AND type = 'support' AND link_to = '/support';
    END IF;
END;
$$;
