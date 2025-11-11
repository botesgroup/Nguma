-- Debug version of the function to isolate the parameter issue.
-- This version takes no parameters and returns a simple list.

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
    v_contracts JSON;
    v_total_count BIGINT;
BEGIN
    -- Authorization
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé.';
    END IF;

    -- Get total count (simplified)
    SELECT COUNT(*) INTO v_total_count FROM contracts;

    -- Get paginated data (simplified)
    SELECT jsonb_agg(contract_data)
    INTO v_contracts
    FROM (
        SELECT
            c.*,
            p.first_name,
            p.last_name,
            p.email
        FROM contracts c
        JOIN profiles p ON c.user_id = p.id
        ORDER BY c.created_at DESC
        LIMIT 10
    ) as contract_data;

    -- Return the final JSON object
    RETURN jsonb_build_object(
        'data', COALESCE(v_contracts, '[]'::jsonb),
        'count', v_total_count
    );
END;
$$;
