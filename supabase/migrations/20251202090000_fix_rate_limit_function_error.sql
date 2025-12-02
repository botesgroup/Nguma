-- Migration: Fix Rate Limit Functions
-- Description: Corrige les fonctions check_rate_limit et admin_unblock_rate_limit qui référençaient
--              une colonne 'user_id' inexistante (introduite par une migration erronée).
--              Restaure l'utilisation correcte de la colonne 'identifier'.

-- Fonction RPC pour vérifier et mettre à jour le rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_allowed BOOLEAN := TRUE;
  v_remaining INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_window_interval INTERVAL;
  v_block_interval INTERVAL;
BEGIN
  -- Calculer les intervalles
  v_window_interval := (p_window_minutes || ' minutes')::INTERVAL;
  v_block_interval := (p_window_minutes * 2 || ' minutes')::INTERVAL;

  -- Récupérer l'enregistrement existant
  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE identifier = p_identifier AND action = p_action;

  -- Si actuellement bloqué
  IF v_record.id IS NOT NULL AND v_record.blocked_until IS NOT NULL AND v_record.blocked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'reset_at', v_record.blocked_until,
      'blocked', TRUE
    );
  END IF;

  -- Si pas d'enregistrement OU fenêtre expirée → créer/reset
  IF v_record.id IS NULL OR (now() - v_record.window_start) > v_window_interval THEN
    INSERT INTO public.rate_limits (identifier, action, attempts, window_start)
    VALUES (p_identifier, p_action, 1, now())
    ON CONFLICT (identifier, action) DO UPDATE
    SET 
      attempts = 1, 
      window_start = now(), 
      blocked_until = NULL, 
      updated_at = now()
    RETURNING * INTO v_record;
    
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'remaining', p_max_attempts - 1,
      'reset_at', v_record.window_start + v_window_interval,
      'blocked', FALSE
    );
  END IF;

  -- Incrémenter les tentatives
  UPDATE public.rate_limits
  SET attempts = attempts + 1, updated_at = now()
  WHERE identifier = p_identifier AND action = p_action
  RETURNING * INTO v_record;

  -- Vérifier si limite dépassée
  IF v_record.attempts > p_max_attempts THEN
    -- Bloquer l'utilisateur
    UPDATE public.rate_limits
    SET blocked_until = now() + v_block_interval, updated_at = now()
    WHERE identifier = p_identifier AND action = p_action
    RETURNING blocked_until INTO v_reset_at;
    
    v_allowed := FALSE;
    v_remaining := 0;
  ELSE
    v_remaining := p_max_attempts - v_record.attempts;
    v_reset_at := v_record.window_start + v_window_interval;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at,
    'blocked', NOT v_allowed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction admin pour débloquer un utilisateur
CREATE OR REPLACE FUNCTION public.admin_unblock_rate_limit(
  p_identifier TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Vérifier que l'appelant est admin
  SELECT role INTO v_user_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: action réservée aux administrateurs';
  END IF;

  -- Débloquer l'utilisateur
  UPDATE public.rate_limits
  SET 
    blocked_until = NULL,
    attempts = 0,
    window_start = now(),
    updated_at = now()
  WHERE identifier = p_identifier AND action = p_action;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
