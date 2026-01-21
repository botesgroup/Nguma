-- Migration: Update Transaction KPIs to Include Transfers
-- Date: 2026-01-20
-- Description: Updates get_transaction_kpis to include transfer amounts in addition to deposits and withdrawals.

CREATE OR REPLACE FUNCTION public.get_transaction_kpis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_start TIMESTAMPTZ := date_trunc('day', now());
    v_week_start TIMESTAMPTZ := date_trunc('week', now());
    v_month_start TIMESTAMPTZ := date_trunc('month', now());
    v_result JSONB;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT jsonb_build_object(
        'today', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0)
        ),
        'week', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0)
        ),
        'month', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0)
        ),
        'period', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'deposit' AND LOWER(status) = 'completed'), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'withdrawal' AND LOWER(status) = 'completed'), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'transfer' AND LOWER(status) = 'completed'), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'assurance' AND LOWER(status) = 'completed'), 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_kpis() TO authenticated;
