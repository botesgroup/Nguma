-- Migration: Create RPC for Admin Transaction History
-- Date: 2025-12-06
-- Description: Fetches all transactions with user profiles, supporting pagination and filtering.

CREATE OR REPLACE FUNCTION public.get_admin_transaction_history(
    p_search_query TEXT DEFAULT NULL,
    p_type_filter TEXT DEFAULT 'all',
    p_status_filter TEXT DEFAULT 'all',
    p_page_num INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset INTEGER;
    v_total_count INTEGER;
    v_data JSON;
BEGIN
    -- Check if user is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Access denied');
    END IF;

    v_offset := (p_page_num - 1) * p_page_size;

    -- Calculate total count
    SELECT COUNT(*)
    INTO v_total_count
    FROM public.transactions t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE 
        (p_search_query IS NULL OR 
         p.email ILIKE '%' || p_search_query || '%' OR 
         p.full_name ILIKE '%' || p_search_query || '%' OR
         t.id::text ILIKE '%' || p_search_query || '%')
        AND (p_type_filter = 'all' OR t.type = p_type_filter)
        AND (p_status_filter = 'all' OR t.status = p_status_filter);

    -- Fetch data
    SELECT json_agg(row_to_json(t_data))
    INTO v_data
    FROM (
        SELECT 
            t.id,
            t.created_at,
            t.amount,
            t.currency,
            t.type,
            t.status,
            t.method,
            t.proof_url,
            p.email as user_email,
            p.full_name as user_full_name
        FROM public.transactions t
        JOIN public.profiles p ON t.user_id = p.id
        WHERE 
            (p_search_query IS NULL OR 
             p.email ILIKE '%' || p_search_query || '%' OR 
             p.full_name ILIKE '%' || p_search_query || '%' OR
             t.id::text ILIKE '%' || p_search_query || '%')
            AND (p_type_filter = 'all' OR t.type = p_type_filter)
            AND (p_status_filter = 'all' OR t.status = p_status_filter)
        ORDER BY t.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) t_data;

    RETURN json_build_object(
        'data', COALESCE(v_data, '[]'::json),
        'count', v_total_count
    );
END;
$$;
