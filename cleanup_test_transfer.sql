-- Script pour annuler le dernier transfert de profit et supprimer les fonds de test
-- User ID: 22dd2692-cde6-4921-aba8-71467a7c79e0

DO $$
DECLARE
    v_user_id UUID := '22dd2692-cde6-4921-aba8-71467a7c79e0';
    v_last_transfer_id UUID;
    v_transfer_amount NUMERIC;
BEGIN
    -- 1. Trouver la dernière transaction de transfert pour cet utilisateur
    SELECT id, amount INTO v_last_transfer_id, v_transfer_amount
    FROM public.transactions
    WHERE user_id = v_user_id 
      AND type = 'transfer'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_transfer_id IS NULL THEN
        RAISE NOTICE 'Aucune transaction de transfert trouvée pour cet utilisateur.';
        RETURN;
    END IF;

    -- 2. Annuler l'effet sur le solde : Retirer le montant du solde total (dépôt)
    -- Note: On ne le remet PAS dans le profit_balance car c'était du "faux" argent de test qu'on veut supprimer.
    UPDATE public.wallets
    SET total_balance = total_balance - v_transfer_amount,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    -- 3. Supprimer la transaction de transfert de l'historique
    DELETE FROM public.transactions
    WHERE id = v_last_transfer_id;

    -- 4. Supprimer aussi la notification associée (optionnel mais plus propre)
    DELETE FROM public.notifications
    WHERE user_id = v_user_id
      AND type = 'wallet_update'
      AND created_at > (NOW() - INTERVAL '1 hour'); -- Supposant que le test est récent

    RAISE NOTICE 'Nettoyage terminé : % USD retirés du solde total et transaction supprimée.', v_transfer_amount;
END $$;
