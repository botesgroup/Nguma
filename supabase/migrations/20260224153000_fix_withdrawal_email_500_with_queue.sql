
-- Migration: Harmonisation des emails de retrait vers la file d'attente (notifications_queue)
-- Date: 2026-02-24
-- Description: Remplace les appels HTTP directs par l'insertion dans la file d'attente pour éviter les erreurs 500.

-- 1. Mise à jour de approve_withdrawal
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

    SELECT email, first_name, last_name INTO profile_data 
    FROM public.profiles 
    WHERE id = transaction_data.user_id;

    -- Mettre à jour avec status 'completed'
    UPDATE public.transactions
    SET 
        status = 'completed',
        proof_url = p_proof_url,
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- Débloquer les fonds (sortir de locked_balance)
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - transaction_data.amount,
        updated_at = now()
    WHERE user_id = transaction_data.user_id;

    -- Fetch Support Phone
    SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';

    -- Mise en file d'attente de l'email (Version avec Preuve)
    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_approved_with_proof',
            transaction_data.user_id,
            profile_data.email,
            jsonb_build_object(
                'name', COALESCE(profile_data.first_name, '') || ' ' || COALESCE(profile_data.last_name, 'Investisseur'),
                'amount', transaction_data.amount,
                'method', COALESCE(transaction_data.method, 'Virement'),
                'proof_url', p_proof_url,
                'date', to_char(now(), 'DD/MM/YYYY'),
                'support_phone', v_support_phone
            )
        );
    END IF;

    -- Notification in-app
    INSERT INTO public.notifications (user_id, title, message, type, priority, link_to)
    VALUES (
        transaction_data.user_id,
        'Retrait approuvé',
        'Votre retrait de ' || transaction_data.amount || ' USD a été approuvé et transféré. Consultez votre email pour la preuve.',
        'transaction',
        'high',
        '/wallet'
    );

    RETURN json_build_object('success', true, 'message', 'Retrait approuvé avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur: ' || SQLERRM);
END;
$$;

-- 2. Mise à jour de reject_withdrawal
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_record RECORD;
    user_profile RECORD;
    wallet_record RECORD;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'withdrawal' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable ou déjà traitée.');
    END IF;
    
    SELECT * INTO wallet_record FROM public.wallets WHERE user_id = transaction_record.user_id;

    IF wallet_record.locked_balance < transaction_record.amount THEN
      RETURN json_build_object('success', false, 'error', 'Erreur de solde verrouillé.');
    END IF;

    -- Retourner les fonds du verrouillé vers le profit
    UPDATE public.wallets
    SET
      locked_balance = locked_balance - transaction_record.amount,
      profit_balance = profit_balance + transaction_record.amount,
      updated_at = now()
    WHERE user_id = transaction_record.user_id;

    -- Update transaction status
    UPDATE public.transactions
    SET status = 'rejected',
        description = 'Rejeté par admin. Raison: ' || reason,
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;
    
    -- Notification in-app
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id,
        'Votre retrait de ' || transaction_record.amount || ' USD a été rejeté. Raison: ' || reason,
        transaction_id_to_reject,
        '/transactions',
        'transaction',
        'high'
    );

    -- Mise en file d'attente de l'email
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', COALESCE(user_profile.first_name, '') || ' ' || COALESCE(user_profile.last_name, 'Investisseur'),
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;
