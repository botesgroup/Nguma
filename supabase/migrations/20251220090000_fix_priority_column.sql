-- Migration corrective: Retirer les colonnes 'priority' qui n'existent pas dans notifications_queue

CREATE OR REPLACE FUNCTION public.request_deposit(
  deposit_amount NUMERIC(20,8),
  deposit_method TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_payment_phone_number TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
  v_deposit_enabled BOOLEAN;
  v_user_email TEXT;
  v_user_name TEXT;
  v_transaction_id TEXT;
  v_admin_emails TEXT;
BEGIN
  -- 1. Get deposit control settings
  SELECT COALESCE((SELECT value FROM settings WHERE key = 'deposit_enabled')::BOOLEAN, TRUE)
  INTO v_deposit_enabled;

  -- 2. Check if deposits are globally enabled
  IF NOT v_deposit_enabled THEN
    RAISE EXCEPTION 'Les dépôts sont actuellement désactivés par l''administrateur.';
  END IF;

  -- 3. Validate amount
  IF deposit_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du dépôt doit être positif.';
  END IF;

  -- 4. Get user info
  SELECT 
    w.currency,
    p.email,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) AS full_name
  INTO 
    user_currency,
    v_user_email,
    v_user_name
  FROM public.wallets w
  INNER JOIN public.profiles p ON w.user_id = p.id
  WHERE w.user_id = current_user_id;
  
  IF NOT FOUND THEN
    user_currency := 'USD';
  END IF;

  -- 5. Create transaction and get ID
  INSERT INTO public.transactions (
    user_id, type, amount, currency, status, method, description, 
    payment_reference, payment_phone_number, proof_url
  )
  VALUES (
    current_user_id,
    'deposit',
    deposit_amount,
    user_currency,
    'pending',
    deposit_method,
    'User deposit request via ' || deposit_method,
    p_payment_reference,
    p_payment_phone_number,
    p_proof_url
  )
  RETURNING id::TEXT INTO v_transaction_id;

  -- 6. Send email to USER (deposit_pending)
  INSERT INTO public.notifications_queue (
    template_id,
    recipient_email,
    notification_params
  ) VALUES (
    'deposit_pending',
    v_user_email,
    jsonb_build_object(
      'to', v_user_email,
      'name', v_user_name,
      'amount', deposit_amount,
      'currency', user_currency
    )
  );

  -- 7. Get admin emails
  SELECT string_agg(email, ',')
  INTO v_admin_emails
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.id = ur.user_id
  WHERE ur.role = 'admin';

  -- 8. Send ENRICHED email to ADMIN (new_deposit_request)
  IF v_admin_emails IS NOT NULL THEN
    INSERT INTO public.notifications_queue (
      template_id,
      recipient_email,
      notification_params
    ) VALUES (
      'new_deposit_request',
      v_admin_emails,
      jsonb_build_object(
        'to', v_admin_emails,
        'amount', deposit_amount,
        'email', v_user_email,
        'userName', v_user_name,
        'transactionId', v_transaction_id,
        'paymentMethod', deposit_method,
        'proofUrl', p_proof_url
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Votre demande de dépôt a été créée et est en attente d''approbation.');
END;
$$;

COMMENT ON FUNCTION public.request_deposit IS 'Creates pending deposit transaction with enriched email notifications to user and admins';

-- ============================================================================
-- Helper function to notify admins of new contracts (WITHOUT priority)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_admins_new_contract(
  p_contract_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_duration INTEGER,
  p_rate NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_emails TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
  v_start_date TEXT;
BEGIN
  -- Get user info
  SELECT 
    email,
    COALESCE(first_name || ' ' || last_name, email)
  INTO 
    v_user_email,
    v_user_name
  FROM public.profiles
  WHERE id = p_user_id;

  -- Get contract start date
  SELECT created_at::DATE::TEXT
  INTO v_start_date
  FROM public.contracts
  WHERE id = p_contract_id;

  -- Get admin emails
  SELECT string_agg(email, ',')
  INTO v_admin_emails
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.id = ur.user_id
  WHERE ur.role = 'admin';

  -- Send email to admins (WITHOUT priority column)
  IF v_admin_emails IS NOT NULL THEN
    INSERT INTO public.notifications_queue (
      template_id,
      recipient_email,
      notification_params
    ) VALUES (
      'new_contract_admin',
      v_admin_emails,
      jsonb_build_object(
        'to', v_admin_emails,
        'userName', v_user_name,
        'email', v_user_email,
        'amount', p_amount,
        'duration', p_duration,
        'rate', p_rate,
        'contractId', p_contract_id::TEXT,
        'startDate', v_start_date
      )
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.notify_admins_new_contract IS 'Sends new_contract_admin email notification to all admins when a contract is created';
