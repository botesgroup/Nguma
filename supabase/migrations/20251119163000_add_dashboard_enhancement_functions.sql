-- Dashboard Enhancement: Portfolio Stats & ROI Functions
-- Sprint 1: KPIs Essentiels

-- Function 1: Get comprehensive portfolio statistics
CREATE OR REPLACE FUNCTION public.get_portfolio_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_invested NUMERIC(20,8);
    v_total_profits NUMERIC(20,8);
    v_active_contracts INT;
    v_completed_contracts INT;
    v_roi NUMERIC(10,2);
    v_annual_return NUMERIC(10,2);
    v_monthly_avg NUMERIC(20,8);
    v_profit_balance NUMERIC(20,8);
    v_result JSON;
BEGIN
    -- Get wallet profit balance
    SELECT profit_balance INTO v_profit_balance
    FROM public.wallets
    WHERE user_id = p_user_id;

    -- Calculate total invested (active contracts)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_invested
    FROM public.contracts
    WHERE user_id = p_user_id AND status = 'active';

    -- Calculate total profits received
    SELECT COALESCE(SUM(amount), 0) INTO v_total_profits
    FROM public.profits
    WHERE contract_id IN (
        SELECT id FROM public.contracts WHERE user_id = p_user_id
    );

    -- Count active contracts
    SELECT COUNT(*) INTO v_active_contracts
    FROM public.contracts
    WHERE user_id = p_user_id AND status = 'active';

    -- Count completed contracts
    SELECT COUNT(*) INTO v_completed_contracts
    FROM public.contracts
    WHERE user_id = p_user_id AND status = 'completed';

    -- Calculate ROI (Return on Investment)
    IF v_total_invested > 0 THEN
        v_roi := (v_total_profits / v_total_invested) * 100;
    ELSE
        v_roi := 0;
    END IF;

    -- Calculate annualized return
    -- Assuming average contract duration of 12 months for simplification
    v_annual_return := v_roi; -- Simplified, could be enhanced with actual duration

    -- Calculate monthly average profit
    IF v_active_contracts > 0 THEN
        SELECT COALESCE(AVG(amount), 0) INTO v_monthly_avg
        FROM public.profits
        WHERE contract_id IN (
            SELECT id FROM public.contracts 
            WHERE user_id = p_user_id AND status = 'active'
        )
        AND created_at >= NOW() - INTERVAL '3 months';
    ELSE
        v_monthly_avg := 0;
    END IF;

    -- Build result JSON
    v_result := json_build_object(
        'total_invested', v_total_invested,
        'total_profits', v_total_profits,
        'profit_balance', COALESCE(v_profit_balance, 0),
        'active_contracts', v_active_contracts,
        'completed_contracts', v_completed_contracts,
        'roi_percentage', ROUND(v_roi, 2),
        'annual_return_percentage', ROUND(v_annual_return, 2),
        'monthly_avg_profit', v_monthly_avg,
        'total_contracts', v_active_contracts + v_completed_contracts
    );

    RETURN v_result;
END;
$$;

-- Function 2: Calculate ROI for a specific contract
CREATE OR REPLACE FUNCTION public.calculate_contract_roi(p_contract_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contract_amount NUMERIC(20,8);
    v_profits_paid NUMERIC(20,8);
    v_months_paid INT;
    v_duration INT;
    v_roi NUMERIC(10,2);
    v_projected_total NUMERIC(20,8);
    v_result JSON;
BEGIN
    -- Get contract details
    SELECT amount, total_profit_paid, months_paid, duration_months
    INTO v_contract_amount, v_profits_paid, v_months_paid, v_duration
    FROM public.contracts
    WHERE id = p_contract_id;

    IF v_contract_amount IS NULL THEN
        RETURN json_build_object('error', 'Contract not found');
    END IF;

    -- Calculate current ROI
    v_roi := (v_profits_paid / v_contract_amount) * 100;

    -- Calculate projected total at maturity (assuming 15% monthly)
    v_projected_total := v_contract_amount + (v_contract_amount * 0.15 * v_duration);

    -- Build result
    v_result := json_build_object(
        'contract_amount', v_contract_amount,
        'profits_paid', v_profits_paid,
        'months_paid', v_months_paid,
        'duration_months', v_duration,
        'current_roi', ROUND(v_roi, 2),
        'projected_total', v_projected_total,
        'projected_roi', ROUND(((v_projected_total - v_contract_amount) / v_contract_amount) * 100, 2),
        'progress_percentage', ROUND((v_months_paid::NUMERIC / v_duration::NUMERIC) * 100, 2)
    );

    RETURN v_result;
END;
$$;

-- Function 3: Get upcoming profit payments
CREATE OR REPLACE FUNCTION public.get_upcoming_payments(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
    contract_id UUID,
    contract_number TEXT,
    next_payment_date DATE,
    estimated_amount NUMERIC(20,8),
    months_remaining INT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as contract_id,
        SUBSTRING(c.id::TEXT, 1, 8) as contract_number,
        (c.start_date + (c.months_paid + 1 || ' months')::INTERVAL)::DATE as next_payment_date,
        c.amount * 0.15 as estimated_amount, -- Assuming 15% monthly rate
        c.duration_months - c.months_paid as months_remaining,
        c.status
    FROM public.contracts c
    WHERE c.user_id = p_user_id
    AND c.status = 'active'
    AND c.months_paid < c.duration_months
    ORDER BY next_payment_date ASC
    LIMIT p_limit;
END;
$$;

-- Function 4: Get profit history for a contract
CREATE OR REPLACE FUNCTION public.get_contract_profit_history(p_contract_id UUID)
RETURNS TABLE (
    payment_date TIMESTAMPTZ,
    amount NUMERIC(20,8),
    month_number INT,
    cumulative_total NUMERIC(20,8)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.created_at as payment_date,
        p.amount,
        p.month_number,
        SUM(p.amount) OVER (ORDER BY p.month_number) as cumulative_total
    FROM public.profits p
    WHERE p.contract_id = p_contract_id
    ORDER BY p.month_number ASC;
END;
$$;

-- Function 5: Get performance trends (month over month)
CREATE OR REPLACE FUNCTION public.get_performance_trends(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_month_profits NUMERIC(20,8);
    v_last_month_profits NUMERIC(20,8);
    v_trend_percentage NUMERIC(10,2);
    v_result JSON;
BEGIN
    -- Current month profits
    SELECT COALESCE(SUM(amount), 0) INTO v_current_month_profits
    FROM public.profits
    WHERE contract_id IN (
        SELECT id FROM public.contracts WHERE user_id = p_user_id
    )
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());

    -- Last month profits
    SELECT COALESCE(SUM(amount), 0) INTO v_last_month_profits
    FROM public.profits
    WHERE contract_id IN (
        SELECT id FROM public.contracts WHERE user_id = p_user_id
    )
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month');

    -- Calculate trend
    IF v_last_month_profits > 0 THEN
        v_trend_percentage := ((v_current_month_profits - v_last_month_profits) / v_last_month_profits) * 100;
    ELSE
        v_trend_percentage := 0;
    END IF;

    v_result := json_build_object(
        'current_month', v_current_month_profits,
        'last_month', v_last_month_profits,
        'trend_percentage', ROUND(v_trend_percentage, 2),
        'is_positive', v_trend_percentage > 0
    );

    RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_portfolio_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_contract_roi(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_payments(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_profit_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_trends(UUID) TO authenticated;
