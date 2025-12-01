-- =====================================================
-- CORRECTION SYSTÈME DE CHAT
-- =====================================================
-- Correction de la fonction send_chat_message qui référençait
-- une colonne inexistante 'full_name'
-- =====================================================

-- Fonction 3: Envoyer un message (CORRIGÉE)
CREATE OR REPLACE FUNCTION send_chat_message(
    p_conversation_id UUID,
    p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_is_admin BOOLEAN;
    v_message_id UUID;
    v_conversation_user_id UUID;
    v_sender_name TEXT;
BEGIN
    v_sender_id := auth.uid();
    
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Vérifier si l'utilisateur est admin
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = v_sender_id AND role = 'admin'
    ) INTO v_is_admin;
    
    -- Récupérer l'user_id de la conversation
    SELECT user_id INTO v_conversation_user_id
    FROM chat_conversations
    WHERE id = p_conversation_id;
    
    IF v_conversation_user_id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found';
    END IF;
    
    -- Vérifier que l'utilisateur a le droit d'envoyer un message
    IF NOT v_is_admin AND v_sender_id != v_conversation_user_id THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    -- Insérer le message
    INSERT INTO chat_messages (conversation_id, sender_id, message, is_admin)
    VALUES (p_conversation_id, v_sender_id, p_message, v_is_admin)
    RETURNING id INTO v_message_id;
    
    -- Mettre à jour la conversation
    UPDATE chat_conversations
    SET 
        last_message_at = now(),
        updated_at = now(),
        user_unread_count = CASE 
            WHEN v_is_admin THEN user_unread_count + 1 
            ELSE user_unread_count 
        END,
        admin_unread_count = CASE 
            WHEN v_is_admin THEN admin_unread_count 
            ELSE admin_unread_count + 1 
        END,
        status = 'open' -- Réouvrir si fermée
    WHERE id = p_conversation_id;
    
    -- Récupérer le nom de l'expéditeur pour la notification
    SELECT 
        COALESCE(first_name || ' ' || last_name, email) INTO v_sender_name
    FROM profiles 
    WHERE id = v_sender_id;
    
    -- Créer une notification pour le destinataire
    IF v_is_admin THEN
        -- Notifier l'utilisateur
        INSERT INTO notifications (user_id, type, priority, message, link_to)
        VALUES (
            v_conversation_user_id,
            'support',
            'high',
            'Nouveau message de support de l''administration',
            '/support'
        );
    ELSE
        -- Notifier tous les admins
        INSERT INTO notifications (user_id, type, priority, message, link_to)
        SELECT 
            ur.user_id,
            'support',
            'medium',
            'Nouveau message de support de ' || v_sender_name,
            '/admin/support?conversation=' || p_conversation_id
        FROM user_roles ur
        WHERE ur.role = 'admin';
    END IF;
    
    RETURN v_message_id;
END;
$$;

-- Fonction 2: Récupérer toutes les conversations pour les admins (CORRIGÉE AUSSI)
CREATE OR REPLACE FUNCTION get_admin_conversations(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    subject TEXT,
    status TEXT,
    last_message_at TIMESTAMPTZ,
    admin_unread_count INTEGER,
    created_at TIMESTAMPTZ,
    last_message_preview TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        p.email,
        COALESCE(p.first_name || ' ' || p.last_name, p.email) as user_full_name,
        c.subject,
        c.status,
        c.last_message_at,
        c.admin_unread_count,
        c.created_at,
        (
            SELECT m.message
            FROM chat_messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
        ) as last_message_preview
    FROM chat_conversations c
    INNER JOIN profiles p ON p.id = c.user_id
    WHERE (p_status IS NULL OR c.status = p_status)
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
END;
$$;
