-- Migration pour activer l'historique de conversations multiples
-- Permet à un utilisateur d'avoir plusieurs conversations au lieu d'une seule

-- Supprimer la contrainte qui limitait à 1 conversation par utilisateur
ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_user_id_key;

-- Ajouter une colonne pour le titre de la conversation
-- Le titre sera généré automatiquement depuis le premier message si vide
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS title TEXT;

-- Index pour améliorer les performances lors du chargement de l'historique
-- Optimise la requête : "SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY created_at DESC"
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_created 
ON chat_conversations(user_id, created_at DESC);

-- Index pour améliorer les performances lors du tri par dernière activité
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_last_message 
ON chat_conversations(user_id, last_message_at DESC NULLS LAST);
