-- Migration: Add Contract Insurance System
-- Description: Ajouter un système d'assurance optionnel pour les contrats avec frais configurables

-- Step 1: Add insurance columns to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS is_insured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insurance_fee_paid NUMERIC(20,8) DEFAULT 0 CHECK (insurance_fee_paid >= 0);

-- Step 2: Add insurance settings
INSERT INTO public.settings (key, value, type, description)
VALUES 
  ('insurance_enabled', 'true', 'boolean', 'Active ou désactive le système d''assurance des contrats'),
  ('insurance_fee_percent', '5', 'number', 'Pourcentage de frais d''assurance (ex: 5 = 5%)'),
  ('insurance_fee_fixed', '0', 'number', 'Frais d''assurance fixe en USD'),
  ('insurance_apply_both', 'false', 'boolean', 'Appliquer à la fois le pourcentage et les frais fixes')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  updated_at = now();

-- Step 3: Create function to calculate insurance fee
CREATE OR REPLACE FUNCTION public.calculate_insurance_fee(
    p_amount NUMERIC(20,8),
    p_is_insured BOOLEAN DEFAULT FALSE
)
RETURNS NUMERIC(20,8)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fee_percent NUMERIC(10,4);
    v_fee_fixed NUMERIC(20,8);
    v_apply_both BOOLEAN;
    v_enabled BOOLEAN;
    v_total_fee NUMERIC(20,8) := 0;
BEGIN
    -- Si pas assuré, retourner 0
    IF NOT p_is_insured THEN
        RETURN 0;
    END IF;
    
    -- Récupérer les paramètres
    SELECT value::BOOLEAN INTO v_enabled 
    FROM public.settings WHERE key = 'insurance_enabled';
    
    -- Si l'assurance n'est pas activée, retourner 0
    IF NOT COALESCE(v_enabled, FALSE) THEN
        RETURN 0;
    END IF;
    
    -- Récupérer les taux de frais
    SELECT value::NUMERIC INTO v_fee_percent 
    FROM public.settings WHERE key = 'insurance_fee_percent';
    
    SELECT value::NUMERIC INTO v_fee_fixed 
    FROM public.settings WHERE key = 'insurance_fee_fixed';
    
    SELECT value::BOOLEAN INTO v_apply_both 
    FROM public.settings WHERE key = 'insurance_apply_both';
    
    -- Calculer les frais selon la configuration
    IF COALESCE(v_apply_both, FALSE) THEN
        -- Appliquer les deux types de frais
        v_total_fee := (p_amount * COALESCE(v_fee_percent, 0) / 100) + COALESCE(v_fee_fixed, 0);
    ELSE
        -- Appliquer seulement le pourcentage si > 0, sinon le fixe
        IF COALESCE(v_fee_percent, 0) > 0 THEN
            v_total_fee := p_amount * v_fee_percent / 100;
        ELSE
            v_total_fee := COALESCE(v_fee_fixed, 0);
        END IF;
    END IF;
    
    RETURN v_total_fee;
END;
$$;

-- Step 4: Update create_new_contract function to handle insurance
CREATE OR REPLACE FUNCTION public.create_new_contract(
    investment_amount NUMERIC(20,8),
    p_is_insured BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    user_wallet RECORD;
    current_monthly_rate NUMERIC(10,8);
    contract_duration_months INTEGER;
    new_contract_id UUID;
    result JSONB;
    v_insurance_fee NUMERIC(20,8);
    v_net_amount NUMERIC(20,8);
    project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
    payload JSONB;
    user_profile RECORD;
BEGIN
    -- 1. Calculer les frais d'assurance
    v_insurance_fee := public.calculate_insurance_fee(investment_amount, p_is_insured);
    v_net_amount := investment_amount - v_insurance_fee;
    
    -- 2. Vérifier que le montant net est positif et suffisant
    IF v_net_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Le montant après déduction des frais d''assurance est insuffisant.'
        );
    END IF;

    -- 3. Get current settings
    SELECT value::NUMERIC INTO current_monthly_rate
    FROM public.settings
    WHERE key = 'monthly_profit_rate';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set');
    END IF;

    -- Get contract duration
    SELECT value::INTEGER INTO contract_duration_months
    FROM public.settings
    WHERE key = 'contract_duration_months';
    
    IF NOT FOUND THEN
        contract_duration_months := 10; -- Default fallback
    END IF;

    -- 4. Get user wallet and check balance (montant TOTAL demandé)
    SELECT * INTO user_wallet
    FROM public.wallets
    WHERE user_id = current_user_id;

    IF user_wallet.total_balance < investment_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Solde insuffisant. Vous avez besoin de ' || investment_amount || ' USD (incluant les frais d''assurance de ' || v_insurance_fee || ' USD).'
        );
    END IF;

    -- 5. Get user profile for email
    SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;

    -- 6. Update wallet balance (déduire le montant TOTAL)
    UPDATE public.wallets
    SET
        total_balance = total_balance - investment_amount,
        invested_balance = invested_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = current_user_id;

    -- 7. Create the new contract (avec le montant NET)
    INSERT INTO public.contracts (
        user_id, 
        amount, 
        currency, 
        monthly_rate, 
        end_date, 
        duration_months,
        is_insured,
        insurance_fee_paid
    )
    VALUES (
        current_user_id,
        v_net_amount,  -- Montant NET après déduction des frais
        user_wallet.currency,
        current_monthly_rate,
        now() + (contract_duration_months || ' months')::INTERVAL,
        contract_duration_months,
        p_is_insured,
        v_insurance_fee
    )
    RETURNING id INTO new_contract_id;

    -- 8. Create investment transaction (montant NET)
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (
        current_user_id,
        'investment',
        v_net_amount,
        user_wallet.currency,
        new_contract_id,
        CASE 
            WHEN p_is_insured THEN 
                'Nouveau contrat d''investissement assuré'
            ELSE 
                'Nouveau contrat d''investissement'
        END
    );

    -- 9. Si assurance, créer une transaction pour les frais
    IF p_is_insured AND v_insurance_fee > 0 THEN
        INSERT INTO public.transactions (
            user_id, type, amount, currency, reference_id, description
        )
        VALUES (
            current_user_id,
            'investment',
            v_insurance_fee,
            user_wallet.currency,
            new_contract_id,
            'Frais d''assurance du contrat'
        );
    END IF;

    -- 10. Send email notification to user
    IF user_profile.email IS NOT NULL THEN
        payload := jsonb_build_object(
            'template_id', 'new_contract_created',
            'to', user_profile.email,
            'name', user_profile.first_name || ' ' || user_profile.last_name,
            'amount', v_net_amount,
            'is_insured', p_is_insured,
            'insurance_fee', v_insurance_fee
        );

        BEGIN
            PERFORM net.http_post(
                url := project_url || '/functions/v1/send-resend-email',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := payload
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Failed to send email notification: %', SQLERRM;
        END;
    END IF;

    result := jsonb_build_object(
        'success', true,
        'contract_id', new_contract_id,
        'net_amount', v_net_amount,
        'insurance_fee', v_insurance_fee,
        'is_insured', p_is_insured
    );

    RETURN result;
END;
$$;

-- Step 5: Update approve_refund function to handle insured contracts
CREATE OR REPLACE FUNCTION public.approve_refund(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    contract_record RECORD;
    refund_amount NUMERIC(20,8);
BEGIN
    -- Ensure caller is an admin
    IF NOT is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
    END IF;

    -- Find the contract pending refund
    SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND status = 'pending_refund';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not pending refund.');
    END IF;

    -- Calcul du remboursement selon le type de contrat
    IF contract_record.is_insured THEN
        -- Contrat assuré: remboursement INTÉGRAL du montant investi
        -- (pas de déduction des profits déjà payés)
        refund_amount := contract_record.amount;
    ELSE
        -- Contrat non assuré: montant - profits déjà payés
        refund_amount := contract_record.amount - contract_record.total_profit_paid;
        IF refund_amount < 0 THEN 
            refund_amount := 0; 
        END IF;
    END IF;

    -- Update user's wallet
    UPDATE public.wallets 
    SET 
        total_balance = total_balance + refund_amount, 
        invested_balance = invested_balance - contract_record.amount 
    WHERE user_id = contract_record.user_id;

    -- Create the transaction record
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description, status)
    VALUES (
        contract_record.user_id, 
        'refund', 
        refund_amount, 
        contract_record.currency, 
        _contract_id, 
        CASE 
            WHEN contract_record.is_insured THEN 
                'Remboursement intégral - Contrat assuré'
            ELSE 
                'Remboursement anticipé'
        END,
        'completed'
    );

    -- Update contract status to 'refunded'
    UPDATE public.contracts SET status = 'refunded' WHERE id = _contract_id;

    -- Notify user
    INSERT INTO public.notifications(user_id, message, link_to)
    VALUES (
        contract_record.user_id, 
        'Votre demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8) || ' a été approuvée. Montant remboursé: ' || refund_amount || ' USD', 
        '/contracts'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Refund approved successfully.',
        'refund_amount', refund_amount,
        'was_insured', contract_record.is_insured
    );
END;
$$;

-- Step 6: Add comment for documentation
COMMENT ON COLUMN public.contracts.is_insured IS 'Indique si le contrat bénéficie de l''assurance';
COMMENT ON COLUMN public.contracts.insurance_fee_paid IS 'Montant des frais d''assurance payés lors de la création du contrat';
COMMENT ON FUNCTION public.calculate_insurance_fee IS 'Calcule les frais d''assurance selon les paramètres configurés';
