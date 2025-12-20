-- Met à jour la fonction calculate_monthly_profits pour envoyer un e-mail à l'utilisateur via la nouvelle Edge Function.

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
        last_profit_distribution_date = now(), -- Set the date of the last distribution
        status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END 
      WHERE id = contract_record.id;
      
      -- 5. Notify the user (in-app)
      INSERT INTO public.notifications (user_id, message, link_to) 
      VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet');

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

    END IF; -- End of the anniversary check
  END LOOP;
END;
$$;