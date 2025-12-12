-- Migration: Hotfix pour la fonction get_investor_list_details
-- Date: 2025-12-12
-- Description: Cette migration contient la version finale, corrigée et optimisée de la fonction.
--              Elle corrige le bug de recherche (p.search_query -> p_search_query) et utilise une CTE
--              pour des performances améliorées, évitant la double exécution des filtres.

CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_date_from TEXT DEFAULT NULL,
  p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_result JSONB;
  v_date_from DATE;
  v_date_to DATE;
BEGIN
  -- Autorisation
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  -- Utilisation d'une CTE pour filtrer les profils une seule fois
  WITH filtered_profiles AS (
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.post_nom,
      p.email,
      p.phone,
      p.country,
      p.city,
      p.banned_until,
      p.created_at,
      ci.contracts,
      ci.total_invested
    FROM public.profiles p
    LEFT JOIN (
      SELECT 
        user_id, 
        COALESCE(SUM(amount), 0) as total_invested, 
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
      AND (p_country IS NULL OR p.country = p_country)
      AND (p_city IS NULL OR p.city = p_city)
      AND (
        p_status_filter IS NULL OR p_status_filter = 'all' OR 
        (
          CASE 
            WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN 'New'
            WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE c->>'status' = 'active') THEN 'Active'
            ELSE 'Inactive'
          END
        ) = p_status_filter
      )
  )
  -- Compter et récupérer les données en une seule passe sur la CTE
  SELECT 
    (SELECT COUNT(*) FROM filtered_profiles),
    COALESCE(jsonb_agg(row_to_json(fp_paginated)), '[]'::jsonb)
  INTO 
    v_total_count,
    v_result
  FROM (
    SELECT 
        fp.id, fp.first_name, fp.last_name, fp.post_nom, fp.email, fp.phone, fp.country, fp.city,
        fp.banned_until,
        fp.created_at,
        (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = fp.id) as wallet,
        fp.contracts,
        fp.total_invested
    FROM filtered_profiles fp
    ORDER BY fp.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) AS fp_paginated;

  -- Construire l'objet JSON final
  RETURN jsonb_build_object('count', v_total_count, 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
