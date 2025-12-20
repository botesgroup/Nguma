-- Migration: Enable Email Notifications for Refund Flow
-- Date: 2025-12-20
-- Description: 
-- 1. Updates request_refund to email admins (new_refund_request) and user (refund_requested)
-- 2. Updates approve_refund to email user (refund_approved)
-- 3. Updates reject_refund to email user (refund_rejected)

-- 1. Update request_refund
CREATE OR REPLACE FUNCTION public.request_refund(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  current_user_id UUID := auth.uid();
  user_profile RECORD;
  v_admin_emails TEXT;
  v_refund_amount NUMERIC(20,8);
BEGIN
  -- Find the active contract for the current user
  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND user_id = current_user_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not active.');
  END IF;

  -- Get user profile
  SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = current_user_id;

  -- Check insurance logic if applicable (keeping existing logic)
  IF contract_record.is_insured IS FALSE AND contract_record.months_paid >= 5 THEN
     RETURN jsonb_build_object('success', false, 'error', 'Le remboursement anticipé est uniquement possible dans les 5 premiers mois pour les contrats non assurés.');
  END IF;

  -- Update contract status to 'pending_refund'
  UPDATE public.contracts SET status = 'pending_refund' WHERE id = _contract_id;

  -- ESTIMATE Amount for notification (logic from approve_refund)
  IF contract_record.is_insured THEN
      v_refund_amount := contract_record.amount;
  ELSE
      v_refund_amount := contract_record.amount - contract_record.total_profit_paid;
      IF v_refund_amount < 0 THEN v_refund_amount := 0; END IF;
  END IF;

  -- 1. Notify User (Email)
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (
          template_id,
          recipient_email,
          notification_params
      ) VALUES (
          'refund_requested',
          user_profile.email,
          jsonb_build_object(
              'to', user_profile.email,
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'amount', v_refund_amount,
              'contractId', _contract_id::TEXT,
              'date', to_char(now(), 'DD/MM/YYYY')
          )
      );
  END IF;

  -- Get admin emails
  SELECT string_agg(email, ',') INTO v_admin_emails
  FROM public.profiles p
  JOIN public.user_roles ur ON p.id = ur.user_id
  WHERE ur.role = 'admin';

  -- 2. Notify Admins (Email)
  IF v_admin_emails IS NOT NULL THEN
      INSERT INTO public.notifications_queue (
          template_id,
          recipient_email,
          notification_params
      ) VALUES (
          'new_refund_request',
          v_admin_emails,
          jsonb_build_object(
              'to', v_admin_emails,
              'userName', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'userEmail', user_profile.email,
              'amount', v_refund_amount,
              'contractId', _contract_id::TEXT,
              'date', to_char(now(), 'DD/MM/YYYY')
          )
      );
  END IF;

  -- 3. Notify Admins (In-App)
  PERFORM public.notify_all_admins('Nouvelle demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8), '/admin/refunds');

  RETURN jsonb_build_object('success', true, 'message', 'Your refund request has been submitted for approval.');
END;
$$;

-- 2. Update approve_refund
CREATE OR REPLACE FUNCTION public.approve_refund(_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    contract_record RECORD;
    refund_amount NUMERIC(20,8);
    user_profile RECORD;
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

    -- Get user profile
    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = contract_record.user_id;

    -- Calculate refund amount
    IF contract_record.is_insured THEN
        refund_amount := contract_record.amount;
    ELSE
        refund_amount := contract_record.amount - contract_record.total_profit_paid;
        IF refund_amount < 0 THEN refund_amount := 0; END IF;
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
        CASE WHEN contract_record.is_insured THEN 'Remboursement intégral - Contrat assuré' ELSE 'Remboursement anticipé' END,
        'completed'
    );

    -- Update contract status to 'refunded'
    UPDATE public.contracts SET status = 'refunded' WHERE id = _contract_id;

    -- Notify user (Email)
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (
            template_id,
            recipient_email,
            notification_params
        ) VALUES (
            'refund_approved',
            user_profile.email,
            jsonb_build_object(
                'to', user_profile.email,
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', refund_amount,
                'contractId', _contract_id::TEXT,
                'date', to_char(now(), 'DD/MM/YYYY')
            )
        );
    END IF;

    -- Notify user (In-App)
    INSERT INTO public.notifications(user_id, message, link_to, type, priority)
    VALUES (
        contract_record.user_id, 
        'Votre demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8) || ' a été approuvée.', 
        '/contracts',
        'system',
        'high'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Refund approved successfully.',
        'refund_amount', refund_amount,
        'was_insured', contract_record.is_insured
    );
END;
$$;

-- 3. Update reject_refund
CREATE OR REPLACE FUNCTION public.reject_refund(_contract_id UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  user_profile RECORD;
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

  -- Get user profile
  SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = contract_record.user_id;

  -- Revert status to 'active'
  UPDATE public.contracts SET status = 'active' WHERE id = _contract_id;

  -- Notify user (Email)
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (
          template_id,
          recipient_email,
          notification_params
      ) VALUES (
          'refund_rejected',
          user_profile.email,
          jsonb_build_object(
              'to', user_profile.email,
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'contractId', _contract_id::TEXT,
              'reason', reason
          )
      );
  END IF;

  -- Notify user (In-App)
  INSERT INTO public.notifications(user_id, message, link_to, type, priority)
  VALUES (
      contract_record.user_id, 
      'Votre demande de remboursement a été rejetée. Raison: ' || reason, 
      '/contracts',
      'system',
      'high'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Refund request rejected.');
END;
$$;
