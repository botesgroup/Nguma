-- Migration: Ajout de la colonne city et filtres pays/ville
-- La table profiles a déjà 'country', on ajoute 'city'

-- 1. Ajouter la colonne city si elle n'existe pas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;

-- 2. Mettre à jour get_investor_list_details avec filtres pays/ville
CREATE OR REPLACE FUNCTION public.get_investor_list_details(
  p_search_query TEXT DEFAULT NULL,
  p_page_num INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_min_invested NUMERIC DEFAULT NULL,
  p_max_invested NUMERIC DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_result JSONB;
BEGIN
  -- Vérifier que l'appelant est admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé: cette fonction est réservée aux administrateurs';
  END IF;

  v_offset := (p_page_num - 1) * p_page_size;

  -- Count total matching records
  SELECT COUNT(*) INTO v_total_count
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  LEFT JOIN (
    SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
    FROM public.contracts
    WHERE status = 'active'
    GROUP BY user_id
  ) ci ON ci.user_id = p.id
  WHERE 
    (p_search_query IS NULL OR p_search_query = '' OR 
      p.first_name ILIKE '%' || p_search_query || '%' OR 
      p.last_name ILIKE '%' || p_search_query || '%' OR 
      u.email ILIKE '%' || p_search_query || '%')
    AND (p_date_from IS NULL OR p.created_at >= p_date_from)
    AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
    AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
    AND (p_country IS NULL OR p_country = '' OR p.country ILIKE '%' || p_country || '%')
    AND (p_city IS NULL OR p_city = '' OR p.city ILIKE '%' || p_city || '%');

  -- Get paginated data
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(row_data), '[]'::jsonb),
    'count', v_total_count
  ) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'post_nom', p.post_nom,
      'email', u.email,
      'phone', p.phone,
      'country', p.country,
      'city', p.city,
      'banned_until', u.banned_until,
      'created_at', p.created_at,
      'wallet', CASE WHEN w.id IS NOT NULL THEN jsonb_build_object(
        'total_balance', COALESCE(w.total_balance, 0),
        'invested_balance', COALESCE(w.invested_balance, 0),
        'profit_balance', COALESCE(w.profit_balance, 0),
        'currency', w.currency
      ) ELSE NULL END,
      'contracts', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('status', c.status)), '[]'::jsonb)
        FROM public.contracts c
        WHERE c.user_id = p.id
      ),
      'total_invested', COALESCE(ci.total_invested, 0)
    ) as row_data
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    LEFT JOIN public.wallets w ON w.user_id = p.id
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount), 0) as total_invested
      FROM public.contracts
      WHERE status = 'active'
      GROUP BY user_id
    ) ci ON ci.user_id = p.id
    WHERE 
      (p_search_query IS NULL OR p_search_query = '' OR 
        p.first_name ILIKE '%' || p_search_query || '%' OR 
        p.last_name ILIKE '%' || p_search_query || '%' OR 
        u.email ILIKE '%' || p_search_query || '%')
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at <= p_date_to)
      AND (p_min_invested IS NULL OR COALESCE(ci.total_invested, 0) >= p_min_invested)
      AND (p_max_invested IS NULL OR COALESCE(ci.total_invested, 0) <= p_max_invested)
      AND (p_country IS NULL OR p_country = '' OR p.country ILIKE '%' || p_country || '%')
      AND (p_city IS NULL OR p_city = '' OR p.city ILIKE '%' || p_city || '%')
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
