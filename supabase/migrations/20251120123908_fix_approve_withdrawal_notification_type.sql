-- Fix approve_withdrawal notification type to use 'transaction' instead of invalid 'withdrawal'

CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ 
DECLARE
  target_transaction RECORD;
  user_profile record;
  user_wallet record;
  is_admin_user boolean;
  project_url TEXT := 'https://kaqxoavnoabcnszzmwye.supabase.co';
  payload JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); 
  END IF;
  
  SELECT * INTO target_transaction 
  FROM public.transactions 
  WHERE id = transaction_id_to_approve 
    AND status = 'pending' 
    AND type = 'withdrawal';
  
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); 
  END IF;

  -- Get user profile for email details
  SELECT email, first_name, last_name INTO user_profile
  FROM public.profiles
  WHERE id = target_transaction.user_id;

  -- Get wallet to check locked_balance
  SELECT * INTO user_wallet
  FROM public.wallets
  WHERE user_id = target_transaction.user_id;

  IF NOT FOUND THEN
    UPDATE public.transactions 
    SET status = 'failed', 
        description = 'Wallet not found during approval' 
    WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found. Transaction marked as failed.');
  END IF;

  -- Check if locked_balance is sufficient
  IF user_wallet.locked_balance < target_transaction.amount THEN
    UPDATE public.transactions 
    SET status = 'failed', 
        description = 'Insufficient locked balance' 
    WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient locked balance. Transaction marked as failed.');
  END IF;

  -- Decrement locked_balance (now safe because we checked above)
  UPDATE public.wallets
  SET locked_balance = locked_balance - target_transaction.amount
  WHERE user_id = target_transaction.user_id;

  -- Mark transaction as completed
  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;
  
  -- Mark related admin notifications as read
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;
  
  -- FIXED: Use 'transaction' instead of 'withdrawal' (valid type per CHECK constraint)
  INSERT INTO public.notifications (user_id, message, link_to, type, priority) 
  VALUES (
    target_transaction.user_id, 
    'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', 
    '/wallet',
    'transaction',  -- FIXED: Changed from 'withdrawal' to 'transaction'
    'high'
  );
  
  IF user_profile.email IS NOT NULL THEN
      INSERT INTO public.notifications_queue (template_id, recipient_user_id, recipient_email, notification_params)
      VALUES (
          'withdrawal_approved',
          target_transaction.user_id,
          user_profile.email,
          jsonb_build_object(
              'name', COALESCE(user_profile.first_name || ' ' || user_profile.last_name, user_profile.email),
              'amount', target_transaction.amount
          )
      );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;
