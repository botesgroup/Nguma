-- Migration: Corrige les filtres de localisation dans get_investor_list_details et export_investor_list
-- Date: 2025-12-12
-- Description: Cette migration corrige un bug de "shadowing" de variable où les paramètres (p_country, p_city)
--              avaient le même nom que les colonnes, rendant les filtres de localisation inopérants.
--              Les paramètres sont renommés en param_country et param_city pour lever l'ambiguïté.
--              La correction est appliquée à la fois à get_investor_list_details et à export_investor_list.

-- Suppression de l'ancienne version de la fonction pour permettre le renommage des paramètres
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT,INTEGER,INTEGER,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);
DROP FUNCTION IF EXISTS public.export_investor_list(TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);

-- Correction pour get_investor_list_details
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_date_from TEXT DEFAULT NULL,
  p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  param_country TEXT DEFAULT NULL, -- Renommé
  param_city TEXT DEFAULT NULL,    -- Renommé
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

  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  WITH filtered_profiles AS (
    SELECT 
      p.id, p.first_name, p.last_name, p.post_nom, p.email, p.phone, p.country, p.city,
      u.banned_until, p.created_at, ci.contracts, ci.total_invested
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested, 
             COALESCE(jsonb_agg(jsonb_build_object('status', status)), '[]'::jsonb) as contracts
      FROM public.contracts 
      GROUP BY user_id
    ) ci ON ci.user_id = p.id
    WHERE
      (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR p.email ILIKE '%' || p_search_query || '%')
      AND (v_date_from IS NULL OR p.created_at >= v_date_from)
      AND (v_date_to IS NULL OR p.created_at < v_date_to + INTERVAL '1 day')
      AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
      AND (param_country IS NULL OR p.country = param_country) -- Corrigé
      AND (param_city IS NULL OR p.city = param_city)          -- Corrigé
      AND (
        p_status_filter IS NULL OR p_status_filter = 'all' OR 
        ((CASE WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN 'New' WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE c->>'status' = 'active') THEN 'Active' ELSE 'Inactive' END)) = p_status_filter
      )
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


-- Correction pour export_investor_list
CREATE OR REPLACE FUNCTION public.export_investor_list(
  p_search_query TEXT DEFAULT NULL,
  p_date_from TEXT DEFAULT NULL,
  p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  param_country TEXT DEFAULT NULL, -- Renommé
  param_city TEXT DEFAULT NULL,    -- Renommé
  p_status_filter TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID, first_name TEXT, last_name TEXT, email TEXT, phone TEXT,
    total_balance NUMERIC, invested_balance NUMERIC, profit_balance NUMERIC,
    currency TEXT, status TEXT, created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;

  RETURN QUERY
  WITH user_and_contract_info AS (
    SELECT 
      p.id, p.first_name, p.last_name, p.email, p.phone, p.created_at,
      w.total_balance, w.invested_balance, w.profit_balance, w.currency,
      p.country, p.city, -- Ajout pour le filtrage
      COALESCE(SUM(c.amount) OVER(PARTITION BY p.id), 0) as total_invested_calc,
      CASE 
        WHEN COUNT(c.id) = 0 THEN 'New'
        WHEN EXISTS(SELECT 1 FROM public.contracts c_active WHERE c_active.user_id = p.id AND c_active.status = 'active') THEN 'Active'
        ELSE 'Inactive'
      END as calculated_status
    FROM public.profiles p
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN public.contracts c ON c.user_id = p.id
    WHERE
      (p_search_query IS NULL OR p.first_name ILIKE '%' || p_search_query || '%' OR p.last_name ILIKE '%' || p_search_query || '%' OR p.email ILIKE '%' || p_search_query || '%')
      AND (p_date_from IS NULL OR p.created_at >= (p_date_from)::DATE)
      AND (p_date_to IS NULL OR p.created_at < (p_date_to)::DATE + INTERVAL '1 day')
      AND (param_country IS NULL OR p.country = param_country) -- Corrigé
      AND (param_city IS NULL OR p.city = param_city)          -- Corrigé
    GROUP BY p.id, w.id
  )
  SELECT 
    uci.id, uci.first_name, uci.last_name, uci.email, uci.phone,
    uci.total_balance, uci.invested_balance, uci.profit_balance,
    uci.currency, uci.calculated_status as status, uci.created_at
  FROM user_and_contract_info uci
  WHERE 
    (p_min_invested IS NULL OR uci.total_invested_calc >= p_min_invested)
    AND (p_max_invested IS NULL OR uci.total_invested_calc <= p_max_invested)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR uci.calculated_status = p_status_filter)
  ORDER BY uci.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
