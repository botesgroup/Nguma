
-- This file updates RPC functions to handle notification lifecycle (creation with ref_id and marking as read on action).

-- 1. Update request_deposit to include the transaction_id in the notification
CREATE OR REPLACE FUNCTION public.request_deposit(deposit_amount NUMERIC(20,8), deposit_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
  new_transaction_id UUID;
BEGIN
  IF deposit_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Deposit amount must be positive'); END IF;
  SELECT currency INTO user_currency FROM public.wallets WHERE user_id = current_user_id;
  IF NOT FOUND THEN user_currency := 'USD'; END IF;

  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description)
  VALUES (auth.uid(), 'deposit', deposit_amount, user_currency, 'pending', deposit_method, 'User deposit request via ' || deposit_method)
  RETURNING id INTO new_transaction_id;

  PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' ' || user_currency, '/admin/deposits', new_transaction_id);
  RETURN jsonb_build_object('success', true, 'message', 'Deposit request created and is pending approval.');
END;
$$;

-- 2. Update user_withdraw to include the transaction_id in the notification
CREATE OR REPLACE FUNCTION public.user_withdraw(withdraw_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  new_transaction_id UUID;
BEGIN
  IF withdraw_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be positive'); END IF;
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.profit_balance < withdraw_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance'); END IF;
  
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (current_user_id, 'withdrawal', withdraw_amount, user_wallet.currency, 'pending', 'User withdrawal request')
  RETURNING id INTO new_transaction_id;

  PERFORM public.notify_all_admins('Nouvelle demande de retrait de ' || withdraw_amount || ' ' || user_wallet.currency, '/admin/withdrawals', new_transaction_id);
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request created and is pending approval.');
END;
$$;

-- 3. Update approve_deposit to mark related admin notifications as read
CREATE OR REPLACE FUNCTION public.approve_deposit(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  SELECT * INTO target_transaction FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'deposit';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending transaction not found'); END IF;

  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;
  UPDATE public.wallets SET total_balance = total_balance + target_transaction.amount WHERE user_id = target_transaction.user_id;

  -- Mark admin notifications for this transaction as read
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;

  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre dépôt de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;

-- 4. Update approve_withdrawal to mark related admin notifications as read
CREATE OR REPLACE FUNCTION public.approve_withdrawal(transaction_id_to_approve UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_transaction RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  SELECT * INTO target_transaction FROM public.transactions WHERE id = transaction_id_to_approve AND status = 'pending' AND type = 'withdrawal';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); END IF;

  UPDATE public.wallets SET total_balance = total_balance - target_transaction.amount, profit_balance = profit_balance - target_transaction.amount WHERE user_id = target_transaction.user_id AND profit_balance >= target_transaction.amount;
  IF NOT FOUND THEN
    UPDATE public.transactions SET status = 'failed', description = 'Insufficient funds at time of approval' WHERE id = transaction_id_to_approve;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds at time of approval. Transaction marked as failed.');
  END IF;

  UPDATE public.transactions SET status = 'completed' WHERE id = transaction_id_to_approve;

  -- Mark admin notifications for this transaction as read
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_approve;

  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;

-- 5. Update reject_withdrawal to mark related admin notifications as read
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  UPDATE public.transactions SET status = 'cancelled', description = 'Withdrawal rejected by admin. Reason: ' || reason WHERE id = transaction_id_to_reject AND status = 'pending' AND type = 'withdrawal';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); END IF;

  -- Mark admin notifications for this transaction as read
  UPDATE public.notifications SET is_read = true WHERE reference_id = transaction_id_to_reject;

  INSERT INTO public.notifications (user_id, message, link_to) SELECT user_id, 'Votre retrait a été rejeté. Raison: ' || reason, '/wallet' FROM public.transactions WHERE id = transaction_id_to_reject;
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
END;
$$;

-- 6. Update notify_all_admins to accept a reference_id
CREATE OR REPLACE FUNCTION public.notify_all_admins(message_text TEXT, link TEXT DEFAULT NULL, reference_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, message, link_to, reference_id) VALUES (admin_record.user_id, message_text, link, reference_id);
  END LOOP;
END;
$$;
