
-- Migration de Diagnostic: Lister toutes les versions de la fonction admin_get_all_contracts
-- Date: 2025-12-06
-- Description: Cette migration ne modifie pas le schéma. Elle utilise RAISE NOTICE
-- pour afficher dans les logs de `supabase db push` toutes les signatures de fonctions
-- existantes nommées 'admin_get_all_contracts'. Cela nous aidera à identifier
-- une potentielle surcharge de fonction conflictuelle.

DO $$
DECLARE
    func_signature TEXT;
    func_count INT := 0;
BEGIN
    RAISE NOTICE '----------------------------------------------------------------';
    RAISE NOTICE '--- [DIAGNOSTIC] Inspection des fonctions "admin_get_all_contracts" ---';
    RAISE NOTICE '----------------------------------------------------------------';

    FOR func_signature IN
        SELECT oid::regprocedure::text
        FROM pg_proc
        WHERE proname = 'admin_get_all_contracts'
    LOOP
        RAISE NOTICE 'Trouvé: %', func_signature;
        func_count := func_count + 1;
    END LOOP;

    IF func_count = 0 THEN
        RAISE NOTICE 'Aucune fonction nommée "admin_get_all_contracts" trouvée.';
    END IF;

    RAISE NOTICE '--- [DIAGNOSTIC] Fin de l''inspection ---';
    RAISE NOTICE '----------------------------------------------------------------';
END $$;
