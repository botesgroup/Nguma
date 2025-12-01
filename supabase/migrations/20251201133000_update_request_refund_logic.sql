-- Migration: Update request_refund logic
-- Description: Modifies the request_refund function to only allow refunds for insured contracts.

CREATE OR REPLACE FUNCTION public.request_refund(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  current_user_id UUID := auth.uid();
BEGIN
  -- Find the active contract for the current user
  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND user_id = current_user_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not active.');
  END IF;

  -- NEW CHECK: Refund only possible for insured contracts
  IF NOT contract_record.is_insured THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le remboursement anticipé est uniquement possible pour les contrats assurés.');
  END IF;

  -- Check business logic: refund only possible within the first 5 months
  IF contract_record.months_paid >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le remboursement anticipé est uniquement possible dans les 5 premiers mois.');
  END IF;

  -- Update contract status to 'pending_refund'
  UPDATE public.contracts SET status = 'pending_refund' WHERE id = _contract_id;

  -- Notify admins
  PERFORM public.notify_all_admins('Nouvelle demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8), '/admin/refunds');

  RETURN jsonb_build_object('success', true, 'message', 'Your refund request has been submitted for approval.');
END;
$$;
