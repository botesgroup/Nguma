-- Migration: enable_uuid_ossp
-- Date: 2025-12-19
-- Description: Active l'extension uuid-ossp pour la génération d'UUID.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
