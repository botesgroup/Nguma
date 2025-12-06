-- Function to get accounting stats
CREATE OR REPLACE FUNCTION public.get_accounting_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_object_agg(name, balance)
    INTO result
    FROM public.company_accounts;
    
    RETURN result;
END;
$$;

-- Function to get upcoming profits for a period
CREATE OR REPLACE FUNCTION public.get_upcoming_profits(
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ DEFAULT (now() + interval '7 days')
)
RETURNS TABLE (
    user_id UUID,
    contract_id UUID,
    amount NUMERIC,
    expected_date TIMESTAMPTZ,
    contract_name TEXT -- Assuming we might want this, though contracts table doesn't have name usually, maybe use ID or type
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.user_id,
        c.id as contract_id,
        (c.amount * c.monthly_rate) as amount,
        (c.start_date + (interval '1 month' * (c.months_paid + 1))) as expected_date,
        'Contract ' || c.id::text as contract_name
    FROM public.contracts c
    WHERE c.status = 'active'
    AND (c.start_date + (interval '1 month' * (c.months_paid + 1))) BETWEEN start_date AND end_date;
END;
$$;

-- Function to generate a payment batch for pending withdrawals
CREATE OR REPLACE FUNCTION public.generate_withdrawal_batch()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_batch_id UUID;
    batch_num TEXT;
    total NUMERIC := 0;
BEGIN
    -- Check if there are pending withdrawals
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE type = 'withdrawal' AND status = 'pending') THEN
        RETURN NULL;
    END IF;

    -- Generate batch number
    batch_num := public.generate_batch_number();

    -- Create Batch
    INSERT INTO public.payment_batches (batch_number, status, period_start, period_end)
    VALUES (batch_num, 'pending', now(), now()) -- Period is just today for ad-hoc generation
    RETURNING id INTO new_batch_id;

    -- Insert Items
    INSERT INTO public.payment_batch_items (batch_id, user_id, amount, related_transaction_id)
    SELECT 
        new_batch_id,
        user_id,
        amount,
        id
    FROM public.transactions
    WHERE type = 'withdrawal' AND status = 'pending';

    -- Update Batch Total
    SELECT SUM(amount) INTO total FROM public.payment_batch_items WHERE batch_id = new_batch_id;
    
    UPDATE public.payment_batches 
    SET total_amount = total 
    WHERE id = new_batch_id;

    RETURN new_batch_id;
END;
$$;

-- Function to process a batch (Mark as Paid)
CREATE OR REPLACE FUNCTION public.process_payment_batch(
    p_batch_id UUID,
    p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    batch_record RECORD;
    item_record RECORD;
    bank_account_id UUID;
    liability_account_id UUID;
BEGIN
    -- Get Batch
    SELECT * INTO batch_record FROM public.payment_batches WHERE id = p_batch_id;
    
    IF batch_record.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Batch already paid');
    END IF;

    -- Get Accounts (assuming they exist from seed)
    SELECT id INTO bank_account_id FROM public.company_accounts WHERE name = 'Banque Principale';
    SELECT id INTO liability_account_id FROM public.company_accounts WHERE name = 'Dettes Retraits'; -- Or Dépôts Clients?

    -- Loop through items
    FOR item_record IN SELECT * FROM public.payment_batch_items WHERE batch_id = p_batch_id LOOP
        -- Update Transaction Status if linked
        IF item_record.related_transaction_id IS NOT NULL THEN
            UPDATE public.transactions
            SET 
                status = 'completed',
                proof_url = p_proof_url,
                updated_at = now()
            WHERE id = item_record.related_transaction_id;
            
            -- Note: We do NOT deduct from wallet here because usually 'pending' withdrawal 
            -- has already locked the funds or deducted them.
            -- Let's check `request_withdrawal`. 
            -- Usually request_withdrawal locks funds. 
            -- `approve_withdrawal` deducts locked_balance.
            -- So we need to replicate that logic here.
            
            UPDATE public.wallets
            SET 
                locked_balance = locked_balance - item_record.amount,
                updated_at = now()
            WHERE user_id = item_record.user_id;

            -- Send Notification (Simplified)
            INSERT INTO public.notifications (user_id, title, message, type, priority, link)
            VALUES (
                item_record.user_id,
                'Retrait traité',
                'Votre retrait de ' || item_record.amount || ' USD a été traité dans le lot ' || batch_record.batch_number,
                'withdrawal',
                'high',
                '/wallet'
            );
        END IF;

        -- Update Item Status
        UPDATE public.payment_batch_items SET status = 'paid' WHERE id = item_record.id;
    END LOOP;

    -- Update Batch Status
    UPDATE public.payment_batches 
    SET 
        status = 'paid', 
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = p_batch_id;

    -- Create Accounting Entry (Global for the batch)
    -- Credit Bank (Asset decreases)
    -- Debit Liability (Liability decreases)
    INSERT INTO public.accounting_entries (
        description,
        debit_account_id,
        credit_account_id,
        amount,
        created_by
    ) VALUES (
        'Payment Batch ' || batch_record.batch_number,
        liability_account_id, -- Debit Liability to decrease it
        bank_account_id,      -- Credit Asset to decrease it
        batch_record.total_amount,
        auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'batch_id', p_batch_id);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_accounting_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_profits(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_withdrawal_batch() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_batch(UUID, TEXT) TO authenticated;
