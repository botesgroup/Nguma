-- Migration: Rend la comparaison des statuts insensible à la casse.
-- Date: 2025-12-12
-- Description: Cette migration met à jour plusieurs fonctions pour utiliser LOWER(status) = 'active'
--              lors de la recherche de contrats actifs. Cela corrige un bug potentiel où des statuts comme
--              'Active' (avec une majuscule) n'étaient pas pris en compte.

-- 1. Mise à jour de get_contract_dashboard_stats
DROP FUNCTION IF EXISTS public.get_contract_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_contract_dashboard_stats()
RETURNS TABLE (
    active_contracts_count BIGINT,
    total_capital_invested NUMERIC,
    total_insurance_fees_collected NUMERIC,
    total_liquid_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.contracts WHERE LOWER(status) = 'active') AS active_contracts_count,
        (SELECT COALESCE(SUM(amount), 0) FROM public.contracts WHERE LOWER(status) = 'active') AS total_capital_invested,
        (SELECT COALESCE(SUM(insurance_fee_paid), 0) FROM public.contracts WHERE is_insured = TRUE) AS total_insurance_fees_collected,
        (SELECT COALESCE(SUM(total_balance), 0) FROM public.wallets) AS total_liquid_balance;
END;
$$;


-- 2. Mise à jour de get_investor_list_details
DROP FUNCTION IF EXISTS public.get_investor_list_details(TEXT,INTEGER,INTEGER,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT);
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT, p_page_num INTEGER, p_page_size INTEGER, p_date_from TEXT, p_date_to TEXT,
  p_min_invested NUMERIC, p_max_invested NUMERIC, param_country TEXT, param_city TEXT, p_status_filter TEXT
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER; v_total_count INTEGER; v_result JSONB; v_date_from DATE; v_date_to DATE;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé.'; END IF;
  v_offset := (p_page_num - 1) * p_page_size;
  v_date_from := NULLIF(p_date_from, '')::DATE;
  v_date_to := NULLIF(p_date_to, '')::DATE;

  WITH profiles_with_status AS (
    SELECT p.*, u.banned_until, ci.total_invested, ci.contracts,
           CASE 
             WHEN ci.contracts IS NULL OR jsonb_array_length(ci.contracts) = 0 THEN 'New'
             WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(ci.contracts) AS c WHERE LOWER(c->>'status') = 'active') THEN 'Active'
             ELSE 'Inactive'
           END as calculated_status
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested, 
             COALESCE(jsonb_agg(jsonb_build_object('status', status)), '[]'::jsonb) as contracts
      FROM public.contracts GROUP BY user_id
    ) ci ON ci.user_id = p.id
  ),
  filtered_profiles AS (
    SELECT * FROM profiles_with_status
    WHERE
      (p_search_query IS NULL OR first_name ILIKE '%' || p_search_query || '%' OR last_name ILIKE '%' || p_search_query || '%' OR email ILIKE '%' || p_search_query || '%')
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
           (SELECT row_to_json(w) FROM public.wallets w WHERE w.user_id = fp.id) as wallet,
           fp.contracts, fp.total_invested
    FROM filtered_profiles fp
    ORDER BY fp.created_at DESC LIMIT p_page_size OFFSET v_offset
  ) AS fp_paginated;

  RETURN jsonb_build_object('count', v_total_count, 'data', v_result);
END;
$$ LANGUAGE plpgsql;


-- 3. Mise à jour de get_upcoming_profits
DROP FUNCTION IF EXISTS public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
)
RETURNS TABLE ( user_id UUID, contract_id UUID, amount NUMERIC, expected_date TIMESTAMPTZ, contract_name TEXT )
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.user_id, c.id as contract_id, (c.amount * c.monthly_rate) as amount,
        (c.start_date + (interval '1 month' * (c.months_paid + 1))) as expected_date,
        'Contract ' || c.id::text as contract_name
    FROM public.contracts c
    WHERE LOWER(c.status) = 'active'
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN start_date AND end_date;
END;
$$;
