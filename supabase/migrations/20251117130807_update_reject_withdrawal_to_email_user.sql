-- Met à jour la fonction reject_withdrawal pour envoyer un e-mail à l'utilisateur via la nouvelle Edge Function.

CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ 
DECLARE
  target_transaction RECORD;
  user_wallet RECORD;
  user_profile record;
  is_admin_user boolean;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin');
  END IF;

  -- Find the pending transaction
  SELECT * INTO target_transaction
  FROM public.transactions
  WHERE id = transaction_id_to_reject AND status = 'pending' AND type = 'withdrawal';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found');
  END IF;

  -- Get the user's wallet
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = target_transaction.user_id;

  -- Get user profile for email details
  SELECT email, first_name, last_name INTO user_profile
  FROM public.profiles
  WHERE id = target_transaction.user_id;

  -- Check if there are enough funds in locked_balance to perform the reversal.
  -- This handles legacy transactions where funds were never locked.
  IF user_wallet.locked_balance >= target_transaction.amount THEN
    -- Standard case: Return the locked funds to the profit balance
    UPDATE public.wallets
    SET
      profit_balance = profit_balance + target_transaction.amount,
      locked_balance = locked_balance - target_transaction.amount
    WHERE user_id = target_transaction.user_id;
  END IF;
  -- If locked_balance is insufficient, we assume it's a legacy transaction
  -- and no balance update is needed, as the funds were never locked.

  -- Update the transaction status to cancelled
  UPDATE public.transactions
  SET status = 'cancelled', description = 'Withdrawal rejected by admin. Reason: ' || reason
  WHERE id = transaction_id_to_reject;

  -- Update notifications (in-app)
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_reject;
  INSERT INTO public.notifications (user_id, message, link_to)
  SELECT user_id, 'Votre retrait a été rejeté. Raison: ' || reason, '/wallet'
  FROM public.transactions
  WHERE id = transaction_id_to_reject;

  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'withdrawal_rejected',
          target_transaction.user_id,
          user_profile.email,
          jsonb_build_object(
              'name', user_profile.first_name || ' ' || user_profile.last_name,
              'amount', target_transaction.amount,
              'reason', reason
          )
      );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
END;
$$;