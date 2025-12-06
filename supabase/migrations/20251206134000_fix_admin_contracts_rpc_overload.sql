-- Drop the old version of the function to avoid overloading ambiguity
DROP FUNCTION IF EXISTS public.admin_get_all_contracts(TEXT, TEXT, INT, INT);

-- Recreate the function with the new signature and date filtering
CREATE OR REPLACE FUNCTION public.admin_get_all_contracts(
    p_search_query TEXT,
    p_status_filter TEXT,
    p_page_num INT,
    p_page_size INT,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
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
    -- 1. Authorization: Ensure the caller is an admin.
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé. Seuls les administrateurs peuvent voir tous les contrats.';
    END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    -- 2. Build the base query with placeholders for parameters
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

    -- 3. Get total count for pagination using the USING clause
    EXECUTE 'SELECT COUNT(*) ' || v_query INTO v_total_count USING p_search_query, p_status_filter, p_date_from, p_date_to;

    -- 4. Get paginated data using the USING clause
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
    ' INTO v_contracts USING p_search_query, p_status_filter, p_date_from, p_date_to, p_page_size, v_offset;

    -- 5. Return the final JSON object
    RETURN jsonb_build_object(
        'data', COALESCE(v_contracts, '[]'::jsonb),
        'count', v_total_count
    );
END;
$$;
