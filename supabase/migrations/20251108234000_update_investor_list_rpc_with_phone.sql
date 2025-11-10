-- This migration updates the get_investor_list_details RPC function
-- to include the 'phone' number from the profiles table.

CREATE OR REPLACE FUNCTION public.get_investor_list_details(
    p_search_query TEXT,
    p_page_num INT,
    p_page_size INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset INT;
    v_investors JSON;
    v_total_count BIGINT;
BEGIN
    -- Ensure the caller is an admin
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé.';
    END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    -- Perform a full count first for pagination
    SELECT COUNT(*)
    INTO v_total_count
    FROM
        profiles p
    JOIN
        auth.users u ON p.id = u.id
    WHERE
        p_search_query IS NULL OR p_search_query = '' OR
        p.first_name ILIKE '%' || p_search_query || '%' OR
        p.last_name ILIKE '%' || p_search_query || '%' OR
        p.post_nom ILIKE '%' || p_search_query || '%' OR
        u.email ILIKE '%' || p_search_query || '%';

    -- Then, fetch the paginated data
    SELECT jsonb_agg(investor_data)
    INTO v_investors
    FROM (
        SELECT
            p.id,
            u.email,
            p.first_name,
            p.last_name,
            p.post_nom,
            p.phone, -- Added phone number
            p.created_at,
            u.banned_until,
            (
                SELECT jsonb_build_object(
                    'total_balance', w.total_balance,
                    'invested_balance', w.invested_balance,
                    'profit_balance', w.profit_balance,
                    'currency', w.currency
                )
                FROM wallets w
                WHERE w.user_id = p.id
                LIMIT 1
            ) as wallet,
            (
                SELECT jsonb_agg(jsonb_build_object('status', c.status))
                FROM contracts c
                WHERE c.user_id = p.id
            ) as contracts
        FROM
            profiles p
        JOIN
            auth.users u ON p.id = u.id
        WHERE
            p_search_query IS NULL OR p_search_query = '' OR
            p.first_name ILIKE '%' || p_search_query || '%' OR
            p.last_name ILIKE '%' || p_search_query || '%' OR
            p.post_nom ILIKE '%' || p_search_query || '%' OR
            u.email ILIKE '%' || p_search_query || '%'
        ORDER BY
            p.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) as investor_data;

    RETURN jsonb_build_object('data', COALESCE(v_investors, '[]'::jsonb), 'count', v_total_count);
END;
$$;
