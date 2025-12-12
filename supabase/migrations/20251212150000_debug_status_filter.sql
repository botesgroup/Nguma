-- Migration: Ajoute un log de débogage et simplifie la logique de filtrage par statut.
-- Date: 2025-12-12
-- Description: Cette migration ajoute un `RAISE NOTICE` pour logger la valeur du p_status_filter
--              reçue par la fonction. Elle simplifie également la clause WHERE en retirant
--              une condition `p_status_filter = 'all'` qui était redondante.

DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT,INTEGER,INTEGER,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);

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
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_result JSONB;
  v_date_from DATE;
  v_date_to DATE;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;

  -- Log de débogage côté serveur
  RAISE NOTICE '[get_investor_list_details] Received p_status_filter: %', p_status_filter;

  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  WITH profiles_with_status AS (
    SELECT 
      p.*,
      u.banned_until,
      ci.total_invested,
      ci.contracts,
      CASE 
        WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN 'New'
        WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE c->>'status' = 'active') THEN 'Active'
        ELSE 'Inactive'
      END as calculated_status
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    LEFT JOIN (
      SELECT 
        user_id, 
        COALESCE(SUM(amount), 0) as total_invested, 
        COALESCE(jsonb_agg(jsonb_build_object('status', status)), '[]'::jsonb) as contracts
      FROM public.contracts 
      GROUP BY user_id
    ) ci ON ci.user_id = p.id
  ),
  filtered_profiles AS (
    SELECT * FROM profiles_with_status
    WHERE
      (p_search_query IS NULL OR first_name ILIKE '%' || p_search_query || '%' OR last_name ILIKE '%' || p_search_query || '%' OR email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR created_at >= v_date_from)
      AND (v_date_to IS NULL OR created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR COALESCE(total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(total_invested, 0) <= p_max_invested)
      AND (param_country IS NULL OR country = param_country)
      AND (param_city IS NULL OR city = param_city)
      -- Logique de filtrage par statut simplifiée
      AND (p_status_filter IS NULL OR calculated_status = p_status_filter)
  )
  SELECT 
    (SELECT COUNT(*) FROM filtered_profiles),
    COALESCE(jsonb_agg(row_to_json(fp_paginated)), '[]'::jsonb)
  INTO v_total_count, v_result
  FROM (
    SELECT 
        fp.id, fp.first_name, fp.last_name, fp.post_nom, fp.email, fp.phone, fp.country, fp.city,
        fp.banned_until, fp.created_at,
        (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = fp.id) as wallet,
        fp.contracts, fp.total_invested
    FROM filtered_profiles fp
    ORDER BY fp.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) AS fp_paginated;

  RETURN jsonb_build_object('count', v_total_count, 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
