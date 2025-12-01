-- =====================================================
-- SYSTÈME DE CHAT - NGUMA
-- =====================================================
-- Migration pour créer le système de chat complet
-- Date: 2025-11-28
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- Table des conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT DEFAULT 'Conversation de support',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    last_message_at TIMESTAMPTZ,
    user_unread_count INTEGER DEFAULT 0,
    admin_unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Un utilisateur ne peut avoir qu'une seule conversation active
    UNIQUE(user_id)
);

-- Table des messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (length(trim(message)) > 0),
    is_admin BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 2. INDEX POUR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies pour chat_conversations
-- Utilisateurs: voir uniquement leur conversation
DROP POLICY IF EXISTS "Users can view own conversation" ON chat_conversations;
CREATE POLICY "Users can view own conversation"
    ON chat_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins: voir toutes les conversations
DROP POLICY IF EXISTS "Admins can view all conversations" ON chat_conversations;
CREATE POLICY "Admins can view all conversations"
    ON chat_conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Utilisateurs: créer uniquement leur conversation
DROP POLICY IF EXISTS "Users can create own conversation" ON chat_conversations;
CREATE POLICY "Users can create own conversation"
    ON chat_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Utilisateurs et admins: mettre à jour leur conversation
DROP POLICY IF EXISTS "Users can update own conversation" ON chat_conversations;
CREATE POLICY "Users can update own conversation"
    ON chat_conversations
    FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policies pour chat_messages
-- Lecture: participants seulement (utilisateur concerné OU admin)
DROP POLICY IF EXISTS "Users can view messages in their conversation" ON chat_messages;
CREATE POLICY "Users can view messages in their conversation"
    ON chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations
            WHERE id = conversation_id
            AND (
                user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles
                    WHERE user_id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

-- Écriture: participants seulement
DROP POLICY IF EXISTS "Users can send messages in their conversation" ON chat_messages;
CREATE POLICY "Users can send messages in their conversation"
    ON chat_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM chat_conversations
            WHERE id = conversation_id
            AND (
                user_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM user_roles
                    WHERE user_id = auth.uid() AND role = 'admin'
                )
            )
        )
    );


-- =====================================================
-- 4. FONCTIONS RPC
-- =====================================================

-- Fonction 1: Récupérer ou créer la conversation d'un utilisateur
CREATE OR REPLACE FUNCTION get_or_create_user_conversation()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_conversation_id UUID;
BEGIN
    -- Récupérer l'ID utilisateur courant
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Chercher une conversation existante
    SELECT id INTO v_conversation_id
    FROM chat_conversations
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- Si pas trouvée, créer une nouvelle conversation
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_conversations (user_id, subject)
        VALUES (v_user_id, 'Conversation de support')
        RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$;

-- Fonction 2: Récupérer toutes les conversations pour les admins
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
        p.full_name,
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

-- Fonction 3: Envoyer un message
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
            'Nouveau message de support de ' || (SELECT full_name FROM profiles WHERE id = v_sender_id),
            '/admin/support?conversation=' || p_conversation_id
        FROM user_roles ur
        WHERE ur.role = 'admin';
    END IF;
    
    RETURN v_message_id;
END;
$$;

-- Fonction 4: Marquer une conversation comme lue
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
    
    -- Réinitialiser le compteur approprié
    IF v_is_admin THEN
        UPDATE chat_conversations
        SET admin_unread_count = 0
        WHERE id = p_conversation_id;
    ELSE
        UPDATE chat_conversations
        SET user_unread_count = 0
        WHERE id = p_conversation_id;
    END IF;
END;
$$;

-- Fonction 5: Fermer une conversation (admin seulement)
CREATE OR REPLACE FUNCTION close_conversation(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;
    
    UPDATE chat_conversations
    SET 
        status = 'closed',
        updated_at = now()
    WHERE id = p_conversation_id;
END;
$$;

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_chat_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_conversation_timestamp ON chat_conversations;
CREATE TRIGGER trigger_update_chat_conversation_timestamp
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_conversation_timestamp();


-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON TABLE chat_conversations IS 'Conversations de support entre utilisateurs et administrateurs';
COMMENT ON TABLE chat_messages IS 'Messages des conversations de support';
COMMENT ON FUNCTION get_or_create_user_conversation() IS 'Récupère ou crée la conversation d''un utilisateur';
COMMENT ON FUNCTION get_admin_conversations(TEXT) IS 'Liste toutes les conversations pour les admins';
COMMENT ON FUNCTION send_chat_message(UUID, TEXT) IS 'Envoie un message dans une conversation';
COMMENT ON FUNCTION mark_conversation_as_read(UUID) IS 'Marque tous les messages d''une conversation comme lus';
COMMENT ON FUNCTION close_conversation(UUID) IS 'Ferme une conversation (admin seulement)';
