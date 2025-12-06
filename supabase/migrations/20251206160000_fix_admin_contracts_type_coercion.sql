
-- Migration: Corrige le conflit de type dans la fonction admin_get_all_contracts
-- Date: 2025-12-06
-- Description: La fonction échouait avec une erreur de type "cannot_coerce" (42846)
-- car elle comparait une colonne de type ENUM (c.status) avec un paramètre de type TEXT (p_status_filter)
-- dans une requête dynamique.
-- Ce correctif convertit explicitement la colonne ENUM en texte pour la comparaison.

-- Supprimer l'ancienne fonction pour assurer une recréation propre
DROP FUNCTION IF EXISTS public.admin_get_all_contracts(TEXT, TEXT, INT, INT);

-- Recréer la fonction avec la correction
CREATE OR REPLACE FUNCTION public.admin_get_all_contracts(
    p_search_query TEXT,
    p_status_filter TEXT,
    p_page_num INT,
    p_page_size INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offset INT;
    v_contracts JSON;
    v_total_count BIGINT;
    v_query TEXT;
BEGIN
    -- 1. Authorization
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé. Seuls les administrateurs peuvent voir tous les contrats.';
    END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    -- 2. Build the base query
    -- CORRECTION: Ajout de 'c.status::text' pour la comparaison
    v_query := '
        FROM contracts c
        JOIN profiles p ON c.user_id = p.id
        WHERE (
            $1 IS NULL OR $1 = '''' OR
            p.first_name ILIKE ''%'' || $1 || ''%'' OR
            p.last_name ILIKE ''%'' || $1 || ''%'' OR
            p.email ILIKE ''%'' || $1 || ''%'' OR
            c.id::text ILIKE ''%'' || $1 || ''%''
        ) AND (
            $2 IS NULL OR $2 = ''all'' OR
            c.status::text = $2 -- La correction est ici
        )
    ';

    -- 3. Get total count
    EXECUTE 'SELECT COUNT(*) ' || v_query INTO v_total_count USING p_search_query, p_status_filter;

    -- 4. Get paginated data
    EXECUTE '
        SELECT jsonb_agg(contract_data)
        FROM (
            SELECT
                c.*,
                p.first_name,
                p.last_name,
                p.email
            ' || v_query || '
            ORDER BY c.created_at DESC
            LIMIT $3
            OFFSET $4
        ) as contract_data
    ' INTO v_contracts USING p_search_query, p_status_filter, p_page_size, v_offset;

    -- 5. Return final JSON
    RETURN jsonb_build_object(
        'data', COALESCE(v_contracts, '[]'::jsonb),
        'count', v_total_count
    );
END;
$$;
