-- Update notification functions to include type and priority
-- This migration ensures all notification inserts use the new columns

-- 1. Update approve_deposit function
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
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent approuver les dépôts.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_approve AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    UPDATE public.wallets
    SET total_balance = total_balance + transaction_record.amount
    WHERE user_id = transaction_record.user_id;

    UPDATE public.transactions
    SET status = 'completed',
        updated_at = now()
    WHERE id = transaction_id_to_approve;

    -- Updated: Add type and priority
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (transaction_record.user_id, 'Votre dépôt de ' || transaction_record.amount || ' a été approuvé.', transaction_id_to_approve, '/wallet', 'transaction', 'high');

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
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors de l''approbation du dépôt.');
END;
$$;

-- 2. Update reject_deposit function
CREATE OR REPLACE FUNCTION public.reject_deposit(
    transaction_id_to_reject uuid,
    reason text
)
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
BEGIN
    SELECT public.has_role(auth.uid(), 'admin') INTO is_admin_user;
    IF NOT is_admin_user THEN
        RETURN json_build_object('success', false, 'error', 'Accès refusé. Seuls les administrateurs peuvent rejeter les dépôts.');
    END IF;

    IF reason IS NULL OR trim(reason) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Une raison pour le rejet est obligatoire.');
    END IF;

    SELECT * INTO transaction_record
    FROM public.transactions
    WHERE id = transaction_id_to_reject AND type = 'deposit' AND status = 'pending';

    IF transaction_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction de dépôt en attente non trouvée.');
    END IF;

    SELECT email, first_name, last_name INTO user_profile
    FROM public.profiles
    WHERE id = transaction_record.user_id;

    UPDATE public.transactions
    SET 
        status = 'failed',
        description = 'Rejeté par l''admin. Raison: ' || reason,
        updated_at = now()
    WHERE id = transaction_id_to_reject;

    -- Updated: Add type and priority
    INSERT INTO public.notifications (user_id, message, reference_id, link_to, type, priority)
    VALUES (
        transaction_record.user_id, 
        'Votre dépôt de ' || transaction_record.amount || ' a été rejeté. Raison: ' || reason, 
        transaction_id_to_reject, 
        '/wallet',
        'transaction',
        'high'
    );

    IF user_profile.email IS NOT NULL THEN
        INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
        VALUES (
            'deposit_rejected',
            transaction_record.user_id,
            user_profile.email,
            jsonb_build_object(
                'name', user_profile.first_name || ' ' || user_profile.last_name,
                'amount', transaction_record.amount,
                'reason', reason
            )
        );
    END IF;

    RETURN json_build_object('success', true);

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'Une erreur inattendue est survenue lors du rejet du dépôt.');
END;
$$;

-- 3. Update calculate_monthly_profits function
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  user_profile record;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
BEGIN
  FOR contract_record IN 
    SELECT * FROM public.contracts 
    WHERE status = 'active' AND months_paid < duration_months 
  LOOP
    IF now() >= (contract_record.start_date + (contract_record.months_paid + 1) * interval '1 month') THEN
      
      current_month := contract_record.months_paid + 1;
      profit_amount := contract_record.amount * contract_record.monthly_rate;
      
      SELECT email, first_name, last_name INTO user_profile
      FROM public.profiles
      WHERE id = contract_record.user_id;

      INSERT INTO public.profits (contract_id, user_id, amount, month_number) 
      VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
      
      UPDATE public.wallets SET profit_balance = profit_balance + profit_amount 
      WHERE user_id = contract_record.user_id;
      
      INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
      VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Monthly profit from contract month ' || current_month::TEXT);
      
      UPDATE public.contracts 
      SET 
        months_paid = current_month, 
        total_profit_paid = total_profit_paid + profit_amount, 
        last_profit_distribution_date = now(),
        status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END 
      WHERE id = contract_record.id;
      
      -- Updated: Add type and priority
      INSERT INTO public.notifications (user_id, message, link_to, type, priority) 
      VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet', 'profit', 'medium');

      IF user_profile.email IS NOT NULL THEN
          INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
          VALUES (
              'monthly_profit',
              contract_record.user_id,
              user_profile.email,
              jsonb_build_object(
                  'name', user_profile.first_name || ' ' || user_profile.last_name,
                  'amount', profit_amount
              )
          );
      END IF;

    END IF;
  END LOOP;
END;
$$;
