-- Migration: Add 'Dormant' status to investor list filter
-- Date: 2025-12-13
-- Description: 
-- Updates get_investor_list_details to clearly identify users who have money (Deposited) 
-- but no active contracts (Dormant).

CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL, 
  p_page_num INTEGER DEFAULT 1, 
  p_page_size INTEGER DEFAULT 10,
  p_date_from TEXT DEFAULT NULL, 
  p_date_to TEXT DEFAULT NULL, 
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL, 
  param_country TEXT DEFAULT NULL, 
  param_city TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL
) 
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public 
AS $$
DECLARE
  v_offset INTEGER; 
  v_total_count INTEGER; 
  v_result JSONB; 
  v_date_from DATE; 
  v_date_to DATE;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  
  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  WITH profiles_with_status AS (
    SELECT p.*, 
           u.banned_until, 
           w.total_balance, -- We need balance to detect Dormant users
           ci.total_invested, 
           ci.contracts,
           CASE 
                -- 1. ACTIVE: Has at least one active contract
                WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE LOWER(c->>'status') = 'active') THEN 'Active'
                
                -- 2. DORMANT: Has money (> 10$) but NO Active contracts
                -- (Note: They might have old inactive contracts, or no contracts at all. 
                --  But if they have money sitting there, they are dormant/opportunity).
                WHEN COALESCE(w.total_balance, 0) >= 10 THEN 'Dormant'
                
                -- 3. NEW: No contracts at all AND little/no money
                WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN 'New'
                
                -- 4. INACTIVE: Has contracts (history) but nothing active currently (and no balance to invest)
                ELSE 'Inactive'
           END as calculated_status
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    LEFT JOIN public.wallets w ON p.id = w.user_id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested,
             COALESCE(jsonb_agg(jsonb_build_object('status', status)), '[]'::jsonb) as contracts
      FROM public.contracts GROUP BY user_id
    ) ci ON ci.user_id = p.id
  ),
  filtered_profiles AS (
    SELECT * FROM profiles_with_status
    WHERE (p_search_query IS NULL OR first_name ILIKE '%' || p_search_query || '%' OR last_name ILIKE '%' || p_search_query || '%' OR email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR created_at >= v_date_from) AND (v_date_to IS NULL OR created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR COALESCE(total_invested, 0) >= p_min_invested) AND (p_max_invested IS NULL OR COALESCE(total_invested, 0) <= p_max_invested)
      AND (param_country IS NULL OR country = param_country) AND (param_city IS NULL OR city = param_city)
      AND (p_status_filter IS NULL OR calculated_status = p_status_filter)
  )
  SELECT (SELECT COUNT(*) FROM filtered_profiles), COALESCE(jsonb_agg(row_to_json(fp_paginated)), '[]'::jsonb)
  INTO v_total_count, v_result
  FROM (
    SELECT fp.id, fp.first_name, fp.last_name, fp.post_nom, fp.email, fp.phone, fp.country, fp.city,
           fp.banned_until, fp.created_at,
           (SELECT row_to_json(w_sub) FROM public.wallets w_sub WHERE w_sub.user_id = fp.id) as wallet,
           fp.contracts, fp.total_invested, fp.calculated_status
    FROM filtered_profiles fp
    ORDER BY fp.created_at DESC LIMIT p_page_size OFFSET v_offset
  ) AS fp_paginated;
  
  RETURN jsonb_build_object('count', v_total_count, 'data', v_result);
END;
$$;
