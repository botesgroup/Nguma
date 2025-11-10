-- This migration creates an RPC function for admins to adjust the amount
-- of a pending deposit transaction before approval.

CREATE OR REPLACE FUNCTION public.admin_adjust_deposit_amount(
    transaction_id_to_adjust UUID,
    new_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
    -- 1. Security: Ensure the caller is an admin
    IF NOT is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Accès non autorisé. Seuls les administrateurs peuvent ajuster les montants.');
    END IF;

    -- 2. Validation: Ensure the new amount is positive
    IF new_amount <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Le nouveau montant doit être positif.');
    END IF;

    -- 3. Find the transaction and verify its state
    SELECT * INTO target_transaction
    FROM public.transactions
    WHERE id = transaction_id_to_adjust;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Transaction non trouvée.');
    END IF;

    IF target_transaction.status <> 'pending' OR target_transaction.type <> 'deposit' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Seuls les dépôts en attente peuvent être ajustés.');
    END IF;

    -- 4. Update the transaction amount
    UPDATE public.transactions
    SET amount = new_amount, updated_at = now()
    WHERE id = transaction_id_to_adjust;

    -- 5. Return success
    RETURN jsonb_build_object('success', TRUE, 'message', 'Le montant du dépôt a été ajusté avec succès.');
END;
$$;
