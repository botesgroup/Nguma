-- Migration: Fix approve_deposit function with improved error handling
-- Date: 2025-12-22
-- Description: Improves error handling in approve_deposit function to prevent failures when accounting accounts don't exist

-- Update the approve_deposit function with better error handling
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    transaction_record record;
    user_profile record;
    is_admin_user boolean;
    v_support_phone TEXT;
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;

    -- Accounting variables
    v_bank_account_id UUID;
    v_deposits_liability_account_id UUID;
    v_error_message TEXT;
BEGIN
    -- Check if the user is an admin
    BEGIN
        SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
        IF NOT is_admin_user THEN
            RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent approuver les dépôts.');
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', 'Erreur de vérification des droits administrateur: ' || SQLERRM);
    END;

    -- Get the transaction details
    BEGIN
        SELECT * INTO transaction_record
        FROM public.transactions
        WHERE id = transaction_id_to_approve AND type = 'deposit' AND status = 'pending';

        IF transaction_record IS NULL THEN
            RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée ou déjà traitée.');
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', 'Erreur de recherche de la transaction: ' || SQLERRM);
    END;

    -- Get user profile for email details
    BEGIN
        SELECT email, first_name, last_name INTO user_profile
        FROM public.profiles
        WHERE id = transaction_record.user_id;

        IF user_profile IS NULL THEN
            RETURN json_build_object('success', false, 'error', 'Profil utilisateur non trouvé.');
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', 'Erreur de recherche du profil utilisateur: ' || SQLERRM);
    END;

    -- Update the user's wallet
    BEGIN
        UPDATE public.wallets
        SET total_balance = total_balance + transaction_record.amount
        WHERE user_id = transaction_record.user_id;

        -- Check if the update was successful
        IF NOT FOUND THEN
            -- Check if wallet exists
            IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = transaction_record.user_id) THEN
                RETURN json_build_object('success', false, 'error', 'Portefeuille utilisateur non trouvé.');
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', 'Erreur de mise à jour du portefeuille: ' || SQLERRM);
    END;

    -- Update the transaction status
    BEGIN
        UPDATE public.transactions
        SET status = 'completed', updated_at = now()
        WHERE id = transaction_id_to_approve;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN json_build_object('success', false, 'error', 'Erreur de mise à jour de la transaction: ' || SQLERRM);
    END;

    -- *** ACCOUNTING LOGIC (with comprehensive error handling) ***
    BEGIN
        SELECT id INTO v_bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
        SELECT id INTO v_deposits_liability_account_id FROM public.company_accounts WHERE name = 'Dépôts Clients';

        -- Only create accounting entry if both accounts exist
        IF v_bank_account_id IS NOT NULL AND v_deposits_liability_account_id IS NOT NULL THEN
            INSERT INTO public.accounting_entries (related_transaction_id, description, debit_account_id, credit_account_id, amount, created_by)
            VALUES (
                transaction_id_to_approve,
                'Approbation du dépôt de ' || transaction_record.amount || ' USD pour ' || COALESCE((SELECT email FROM auth.users WHERE id = transaction_record.user_id), 'Utilisateur'),
                v_bank_account_id,
                v_deposits_liability_account_id,
                transaction_record.amount,
                auth.uid()
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but continue with the approval process
            RAISE NOTICE 'Erreur dans la comptabilité pour le dépôt %: %', transaction_id_to_approve, SQLERRM;
            -- Continue processing without failing the entire function
    END;
    -- ************************************

    -- Create an in-app notification for the user
    BEGIN
        INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
        VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été approuvé.', transaction_id_to_approve, '/wallet', 'transaction', 'high');
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erreur de création de notification: %', SQLERRM;
            -- Continue processing
    END;

    -- Fetch Support Phone
    BEGIN
        SELECT value INTO v_support_phone FROM public.settings WHERE key = 'support_whatsapp_number';
    EXCEPTION
        WHEN OTHERS THEN
            v_support_phone := NULL; -- Continue with NULL if setting not found
    END;

    -- Enqueue email notification
    BEGIN
        IF user_profile.email IS NOT NULL THEN
            INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
            VALUES (
                'deposit_approved',
                transaction_record.user_id,
                user_profile.email,
                jsonb_build_object(
                    'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                    'amount', transaction_record.amount,
                    'support_phone', v_support_phone
                )
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erreur d''insertion dans la file de notifications: %', SQLERRM;
            -- Continue processing
    END;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Erreur système inattendue: ' || SQLERRM || ' (State: ' || SQLSTATE || ')');
END;
$function$;

-- Ensure the required company accounts exist
INSERT INTO public.company_accounts (name, type, balance) VALUES
('Banque Principale', 'asset', 0),
('Dépôts Clients', 'liability', 0),
('Portefeuille Crypto', 'asset', 0),
('Dettes Retraits', 'liability', 0),
('Revenus Frais', 'revenue', 0),
('Pertes', 'expense', 0)
ON CONFLICT (name) DO NOTHING;