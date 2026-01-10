-- Migration: Correction du calcul des profits retirés (status = 'completed')
-- Date: 2026-01-10
-- Description: Corrige le RPC get_admin_contract_kpis_enriched pour utiliser le bon statut

CREATE OR REPLACE FUNCTION public.get_admin_contract_kpis_enriched(
    p_search_query TEXT DEFAULT NULL,
    p_status_filter TEXT DEFAULT 'all',
    p_date_from TEXT DEFAULT NULL,
    p_date_to TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_count INT;
    v_active_count INT;
    v_total_investment NUMERIC(20,8);
    v_total_profits_paid NUMERIC(20,8);
    v_total_profits_available NUMERIC(20,8);
    v_total_profits_withdrawn NUMERIC(20,8);
    v_date_from DATE;
    v_date_to DATE;
    v_base_query TEXT;
BEGIN
    -- Authorization
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé.';
    END IF;

    -- Safe casting of text dates
    BEGIN
        v_date_from := CASE WHEN p_date_from IS NOT NULL AND p_date_from <> '' THEN p_date_from::DATE ELSE NULL END;
        v_date_to := CASE WHEN p_date_to IS NOT NULL AND p_date_to <> '' THEN p_date_to::DATE ELSE NULL END;
    EXCEPTION WHEN OTHERS THEN
        v_date_from := NULL;
        v_date_to := NULL;
    END;

    -- Base query for filtering
    v_base_query := '
        FROM contracts c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE (
            $1 IS NULL OR $1 = '''' OR
            p.first_name ILIKE ''%'' || $1 || ''%'' OR
            p.last_name ILIKE ''%'' || $1 || ''%'' OR
            p.email ILIKE ''%'' || $1 || ''%'' OR
            c.id::text ILIKE ''%'' || $1 || ''%''
        ) AND (
            $2 IS NULL OR $2 = ''all'' OR c.status::text = $2
        ) AND (
            $3 IS NULL OR c.created_at >= $3::timestamp
        ) AND (
            $4 IS NULL OR c.created_at < ($4 + interval ''1 day'')::timestamp
        )
    ';

    -- Total count
    EXECUTE 'SELECT COUNT(*) ' || v_base_query 
    INTO v_total_count 
    USING p_search_query, p_status_filter, v_date_from, v_date_to;

    -- Active count
    EXECUTE 'SELECT COUNT(*) ' || v_base_query || ' AND c.status = ''active''' 
    INTO v_active_count 
    USING p_search_query, p_status_filter, v_date_from, v_date_to;

    -- Total investment
    EXECUTE 'SELECT COALESCE(SUM(c.amount), 0) ' || v_base_query 
    INTO v_total_investment 
    USING p_search_query, p_status_filter, v_date_from, v_date_to;

    -- Total profits paid
    EXECUTE 'SELECT COALESCE(SUM(c.total_profit_paid), 0) ' || v_base_query 
    INTO v_total_profits_paid 
    USING p_search_query, p_status_filter, v_date_from, v_date_to;

    -- Total profits available (non retirés) - Somme des profit_balance des wallets
    SELECT COALESCE(SUM(w.profit_balance), 0)
    INTO v_total_profits_available
    FROM wallets w
    WHERE EXISTS (
        SELECT 1 FROM contracts c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.user_id = w.user_id
        AND (
            p_search_query IS NULL OR p_search_query = '' OR
            p.first_name ILIKE '%' || p_search_query || '%' OR
            p.last_name ILIKE '%' || p_search_query || '%' OR
            p.email ILIKE '%' || p_search_query || '%' OR
            c.id::text ILIKE '%' || p_search_query || '%'
        )
        AND (p_status_filter IS NULL OR p_status_filter = 'all' OR c.status::text = p_status_filter)
        AND (v_date_from IS NULL OR c.created_at >= v_date_from::timestamp)
        AND (v_date_to IS NULL OR c.created_at < (v_date_to + interval '1 day')::timestamp)
    );

    -- Total profits withdrawn (retirés) - Somme des retraits VALIDÉS (status = 'completed')
    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_total_profits_withdrawn
    FROM transactions t
    WHERE t.type = 'withdrawal'
    AND t.status = 'completed'  -- CORRECTION: 'completed' au lieu de 'approved'
    AND EXISTS (
        SELECT 1 FROM contracts c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.user_id = t.user_id
        AND (
            p_search_query IS NULL OR p_search_query = '' OR
            p.first_name ILIKE '%' || p_search_query || '%' OR
            p.last_name ILIKE '%' || p_search_query || '%' OR
            p.email ILIKE '%' || p_search_query || '%' OR
            c.id::text ILIKE '%' || p_search_query || '%'
        )
        AND (p_status_filter IS NULL OR p_status_filter = 'all' OR c.status::text = p_status_filter)
        AND (v_date_from IS NULL OR c.created_at >= v_date_from::timestamp)
        AND (v_date_to IS NULL OR c.created_at < (v_date_to + interval '1 day')::timestamp)
    );

    RETURN jsonb_build_object(
        'total_count', v_total_count,
        'active_count', v_active_count,
        'total_investment', v_total_investment,
        'total_profits_paid', v_total_profits_paid,
        'total_profits_available', v_total_profits_available,
        'total_profits_withdrawn', v_total_profits_withdrawn
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_contract_kpis_enriched(TEXT, TEXT, TEXT, TEXT) TO authenticated;
