
-- Migration: Force Update approve_withdrawal to Use Notification Queue
-- Date: 2026-02-25
-- Description: Ensures approve_withdrawal uses notifications_queue and removes old HTTP POST calls.

-- Supprimer toutes les versions existantes de approve_withdrawal pour éviter les surcharges.
-- Cela inclut la version avec p_internal_secret et p_admin_email.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        WHERE proname = 'approve_withdrawal' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.approve_withdrawal(%s) CASCADE', r.argtypes);
    END LOOP;
END$$;


-- Recréer la fonction approve_withdrawal en utilisant la file d'attente
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
    transaction_id_to_approve UUID,
    p_proof_url TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_data RECORD;
    profile_data RECORD;
    v_support_phone TEXT;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    IF p_proof_url IS NULL OR p_proof_url = '' THEN
        RETURN json_build_object('success', false, 'error', 'La preuve de transfert est obligatoire.');
    END IF;

    SELECT * INTO transaction_data 
    FROM public.transactions 
    WHERE id = transaction_id_to_approve 
    AND type = 'withdrawal' 
    AND status = 'pending';

    IF transaction_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable ou déjà traitée.');
    END IF;

    -- Mise à jour de la transaction et du portefeuille
    UPDATE public.transactions
    SET 
        status = 'completed',
        proof_url = p_proof_url,
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - transaction_data.amount,
        updated_at = now()
    WHERE user_id = transaction_data.user_id;

    -- Obtenir les données du profil pour l'email
    SELECT email, first_name, last_name INTO profile_data 
    FROM public.profiles 
    WHERE id = transaction_data.user_id;

    -- Obtenir le numéro de support
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- Mise en file d'attente de l'email pour l'utilisateur
    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_approved_with_proof',
            transaction_data.user_id,
            profile_data.email,
            jsonb_build_object(
                'name', COALESCE(profile_data.first_name || ' ' || profile_data.last_name, 'Investisseur'),
                'amount', transaction_data.amount,
                'method', COALESCE(transaction_data.method, 'Virement'),
                'proof_url', p_proof_url,
                'date', to_char(now(), 'DD/MM/YYYY'),
                'support_phone', v_support_phone
            )
        );
    END IF;

    -- Log admin de l'action
    PERFORM public.log_admin_action_to_emails('Approbation de Retrait', transaction_data.user_id, transaction_data.amount, 'Transfert effectué avec preuve');

    RETURN json_build_object('success', true, 'message', 'Retrait approuvé avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur: ' || SQLERRM);
END;
$$;

-- S'assurer que les permissions sont en place
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID, TEXT) TO authenticated;
