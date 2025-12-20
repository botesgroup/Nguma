-- Met à jour la fonction approve_withdrawal pour envoyer un e-mail à l'utilisateur via la nouvelle Edge Function.

CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
  target_transaction RECORD;
  user_profile record;
  is_admin_user boolean;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  
  SELECT * INTO target_transaction FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'withdrawal';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); END IF;

  -- Get user profile for email details
  SELECT email, first_name, last_name INTO user_profile
  FROM public.profiles
  WHERE id = target_transaction.user_id;

  -- Decrement locked_balance. We assume the funds were already checked when locked.
  UPDATE public.wallets
  SET locked_balance = locked_balance - target_transaction.amount
  WHERE user_id = target_transaction.user_id;

  IF NOT FOUND THEN
    UPDATE public.transactions SET status = 'failed', description = 'Wallet not found during approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found. Transaction marked as failed.');
  END IF;

  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;
  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'withdrawal_approved',
          target_transaction.user_id,
          user_profile.email,
          jsonb_build_object(
              'name', user_profile.first_name || ' ' || user_profile.last_name,
              'amount', target_transaction.amount
          )
      );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;