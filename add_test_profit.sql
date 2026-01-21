-- Ajout de 100 USD au solde de profit de l'utilisateur pour test
-- User ID: 22dd2692-cde6-4921-aba8-71467a7c79e0
-- Email: manassembemba12@gmail.com

DO $$
DECLARE
    v_user_id UUID := '22dd2692-cde6-4921-aba8-71467a7c79e0';
    v_amount NUMERIC := 100.00;
    v_new_balance NUMERIC;
BEGIN
    -- Vérifier si le portefeuille existe
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'Portefeuille non trouvé pour l''utilisateur %', v_user_id;
    END IF;

    -- Mettre à jour le solde de profit
    UPDATE public.wallets
    SET profit_balance = profit_balance + v_amount,
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING profit_balance INTO v_new_balance;
    
    RAISE NOTICE 'Succès : 100 USD ajoutés. Nouveau solde de profit : % USD', v_new_balance;
END $$;
