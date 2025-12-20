-- Migration: Link Transactions to Accounting Module
-- Date: 2025-12-06
-- Description: Updates approve_deposit and approve_withdrawal functions to automatically
-- create accounting entries in the company_accounts ledger.

-- 1. Update approve_deposit
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    wallet_updated_count INTEGER;
    transaction_updated_count INTEGER;
    
    -- Accounting variables
    bank_account_id UUID;
    client_deposits_id UUID;
BEGIN
    -- Check if the user is an admin
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent approuver les dépôts.');
    END IF;

    -- Get the transaction details
    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_approve AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée ou déjà traitée.');
    END IF;

    -- Get user profile for email details
    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    -- Update the user's wallet
    UPDATE public.wallets
    SET total_balance = total_balance + transaction_record.amount,
        updated_at = now()
    WHERE user_id = transaction_record.user_id;
    
    GET DIAGNOSTICS wallet_updated_count = ROW_COUNT;

    -- If no wallet was updated, it means the user doesn't have a wallet. Create one.
    IF wallet_updated_count = 0 THEN
        INSERT INTO public.wallets (user_id, total_balance)
        VALUES (transaction_record.user_id, transaction_record.amount);
    END IF;

    -- Update the transaction status
    UPDATE public.transactions
    SET status = 'completed',
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    GET DIAGNOSTICS transaction_updated_count = ROW_COUNT;

    IF transaction_updated_count = 0 THEN
        RAISE EXCEPTION 'Impossible de mettre à jour le statut de la transaction.';
    END IF;

    -- ACCOUNTING ENTRY (New)
    -- Debit: Banque Principale (Asset)
    -- Credit: Dépôts Clients (Liability)
    SELECT id INTO bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO client_deposits_id FROM public.company_accounts WHERE name = 'Dépôts Clients';

    IF bank_account_id IS NOT NULL AND client_deposits_id IS NOT NULL THEN
        INSERT INTO public.accounting_entries (
            transaction_date,
            description,
            debit_account_id,
            credit_account_id,
            amount,
            related_transaction_id,
            related_user_id,
            created_by
        ) VALUES (
            now(),
            'Dépôt approuvé pour ' || COALESCE(user_profile.first_name, 'Utilisateur') || ' ' || COALESCE(user_profile.last_name, ''),
            bank_account_id,
            client_deposits_id,
            transaction_record.amount,
            transaction_id_to_approve,
            transaction_record.user_id,
            auth.uid()
        );
        
        -- Update Account Balances
        UPDATE public.company_accounts SET balance = balance + transaction_record.amount WHERE id = bank_account_id;
        UPDATE public.company_accounts SET balance = balance + transaction_record.amount WHERE id = client_deposits_id;
    END IF;

    -- Mark related admin notifications as read
    UPDATE public.notifications
    SET is_read = true
    WHERE reference_id = transaction_id_to_approve;

    -- Create an in-app notification for the user
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id, 
        'Votre dépôt de ' || transaction_record.amount || ' ' || transaction_record.currency || ' a été approuvé.',
        transaction_id_to_approve,
        '/transactions',
        'transaction',
        'medium'
    );

    -- Enqueue email to the user
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_approved',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'amount', transaction_record.amount
            )
        );
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Erreur système: ' || SQLERRM);
END;
$$;


-- 2. Update approve_withdrawal
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
    
    -- Accounting variables
    bank_account_id UUID;
    client_deposits_id UUID;
BEGIN
    -- Validate proof URL
    IF p_proof_url IS NULL OR p_proof_url = '' THEN
        RETURN json_build_object('success', false, 'error', 'La preuve de transfert est obligatoire.');
    END IF;

    -- Get the transaction
    SELECT * INTO transaction_data 
    FROM public.transactions 
    WHERE id = transaction_id_to_approve 
    AND type = 'withdrawal' 
    AND status = 'pending';

    IF transaction_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction introuvable ou déjà traitée.');
    END IF;

    -- Get user profile
    SELECT * INTO profile_data 
    FROM public.profiles 
    WHERE id = transaction_data.user_id;

    -- Update transaction
    UPDATE public.transactions
    SET 
        status = 'completed',
        proof_url = p_proof_url,
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- Update wallet (deduct from locked_balance)
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - transaction_data.amount,
        updated_at = now()
    WHERE user_id = transaction_data.user_id;

    -- ACCOUNTING ENTRY (New)
    -- Debit: Dépôts Clients (Liability) - Reducing debt
    -- Credit: Banque Principale (Asset) - Cash out
    SELECT id INTO bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO client_deposits_id FROM public.company_accounts WHERE name = 'Dépôts Clients';

    IF bank_account_id IS NOT NULL AND client_deposits_id IS NOT NULL THEN
        INSERT INTO public.accounting_entries (
            transaction_date,
            description,
            debit_account_id,
            credit_account_id,
            amount,
            related_transaction_id,
            related_user_id,
            created_by
        ) VALUES (
            now(),
            'Retrait approuvé pour ' || COALESCE(profile_data.first_name, 'Utilisateur') || ' ' || COALESCE(profile_data.last_name, ''),
            client_deposits_id, -- Debit Liability
            bank_account_id,    -- Credit Asset
            transaction_data.amount,
            transaction_id_to_approve,
            transaction_data.user_id,
            auth.uid()
        );
        
        -- Update Account Balances
        -- Asset decreases (Credit)
        UPDATE public.company_accounts SET balance = balance - transaction_data.amount WHERE id = bank_account_id;
        -- Liability decreases (Debit)
        UPDATE public.company_accounts SET balance = balance - transaction_data.amount WHERE id = client_deposits_id;
    END IF;

    -- Enqueue email
    IF profile_data.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'withdrawal_approved_with_proof',
            transaction_data.user_id,
            profile_data.email,
            jsonb_build_object(
                'name', profile_data.first_name || ' ' || profile_data.last_name,
                'amount', transaction_data.amount,
                'method', transaction_data.method,
                'proof_url', p_proof_url,
                'date', to_char(now(), 'DD/MM/YYYY')
            )
        );
    END IF;

    -- Notification message
    notification_message := 'Retrait approuvé: Votre retrait de ' || transaction_data.amount || ' USD a été approuvé et transféré. Consultez la preuve dans votre email.';

    -- Create notification
    INSERT INTO public.notifications (user_id, message, link_to)
    VALUES (
        transaction_data.user_id,
        notification_message,
        '/wallet'
    );

    RETURN json_build_object('success', true, 'message', 'Retrait approuvé avec succès.');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erreur interne du serveur: ' || SQLERRM);
END;
$$;
