-- Migration: Crée la fonction RPC `export_investor_list` pour l'export CSV
-- Date: 2025-12-12
-- Description: Cette fonction récupère la liste complète des investisseurs correspondant
--              aux filtres fournis, sans aucune pagination, afin de permettre un export complet.

CREATE OR REPLACE FUNCTION public.export_investor_list(
  p_search_query TEXT DEFAULT NULL,
  p_date_from TEXT DEFAULT NULL,
  p_date_to TEXT DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    total_balance NUMERIC,
    invested_balance NUMERIC,
    profit_balance NUMERIC,
    currency TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Autorisation
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  RETURN QUERY
  WITH user_and_contract_info AS (
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.created_at,
      w.total_balance,
      w.invested_balance,
      w.profit_balance,
      w.currency,
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
      AND (p_country IS NULL OR p.country = p_country)
      AND (p_city IS NULL OR p.city = p_city)
    GROUP BY p.id, w.id
  )
  SELECT 
    uci.id,
    uci.first_name,
    uci.last_name,
    uci.email,
    uci.phone,
    uci.total_balance,
    uci.invested_balance,
    uci.profit_balance,
    uci.currency,
    uci.calculated_status as status,
    uci.created_at
  FROM user_and_contract_info uci
  WHERE 
    (p_min_invested IS NULL OR uci.total_invested_calc >= p_min_invested)
    AND (p_max_invested IS NULL OR uci.total_invested_calc <= p_max_invested)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR uci.calculated_status = p_status_filter)
  ORDER BY uci.created_at DESC;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
