-- =====================================================
-- SYSTÈME DE BASE DE CONNAISSANCES (RAG)
-- =====================================================
-- Active pgvector et crée la table pour stocker
-- les documents de la base de connaissances avec embeddings
-- =====================================================

-- Activer l'extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Table pour la base de connaissances
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768), -- Gemini text-embedding-004 produit 768 dimensions
    category TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Index pour la recherche vectorielle (HNSW est plus rapide que IVFFlat pour <1M vecteurs)
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base 
USING hnsw (embedding vector_cosine_ops);

-- Index pour les filtres
CREATE INDEX IF NOT EXISTS knowledge_base_category_idx ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS knowledge_base_is_active_idx ON knowledge_base(is_active);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_base_updated_at_trigger ON knowledge_base;
CREATE TRIGGER knowledge_base_updated_at_trigger
BEFORE UPDATE ON knowledge_base
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_base_updated_at();

-- =====================================================
-- FONCTION DE RECHERCHE SÉMANTIQUE
-- =====================================================

CREATE OR REPLACE FUNCTION match_knowledge_documents(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE kb.is_active = true
        AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent tout faire
DROP POLICY IF EXISTS "Admins can manage knowledge base" ON knowledge_base;
CREATE POLICY "Admins can manage knowledge base"
ON knowledge_base
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- Les utilisateurs peuvent lire les documents actifs (pour debug/transparency)
DROP POLICY IF EXISTS "Users can view active knowledge" ON knowledge_base;
CREATE POLICY "Users can view active knowledge"
ON knowledge_base
FOR SELECT
TO authenticated
USING (is_active = true);

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON TABLE knowledge_base IS 'Base de connaissances pour le système RAG (IA)';
COMMENT ON COLUMN knowledge_base.embedding IS 'Vecteur d''embedding (Gemini text-embedding-004, 768 dimensions)';
COMMENT ON FUNCTION match_knowledge_documents IS 'Recherche sémantique dans la base de connaissances';
