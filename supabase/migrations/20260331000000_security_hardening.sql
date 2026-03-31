-- Migration: Security Hardening (RLS & Triggers)
-- Date: 2026-03-31
-- Description: Durcissement des politiques RLS et ajout de triggers de protection pour prévenir les modifications directes non autorisées.

-- 1. SECURISATION DE LA TABLE WALLETS
-- Supprimer la possibilité pour un utilisateur de modifier directement son solde via l'API REST
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;

-- S'assurer que les admins ne peuvent modifier que via les RPC prévus, mais garder le SELECT pour le dashboard admin
-- (Note: Les admins ont déjà "Admins can update all wallets", on le laisse pour l'instant mais on recommande de passer par RPC)

-- 2. SECURISATION DE LA TABLE CONTRACTS
-- Les contrats doivent être créés et modifiés uniquement par le système (RPC)
DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
-- Seuls les admins peuvent modifier un contrat directement si nécessaire
-- Seule la lecture (SELECT) reste permise pour l'utilisateur

-- 3. SECURISATION DE LA TABLE TRANSACTIONS
-- Les transactions sont immuables. Personne ne doit pouvoir les modifier ou supprimer.
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
-- (L'utilisateur ne peut plus créer de ligne transaction lui-même, il doit passer par request_deposit ou user_withdraw)

-- Bloquer explicitement UPDATE et DELETE sur les transactions pour tout le monde (y compris admins)
CREATE POLICY "Transactions are immutable - No update" ON public.transactions FOR UPDATE USING (false);
CREATE POLICY "Transactions are immutable - No delete" ON public.transactions FOR DELETE USING (false);

-- 4. TRIGGER DE PROTECTION DES PROFILS
-- Empêcher la modification de l'ID utilisateur (usurpation d'identité)
CREATE OR REPLACE FUNCTION public.prevent_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id <> NEW.id THEN
        RAISE EXCEPTION 'Modification de l''ID utilisateur interdite pour des raisons de sécurité.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_id_change ON public.profiles;
CREATE TRIGGER trigger_prevent_id_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_id_change();

-- 5. TRIGGER DE PROTECTION DES SOLDES (ANTI-FRAUDE)
-- Empêcher toute modification manuelle d'un solde wallet qui ne passerait pas par une fonction tracée
-- Note: Ce trigger est un garde-fou ultime.
CREATE OR REPLACE FUNCTION public.protect_wallet_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- On vérifie si l'utilisateur est un super-admin ou si la modification est autorisée par le système
    -- Si la modification vient de l'API REST (PostgREST), le rôle auth.role() sera 'authenticated'
    IF auth.role() = 'authenticated' AND NOT (SELECT public.has_role(auth.uid(), 'admin')) THEN
        RAISE EXCEPTION 'Tentative de modification directe de solde détectée et bloquée.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_wallet_balances ON public.wallets;
CREATE TRIGGER trigger_protect_wallet_balances
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_balances();

-- 6. SECURISATION DES AUDITS (MODE APPEND-ONLY)
-- Les logs d'audit et les actions admin ne doivent jamais être supprimés
CREATE POLICY "Audit logs are append-only" ON public.audit_logs FOR UPDATE USING (false);
CREATE POLICY "Audit logs cannot be deleted" ON public.audit_logs FOR DELETE USING (false);

CREATE POLICY "Admin actions are append-only" ON public.admin_actions FOR UPDATE USING (false);
CREATE POLICY "Admin actions cannot be deleted" ON public.admin_actions FOR DELETE USING (false);

-- Notification de succès
COMMENT ON TABLE public.wallets IS 'Table hautement sécurisée : pas d''UPDATE direct via API REST.';
