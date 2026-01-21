-- Migration: Update notifications for profit transfer and monthly profit distribution
-- Date: 2026-01-21
-- Description: 
-- 1. Update transfer_profit_to_deposit to ONLY notify admins by email.
-- 2. Update calculate_monthly_profits to send a summary email to admins after distribution.

-- 1. Update transfer_profit_to_deposit
CREATE OR REPLACE FUNCTION public.transfer_profit_to_deposit(p_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet RECORD;
  profile_data RECORD;
  admin_record RECORD;
BEGIN
  -- 1. Get user wallet and check PROFIT balance
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_wallet.profit_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde de profit insuffisant');
  END IF;

  -- Get user profile
  SELECT * INTO profile_data FROM public.profiles WHERE id = v_user_id;

  -- 2. Update wallet balances
  UPDATE public.wallets
  SET
    profit_balance = profit_balance - p_amount,
    total_balance = total_balance + p_amount
  WHERE user_id = v_user_id;

  -- 3. Create transfer transaction
  INSERT INTO public.transactions (
    user_id, type, amount, currency, status, description, metadata
  )
  VALUES (
    v_user_id, 'transfer', p_amount, v_wallet.currency, 'completed',
    'Transfert du solde de profit vers le capital déposable (Capitalisation)',
    jsonb_build_object('from', 'profit_balance', 'to', 'total_balance')
  );

  -- 4. In-app notification for user
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_user_id, 'Transfert Réussi', 
    'Vous avez transféré ' || p_amount || ' ' || v_wallet.currency || ' de vos profits vers votre balance de dépôt.',
    'wallet_update'
  );

  -- 5. Email notification for ADMINS ONLY
  FOR admin_record IN
      SELECT u.id as admin_id, u.email as admin_email FROM auth.users u
      JOIN public.user_roles ur ON u.id = ur.user_id
      WHERE ur.role = 'admin'
  LOOP
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'new_profit_transfer_admin',
          admin_record.admin_id,
          admin_record.admin_email,
          jsonb_build_object(
              'to', admin_record.admin_email,
              'amount', p_amount,
              'email', profile_data.email,
              'userName', COALESCE(profile_data.first_name || ' ' || profile_data.last_name, profile_data.email),
              'userId', v_user_id
          )
      );
  END LOOP;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Update calculate_monthly_profits
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  user_profile record;
  admin_record record;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
  v_total_distributed NUMERIC(20,8) := 0;
  v_investor_count INTEGER := 0;
BEGIN
  -- Loop through all active contracts that have not completed their term.
  FOR contract_record IN 
    SELECT * FROM public.contracts 
    WHERE status = 'active' AND months_paid < duration_months 
  LOOP
    -- Check if the next monthly anniversary of the contract has been reached.
    IF now() >= (contract_record.start_date + (contract_record.months_paid + 1) * interval '1 month') THEN
      
      -- If the anniversary is reached, proceed with profit distribution.
      current_month := contract_record.months_paid + 1;
      profit_amount := contract_record.amount * contract_record.monthly_rate;
      
      -- Get user profile for email details
      SELECT email, first_name, last_name INTO user_profile
      FROM public.profiles
      WHERE id = contract_record.user_id;

      -- 1. Insert into profits table
      INSERT INTO public.profits (contract_id, user_id, amount, month_number) 
      VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
      
      -- 2. Update user's wallet
      UPDATE public.wallets SET profit_balance = profit_balance + profit_amount 
      WHERE user_id = contract_record.user_id;
      
      -- 3. Create a transaction record
      INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
      VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Monthly profit from contract month ' || current_month::TEXT);
      
      -- 4. Update the contract itself
      UPDATE public.contracts 
      SET 
        months_paid = current_month, 
        total_profit_paid = total_profit_paid + profit_amount, 
        last_profit_distribution_date = now(),
        status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END 
      WHERE id = contract_record.id;
      
      -- 5. Notify the user (in-app)
      INSERT INTO public.notifications (user_id, message, link_to) 
      VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet');

      -- 6. Enqueue email notification for USER
      IF user_profile.email IS NOT NULL THEN
          INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
          VALUES (
              'monthly_profit',
              contract_record.user_id,
              user_profile.email,
              jsonb_build_object(
                  'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, 'Investisseur'),
                  'amount', profit_amount
              )
          );
      END IF;

      -- Update global counters for admin summary
      v_total_distributed := v_total_distributed + profit_amount;
      v_investor_count := v_investor_count + 1;

    END IF; -- End of the anniversary check
  END LOOP;

  -- 7. NOTIFICATION RÉSUMÉ ADMIN (NEW)
  IF v_investor_count > 0 THEN
      FOR admin_record IN
          SELECT u.id as admin_id, u.email as admin_email FROM auth.users u
          JOIN public.user_roles ur ON u.id = ur.user_id
          WHERE ur.role = 'admin'
      LOOP
          INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
          VALUES (
              'profit_distribution_summary_admin',
              admin_record.admin_id,
              admin_record.admin_email,
              jsonb_build_object(
                  'to', admin_record.admin_email,
                  'totalAmount', v_total_distributed,
                  'investorCount', v_investor_count,
                  'date', now()::date::text
              )
          );
      END LOOP;
  END IF;
END;
$$;
