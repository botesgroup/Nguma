-- Migration: Fonctions de Rate Limiting
-- Description: Crée les fonctions check_rate_limit et admin_unblock_rate_limit pour la gestion des limites de taux

-- Supprimer les anciennes versions des fonctions si elles existent
-- (nécessaire car on ne peut pas changer le type de retour avec CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.admin_unblock_rate_limit(TEXT, TEXT);

-- Fonction pour vérifier et incrémenter le compteur de rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_action TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_reset_at TIMESTAMP WITH TIME ZONE;
    v_remaining INTEGER;
    v_record RECORD;
BEGIN
    -- Calculer le début de la fenêtre de temps
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    v_reset_at := NOW() + (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Nettoyer les anciennes entrées expirées
    DELETE FROM public.rate_limits
    WHERE window_start < v_window_start;
    
    -- Vérifier si un enregistrement existe déjà
    SELECT * INTO v_record
    FROM public.rate_limits
    WHERE 
        action = p_action 
        AND (
            user_id = p_identifier::UUID 
            OR (user_id IS NULL AND p_identifier NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        )
        AND window_start >= v_window_start;
    
    -- Si aucun enregistrement n'existe, en créer un
    IF v_record IS NULL THEN
        BEGIN
            INSERT INTO public.rate_limits (user_id, action, count, window_start)
            VALUES (
                CASE 
                    WHEN p_identifier SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' 
                    THEN p_identifier::UUID 
                    ELSE NULL 
                END,
                p_action,
                1,
                NOW()
            );
            
            RETURN json_build_object(
                'allowed', TRUE,
                'remaining', p_max_attempts - 1,
                'reset_at', v_reset_at::TEXT,
                'blocked', FALSE
            );
        EXCEPTION
            WHEN OTHERS THEN
                RETURN json_build_object(
                    'allowed', TRUE,
                    'remaining', p_max_attempts,
                    'reset_at', v_reset_at::TEXT,
                    'blocked', FALSE
                );
        END;
    END IF;
    
    -- Vérifier si la limite est atteinte
    v_count := v_record.count;
    v_remaining := GREATEST(0, p_max_attempts - v_count);
    
    IF v_count >= p_max_attempts THEN
        RETURN json_build_object(
            'allowed', FALSE,
            'remaining', 0,
            'reset_at', v_reset_at::TEXT,
            'blocked', TRUE
        );
    END IF;
    
    -- Incrémenter le compteur
    UPDATE public.rate_limits
    SET count = count + 1
    WHERE id = v_record.id;
    
    RETURN json_build_object(
        'allowed', TRUE,
        'remaining', v_remaining - 1,
        'reset_at', v_reset_at::TEXT,
        'blocked', FALSE
    );
END;
$$;

-- Fonction pour débloquer un utilisateur (admin seulement)
CREATE OR REPLACE FUNCTION public.admin_unblock_rate_limit(
    p_identifier TEXT,
    p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Vérifier si l'utilisateur actuel est un admin
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Accès refusé : seuls les administrateurs peuvent débloquer les utilisateurs';
    END IF;
    
    -- Supprimer les entrées de rate limit pour cet identifiant et cette action
    DELETE FROM public.rate_limits
    WHERE 
        action = p_action 
        AND (
            user_id = p_identifier::UUID 
            OR (user_id IS NULL AND p_identifier NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erreur lors du déblocage: %', SQLERRM;
END;
$$;

-- Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION public.admin_unblock_rate_limit TO authenticated;

-- Commentaires pour la documentation
COMMENT ON FUNCTION public.check_rate_limit IS 'Vérifie et applique les limites de taux pour une action donnée';
COMMENT ON FUNCTION public.admin_unblock_rate_limit IS 'Permet aux administrateurs de débloquer un utilisateur soumis à des limites de taux';
