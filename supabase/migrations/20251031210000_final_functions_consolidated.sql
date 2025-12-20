
-- This file contains the final, corrected versions of ALL RPC functions to ensure consistency.

-- 1. handle_updated_at (Helper)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. has_role (Helper)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 3. notify_all_admins (Helper)
CREATE OR REPLACE FUNCTION public.notify_all_admins(message_text TEXT, link TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, message, link_to) VALUES (admin_record.user_id, message_text, link);
  END LOOP;
END;
$$;

-- 4. handle_new_user (Triggered on new user signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'investor');
  RETURN NEW;
END;
$$;

-- 5. request_deposit (User action)
CREATE OR REPLACE FUNCTION public.request_deposit(deposit_amount NUMERIC(20,8), deposit_method TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_currency TEXT;
BEGIN
  IF deposit_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Deposit amount must be positive'); END IF;
  SELECT currency INTO user_currency FROM public.wallets WHERE user_id = current_user_id;
  IF NOT FOUND THEN
    user_currency := 'USD'; -- Fallback to default currency if wallet is missing
  END IF;
  INSERT INTO public.transactions (user_id, type, amount, currency, status, method, description)
  VALUES (auth.uid(), 'deposit', deposit_amount, user_currency, 'pending', deposit_method, 'User deposit request via ' || deposit_method);
  PERFORM public.notify_all_admins('Nouvelle demande de dépôt de ' || deposit_amount || ' ' || user_currency, '/admin/deposits');
  RETURN jsonb_build_object('success', true, 'message', 'Deposit request created and is pending approval.');
END;
$$;

-- 6. user_withdraw (User action, now creates a pending request)
CREATE OR REPLACE FUNCTION public.user_withdraw(withdraw_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
BEGIN
  IF withdraw_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be positive'); END IF;
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.profit_balance < withdraw_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient profit balance'); END IF;
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description)
  VALUES (current_user_id, 'withdrawal', withdraw_amount, user_wallet.currency, 'pending', 'User withdrawal request');
  PERFORM public.notify_all_admins('Nouvelle demande de retrait de ' || withdraw_amount || ' ' || user_wallet.currency, '/admin/withdrawals');
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request created and is pending approval.');
END;
$$;

-- 7. create_new_contract (User action, duration in minutes)
CREATE OR REPLACE FUNCTION public.create_new_contract(investment_amount NUMERIC(20,8))
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  user_wallet RECORD;
  current_monthly_rate NUMERIC(10,8);
  contract_duration_minutes INTEGER;
  new_contract_id UUID;
BEGIN
  SELECT value::NUMERIC INTO current_monthly_rate FROM public.settings WHERE key = 'monthly_profit_rate';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Monthly profit rate not set'); END IF;
  SELECT value::INTEGER INTO contract_duration_minutes FROM public.settings WHERE key = 'contract_duration_months';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Contract duration not set'); END IF;
  SELECT * INTO user_wallet FROM public.wallets WHERE user_id = current_user_id;
  IF user_wallet.total_balance < investment_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance'); END IF;
  UPDATE public.wallets SET total_balance = total_balance - investment_amount, invested_balance = invested_balance + investment_amount WHERE user_id = current_user_id;
  INSERT INTO public.contracts (user_id, amount, currency, monthly_rate, end_date, duration_months)
  VALUES (current_user_id, investment_amount, user_wallet.currency, current_monthly_rate, now() + (contract_duration_minutes || ' minutes')::interval, contract_duration_minutes)
  RETURNING id INTO new_contract_id;
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (current_user_id, 'investment', investment_amount, user_wallet.currency, new_contract_id, 'New investment contract created');
  RETURN jsonb_build_object('success', true, 'contract_id', new_contract_id);
END;
$$;

-- 8. execute_refund (User action, with 5-month check and currency fix)
CREATE OR REPLACE FUNCTION public.execute_refund(_contract_id UUID, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  refund_amount NUMERIC(20,8);
BEGIN
  SELECT * INTO contract_record FROM public.contracts WHERE id = _contract_id AND user_id = _user_id AND status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not active'); END IF;
  IF contract_record.months_paid >= 5 THEN RETURN jsonb_build_object('success', false, 'error', 'Early refund is only possible within the first 5 months.'); END IF;
  refund_amount := contract_record.amount - contract_record.total_profit_paid;
  IF refund_amount < 0 THEN refund_amount := 0; END IF;
  UPDATE public.wallets SET total_balance = total_balance + refund_amount, invested_balance = invested_balance - contract_record.amount WHERE user_id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
  VALUES (_user_id, 'refund', refund_amount, contract_record.currency, _contract_id, 'Early refund from contract');
  UPDATE public.contracts SET status = 'refunded' WHERE id = _contract_id;
  RETURN jsonb_build_object('success', true, 'refund_amount', refund_amount, 'contract_id', _contract_id);
END;
$$;

-- 9. calculate_monthly_profits (Automated, with fixes)
CREATE OR REPLACE FUNCTION public.calculate_monthly_profits()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  contract_record RECORD;
  profit_amount NUMERIC(20,8);
  current_month INTEGER;
BEGIN
  FOR contract_record IN SELECT * FROM public.contracts WHERE status = 'active' AND months_paid < duration_months LOOP
    current_month := contract_record.months_paid + 1;
    profit_amount := contract_record.amount * contract_record.monthly_rate;
    INSERT INTO public.profits (contract_id, user_id, amount, month_number) VALUES (contract_record.id, contract_record.user_id, profit_amount, current_month);
    UPDATE public.wallets SET profit_balance = profit_balance + profit_amount WHERE user_id = contract_record.user_id;
    INSERT INTO public.transactions (user_id, type, amount, currency, reference_id, description)
    VALUES (contract_record.user_id, 'profit', profit_amount, contract_record.currency, contract_record.id, 'Monthly profit from contract month ' || current_month::TEXT);
    UPDATE public.contracts SET months_paid = current_month, total_profit_paid = total_profit_paid + profit_amount, status = CASE WHEN current_month >= duration_months THEN 'completed' ELSE 'active' END WHERE id = contract_record.id;
    INSERT INTO public.notifications (user_id, message, link_to) VALUES (contract_record.user_id, 'Votre profit mensuel de ' || profit_amount || ' ' || contract_record.currency || ' a été versé.', '/wallet');
  END LOOP;
END;
$$;

-- 10. approve_deposit (Admin action)
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
  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre dépôt de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved successfully');
END;
$$;

-- 11. approve_withdrawal (Admin action)
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
  INSERT INTO public.notifications (user_id, message, link_to) VALUES (target_transaction.user_id, 'Votre retrait de ' || target_transaction.amount || ' ' || target_transaction.currency || ' a été approuvé.', '/wallet');
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved successfully');
END;
$$;

-- 12. reject_withdrawal (Admin action)
CREATE OR REPLACE FUNCTION public.reject_withdrawal(transaction_id_to_reject UUID, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  UPDATE public.transactions SET status = 'cancelled', description = 'Withdrawal rejected by admin. Reason: ' || reason WHERE id = transaction_id_to_reject AND status = 'pending' AND type = 'withdrawal';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Pending withdrawal not found'); END IF;
  INSERT INTO public.notifications (user_id, message, link_to) SELECT user_id, 'Votre retrait a été rejeté. Raison: ' || reason, '/wallet' FROM public.transactions WHERE id = transaction_id_to_reject;
  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
END;
$$;

-- 13. admin_credit_user (Admin action)
CREATE OR REPLACE FUNCTION public.admin_credit_user(target_user_id UUID, credit_amount NUMERIC(20,8), reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_user_id UUID := auth.uid();
  user_wallet RECORD;
BEGIN
  IF NOT public.has_role(admin_user_id, 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  IF credit_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Credit amount must be positive'); END IF;
  UPDATE public.wallets SET total_balance = total_balance + credit_amount WHERE user_id = target_user_id RETURNING * INTO user_wallet;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Target user wallet not found'); END IF;
  INSERT INTO public.transactions (user_id, type, amount, currency, status, description) VALUES (target_user_id, 'deposit', credit_amount, user_wallet.currency, 'completed', 'Admin credit: ' || reason);
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, details) VALUES (admin_user_id, 'manual_credit', target_user_id, jsonb_build_object('amount', credit_amount, 'reason', reason));
  RETURN jsonb_build_object('success', true, 'message', 'User credited successfully');
END;
$$;

-- 14. get_admin_stats (Admin view)
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total_investors BIGINT;
  funds_under_management NUMERIC;
  total_profit NUMERIC;
  pending_withdrawals NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Not an admin'); END IF;
  SELECT count(*) INTO total_investors FROM public.profiles WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'investor');
  SELECT COALESCE(sum(invested_balance), 0) INTO funds_under_management FROM public.wallets;
  SELECT COALESCE(sum(total_profit_paid), 0) INTO total_profit FROM public.contracts;
  SELECT COALESCE(sum(amount), 0) INTO pending_withdrawals FROM public.transactions WHERE type = 'withdrawal' AND status = 'pending';
  RETURN jsonb_build_object('success', true, 'total_investors', total_investors, 'funds_under_management', funds_under_management, 'total_profit', total_profit, 'pending_withdrawals', pending_withdrawals);
END;
$$;

-- 15. get_aggregate_profits_by_month (Admin view)
CREATE OR REPLACE FUNCTION public.get_aggregate_profits_by_month()
RETURNS TABLE(month_year TEXT, total_profit NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Permission denied: Not an admin'; END IF;
  RETURN QUERY SELECT TO_CHAR(p.created_at, 'Mon YYYY') AS month_year, SUM(p.amount) AS total_profit FROM public.profits p GROUP BY month_year ORDER BY MIN(p.created_at);
END;
$$;
