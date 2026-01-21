-- Migration: Update Transaction KPIs to Support Period Filters
-- Date: 2026-01-20
-- Description: Updates get_transaction_kpis to accept date_from and date_to parameters for custom period filtering.

-- Drop potentially conflicting signatures to resolve PGRST203 error
DROP FUNCTION IF EXISTS public.get_transaction_kpis(TEXT, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_transaction_kpis(DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_transaction_kpis(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_start TIMESTAMPTZ := date_trunc('day', now());
    v_week_start TIMESTAMPTZ := date_trunc('week', now());
    v_month_start TIMESTAMPTZ := date_trunc('month', now());
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Check if user is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Set period boundaries
    IF p_date_from IS NOT NULL THEN
        v_period_start := p_date_from::timestamp;
    ELSE
        v_period_start := '-infinity'::timestamp;
    END IF;

    IF p_date_to IS NOT NULL THEN
        v_period_end := (p_date_to + interval '1 day')::timestamp;
    ELSE
        v_period_end := 'infinity'::timestamp;
    END IF;

    SELECT jsonb_build_object(
        'today', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_today_start), 0)
        ),
        'week', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_week_start), 0)
        ),
        'month', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_month_start), 0)
        ),
        'period', jsonb_build_object(
            'deposits', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'deposit' AND LOWER(status) = 'completed' AND created_at >= v_period_start AND created_at <= v_period_end), 0),
            'withdrawals', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'withdrawal' AND LOWER(status) = 'completed' AND created_at >= v_period_start AND created_at <= v_period_end), 0),
            'transfers', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'transfer' AND LOWER(status) = 'completed' AND created_at >= v_period_start AND created_at <= v_period_end), 0),
            'assurances', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE LOWER(type) = 'assurance' AND LOWER(status) = 'completed' AND created_at >= v_period_start AND created_at <= v_period_end), 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_kpis(DATE, DATE) TO authenticated;
