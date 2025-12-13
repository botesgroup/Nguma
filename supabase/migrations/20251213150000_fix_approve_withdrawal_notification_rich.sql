-- Fix approve_withdrawal to use rich notifications (type, priority)
-- This restores the functionality lost in a previous "fix"

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
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    notification_message TEXT;
BEGIN
    -- Valider la présence de l'URL de preuve
    IF p_proof_url IS NULL OR p_proof_url = '' THEN
        RETURN json_build_object('success', false, 'error', 'La preuve de transfert est obligatoire.');
    END IF;

    -- Récupérer la transaction
    SELECT * INTO transaction_data 
    FROM public.transactions 
    WHERE id = transaction_id_to_approve 
    AND type = 'withdrawal' 
    AND status = 'pending';

    IF transaction_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable ou déjà traitée.');
    END IF;

    -- Récupérer le profil utilisateur pour l'email
    SELECT * INTO profile_data 
    FROM public.profiles 
    WHERE id = transaction_data.user_id;

    -- Mettre à jour la transaction
    UPDATE public.transactions
    SET 
        status = 'completed',
        proof_url = p_proof_url,
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- Mettre à jour le portefeuille
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - transaction_data.amount,
        updated_at = now()
    WHERE user_id = transaction_data.user_id;

    -- Préparer et envoyer l'email de confirmation
    payload := jsonb_build_object(
        'template_id', 'withdrawal_approved_with_proof',
        'to', profile_data.email,
        'name', profile_data.first_name || ' ' || profile_data.last_name,
        'amount', transaction_data.amount,
        'method', transaction_data.method,
        'proof_url', p_proof_url,
        'date', to_char(now(), 'DD/MM/YYYY')
    );

    PERFORM net.http_post(
        url := project_url || '/functions/v1/send-resend-email',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := payload
    );

    -- Message de notification
    notification_message := 'Retrait approuvé: Votre retrait de ' || transaction_data.amount || ' USD a été approuvé et transféré. Consultez la preuve dans votre email.';

    -- CORRECTION : Utilisation des colonnes type et priority
    INSERT INTO public.notifications (user_id, message, link_to, type, priority, reference_id)
    VALUES (
        transaction_data.user_id,
        notification_message,
        '/wallet',
        'transaction',
        'high',
        transaction_id_to_approve
    );

    RETURN json_build_object('success', true, 'message', 'Retrait approuvé avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur interne du serveur: ' || SQLERRM);
END;
$$;
