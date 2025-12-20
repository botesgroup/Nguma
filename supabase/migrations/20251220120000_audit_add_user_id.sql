-- Migration: Audit & Fix - Add missing user_id to notifications_queue
-- Date: 2025-12-20
-- Description: Ensures recipient_user_id is populated for all recent notifications (Refunds, Security, Profiles)

-- 1. Fix request_refund (User notification only, Admin uses list)
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

  -- Check insurance logic
  IF contract_record.is_insured IS FALSE AND contract_record.months_paid >= 5 THEN
     RETURN jsonb_build_object('success', false, 'error', 'Le remboursement anticipé est uniquement possible dans les 5 premiers mois pour les contrats non assurés.');
  END IF;

  -- Update contract status to 'pending_refund'
  UPDATE public.contracts SET status = 'pending_refund' WHERE id = _contract_id;

  -- ESTIMATE Amount
  IF contract_record.is_insured THEN
      v_refund_amount := contract_record.amount;
  ELSE
      v_refund_amount := contract_record.amount - contract_record.total_profit_paid;
      IF v_refund_amount < 0 THEN v_refund_amount := 0; END IF;
  END IF;

  -- 1. Notify User (Email) - ADDED recipient_user_id
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (
          template_id,
          recipient_user_id, -- ADDED
          recipient_email,
          notification_params
      ) VALUES (
          'refund_requested',
          current_user_id, -- ADDED
          user_profile.email,
          jsonb_build_object(
              'userId', current_user_id, -- ALSO ADDED TO PARAMS
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

  -- 2. Notify Admins (Email) - No single user_id
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

-- 2. Fix approve_refund
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
    IF NOT is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
    END IF;

    SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND status = 'pending_refund';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not pending refund.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = contract_record.user_id;

    IF contract_record.is_insured THEN
        refund_amount := contract_record.amount;
    ELSE
        refund_amount := contract_record.amount - contract_record.total_profit_paid;
        IF refund_amount < 0 THEN refund_amount := 0; END IF;
    END IF;

    UPDATE public.wallets 
    SET total_balance = total_balance + refund_amount, 
        invested_balance = invested_balance - contract_record.amount 
    WHERE user_id = contract_record.user_id;

    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description, status)
    VALUES (contract_record.user_id, 'refund', refund_amount, contract_record.currency, _contract_id, CASE WHEN contract_record.is_insured THEN 'Remboursement intégral - Contrat assuré' ELSE 'Remboursement anticipé' END, 'completed');

    UPDATE public.contracts SET status = 'refunded' WHERE id = _contract_id;

    -- Notify user (Email) - ADDED recipient_user_id
    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (
            template_id,
            recipient_user_id, -- ADDED
            recipient_email,
            notification_params
        ) VALUES (
            'refund_approved',
            contract_record.user_id, -- ADDED
            user_profile.email,
            jsonb_build_object(
                'userId', contract_record.user_id, -- ADDED
                'to', user_profile.email,
                'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                'amount', refund_amount,
                'contractId', _contract_id::TEXT,
                'date', to_char(now(), 'DD/MM/YYYY')
            )
        );
    END IF;

    INSERT INTO public.notifications(user_id, message, link_to, type, priority)
    VALUES (contract_record.user_id, 'Votre demande de remboursement pour le contrat #' || substr(_contract_id::text, 1, 8) || ' a été approuvée.', '/contracts', 'system', 'high');

    RETURN jsonb_build_object('success', true, 'message', 'Refund approved successfully.', 'refund_amount', refund_amount, 'was_insured', contract_record.is_insured);
END;
$$;

-- 3. Fix reject_refund
CREATE OR REPLACE FUNCTION public.reject_refund(_contract_id UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  user_profile RECORD;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
  END IF;

  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND status = 'pending_refund';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not pending refund.');
  END IF;

  SELECT email, first_name, last_name INTO user_profile FROM public.profiles WHERE id = contract_record.user_id;

  UPDATE public.contracts SET status = 'active' WHERE id = _contract_id;

  -- Notify user (Email) - ADDED recipient_user_id
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (
          template_id,
          recipient_user_id, -- ADDED
          recipient_email,
          notification_params
      ) VALUES (
          'refund_rejected',
          contract_record.user_id, -- ADDED
          user_profile.email,
          jsonb_build_object(
              'userId', contract_record.user_id, -- ADDED
              'to', user_profile.email,
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
              'contractId', _contract_id::TEXT,
              'reason', reason
          )
      );
  END IF;

  INSERT INTO public.notifications(user_id, message, link_to, type, priority)
  VALUES (contract_record.user_id, 'Votre demande de remboursement a été rejetée. Raison: ' || reason, '/contracts', 'system', 'high');

  RETURN jsonb_build_object('success', true, 'message', 'Refund request rejected.');
END;
$$;

-- 4. Fix admin_update_user_profile
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    _user_id UUID,
    _first_name TEXT,
    _last_name TEXT,
    _phone_number TEXT,
    _country TEXT,
    _city TEXT,
    _address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_old_profile RECORD;
    v_updated_fields TEXT[];
    v_updater_id UUID;
    v_profile_email TEXT;
BEGIN
    v_updater_id := auth.uid();
    IF NOT is_admin(v_updater_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied');
    END IF;

    SELECT * INTO v_old_profile FROM public.profiles WHERE id = _user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    v_profile_email := v_old_profile.email;

    v_updated_fields := ARRAY[]::TEXT[];
    IF v_old_profile.first_name IS DISTINCT FROM _first_name THEN v_updated_fields := array_append(v_updated_fields, 'Prénom'); END IF;
    IF v_old_profile.last_name IS DISTINCT FROM _last_name THEN v_updated_fields := array_append(v_updated_fields, 'Nom'); END IF;
    IF v_old_profile.phone_number IS DISTINCT FROM _phone_number THEN v_updated_fields := array_append(v_updated_fields, 'Téléphone'); END IF;
    IF v_old_profile.country IS DISTINCT FROM _country THEN v_updated_fields := array_append(v_updated_fields, 'Pays'); END IF;
    IF v_old_profile.city IS DISTINCT FROM _city THEN v_updated_fields := array_append(v_updated_fields, 'Ville'); END IF;
    IF v_old_profile.address IS DISTINCT FROM _address THEN v_updated_fields := array_append(v_updated_fields, 'Adresse'); END IF;

    UPDATE public.profiles
    SET 
        first_name = _first_name,
        last_name = _last_name,
        phone_number = _phone_number,
        country = _country,
        city = _city,
        address = _address,
        updated_at = NOW()
    WHERE id = _user_id;

    -- Notification Email - ADDED recipient_user_id
    IF array_length(v_updated_fields, 1) > 0 AND v_profile_email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (
            template_id,
            recipient_user_id, -- ADDED
            recipient_email,
            notification_params
        ) VALUES (
            'profile_updated_by_admin',
            _user_id, -- ADDED
            v_profile_email,
            jsonb_build_object(
                 'userId', _user_id, -- ADDED
                 'to', v_profile_email,
                 'name', _first_name || ' ' || _last_name,
                 'updatedFields', array_to_string(v_updated_fields, ', '),
                 'date', to_char(now(), 'DD/MM/YYYY HH24:MI')
            )
        );

        INSERT INTO public.notifications (user_id, type, title, message, link_to, priority)
        VALUES (
            _user_id,
            'security',
            'Profil mis à jour',
            'Un administrateur a mis à jour votre profil. Champs modifiés : ' || array_to_string(v_updated_fields, ', '),
            '/settings',
            'high'
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Fix check_suspicious_login trigger
CREATE OR REPLACE FUNCTION public.check_suspicious_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email TEXT;
    v_user_name TEXT;
    v_prev_login RECORD;
BEGIN
    SELECT email, first_name, last_name INTO v_user_email, v_user_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Check if this is not the first login
    SELECT * INTO v_prev_login
    FROM public.login_audit
    WHERE user_id = NEW.user_id AND id != NEW.id
    ORDER BY login_at DESC
    LIMIT 1;

    IF v_prev_login IS NOT NULL THEN
        -- Check if IP is different from last login
        IF v_prev_login.ip_address != NEW.ip_address THEN
            -- Send Security Alert Email - ADDED recipient_user_id
            INSERT INTO public.notifications_queue (
                template_id,
                recipient_user_id, -- ADDED
                recipient_email,
                notification_params
            ) VALUES (
                'security_alert',
                NEW.user_id, -- ADDED
                v_user_email,
                jsonb_build_object(
                    'userId', NEW.user_id, -- ADDED
                    'to', v_user_email,
                    'name', COALESCE(v_user_name, 'Utilisateur'),
                    'activityType', 'Connexion depuis une nouvelle adresse IP',
                    'ipAddress', NEW.ip_address, -- Normalized param name
                    'date', to_char(NEW.login_at, 'DD/MM/YYYY HH24:MI')
                )
            );
            
            INSERT INTO public.notifications (user_id, type, title, message, link_to, priority)
            VALUES (
                NEW.user_id,
                'security',
                'Nouvelle connexion détectée',
                'Une connexion depuis une nouvelle adresse IP (' || NEW.ip_address || ') a été détectée.',
                '/settings/security',
                'high'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
