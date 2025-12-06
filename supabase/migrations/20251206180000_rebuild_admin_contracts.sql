-- Rebuild Admin Contracts Module
-- 1. Clean up ALL legacy functions to remove ambiguity
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Drop all versions of admin_get_all_contracts
    FOR func_record IN
        SELECT oid::regprocedure::text as func_signature
        FROM pg_proc
        WHERE proname = 'admin_get_all_contracts'
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.func_signature;
    END LOOP;

    -- Drop all versions of admin_get_contracts_v2
    FOR func_record IN
        SELECT oid::regprocedure::text as func_signature
        FROM pg_proc
        WHERE proname = 'admin_get_contracts_v2'
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.func_signature;
    END LOOP;
END $$;

-- 2. Create the new, robust function: admin_list_contracts
-- We use TEXT for dates to avoid any client-side casting issues.
CREATE OR REPLACE FUNCTION public.admin_list_contracts(
    p_search_query TEXT,
    p_status_filter TEXT,
    p_page_num INT,
    p_page_size INT,
    p_date_from TEXT DEFAULT NULL,
    p_date_to TEXT DEFAULT NULL
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
    v_date_from DATE;
    v_date_to DATE;
BEGIN
    -- Authorization: Ensure the caller is an admin.
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé. Seuls les administrateurs peuvent voir tous les contrats.';
    END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    -- Safe casting of text dates to actual dates
    BEGIN
        IF p_date_from IS NOT NULL AND p_date_from <> '' THEN
            v_date_from := p_date_from::DATE;
        ELSE
            v_date_from := NULL;
        END IF;

        IF p_date_to IS NOT NULL AND p_date_to <> '' THEN
            v_date_to := p_date_to::DATE;
        ELSE
            v_date_to := NULL;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If casting fails, ignore the date filter (fail safe)
        v_date_from := NULL;
        v_date_to := NULL;
    END;

    -- Build the base query
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
            c.status = $2
        ) AND (
            $3 IS NULL OR c.created_at >= $3::timestamp
        ) AND (
            $4 IS NULL OR c.created_at < ($4 + interval ''1 day'')::timestamp
        )
    ';

    -- Get total count
    EXECUTE 'SELECT COUNT(*) ' || v_query INTO v_total_count USING p_search_query, p_status_filter, v_date_from, v_date_to;

    -- Get paginated data
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
            LIMIT $5
            OFFSET $6
        ) as contract_data
    ' INTO v_contracts USING p_search_query, p_status_filter, v_date_from, v_date_to, p_page_size, v_offset;

    -- Return result
    RETURN jsonb_build_object(
        'data', COALESCE(v_contracts, '[]'::jsonb),
        'count', v_total_count
    );
END;
$$;
