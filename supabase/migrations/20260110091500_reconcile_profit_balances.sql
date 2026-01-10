-- Migration: Script de réconciliation des profits
-- Date: 2026-01-10
-- Description: Détecte et corrige les incohérences entre la table profits et wallets.profit_balance

-- 1. Créer une fonction de réconciliation
CREATE OR REPLACE FUNCTION public.reconcile_profit_balances()
RETURNS TABLE(
    user_id UUID,
    user_email TEXT,
    total_profits_generated NUMERIC,
    total_withdrawals NUMERIC,
    expected_balance NUMERIC,
    actual_balance NUMERIC,
    discrepancy NUMERIC,
    action_taken TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_total_profits NUMERIC;
    v_total_withdrawals NUMERIC;
    v_expected_balance NUMERIC;
    v_actual_balance NUMERIC;
    v_discrepancy NUMERIC;
    v_action TEXT;
BEGIN
    -- Vérification admin
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Accès non autorisé. Seuls les administrateurs peuvent exécuter cette fonction.';
    END IF;

    -- Parcourir tous les utilisateurs ayant des profits
    FOR v_user IN 
        SELECT DISTINCT p.user_id, prof.email
        FROM profits p
        LEFT JOIN profiles prof ON p.user_id = prof.id
    LOOP
        -- Calculer le total des profits générés
        SELECT COALESCE(SUM(amount), 0)
        INTO v_total_profits
        FROM profits
        WHERE profits.user_id = v_user.user_id;

        -- Calculer le total des retraits validés
        SELECT COALESCE(SUM(amount), 0)
        INTO v_total_withdrawals
        FROM transactions
        WHERE transactions.user_id = v_user.user_id
        AND type = 'withdrawal'
        AND status = 'completed';

        -- Calculer le solde attendu
        v_expected_balance := v_total_profits - v_total_withdrawals;

        -- Récupérer le solde actuel
        SELECT COALESCE(profit_balance, 0)
        INTO v_actual_balance
        FROM wallets
        WHERE wallets.user_id = v_user.user_id;

        -- Calculer l'écart
        v_discrepancy := v_expected_balance - v_actual_balance;

        -- Si écart significatif (> 1 USD), corriger
        IF ABS(v_discrepancy) > 1 THEN
            -- Corriger le wallet
            UPDATE wallets
            SET 
                profit_balance = v_expected_balance,
                total_balance = total_balance + v_discrepancy,
                updated_at = now()
            WHERE wallets.user_id = v_user.user_id;

            v_action := 'CORRIGÉ: ' || v_discrepancy || ' USD ajoutés';
        ELSE
            v_action := 'OK';
        END IF;

        -- Retourner les résultats
        RETURN QUERY SELECT 
            v_user.user_id,
            v_user.email,
            v_total_profits,
            v_total_withdrawals,
            v_expected_balance,
            v_actual_balance,
            v_discrepancy,
            v_action;
    END LOOP;
END;
$$;

-- 2. Permissions
GRANT EXECUTE ON FUNCTION public.reconcile_profit_balances() TO authenticated;

-- 3. Commentaire
COMMENT ON FUNCTION public.reconcile_profit_balances() IS 
'Fonction de réconciliation qui détecte et corrige automatiquement les incohérences entre la table profits et wallets.profit_balance. 
Utilisation: SELECT * FROM reconcile_profit_balances() WHERE ABS(discrepancy) > 1;';

-- Note: Pour exécuter la réconciliation, utiliser:
-- SELECT * FROM public.reconcile_profit_balances() WHERE ABS(discrepancy) > 1 ORDER BY ABS(discrepancy) DESC;
