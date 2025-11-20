import { supabase } from "@/integrations/supabase/client";

export interface PortfolioStats {
    total_invested: number;
    total_profits: number;
    profit_balance: number;
    active_contracts: number;
    completed_contracts: number;
    roi_percentage: number;
    annual_return_percentage: number;
    monthly_avg_profit: number;
    total_contracts: number;
}

export interface ContractROI {
    contract_amount: number;
    profits_paid: number;
    months_paid: number;
    duration_months: number;
    current_roi: number;
    projected_total: number;
    projected_roi: number;
    progress_percentage: number;
}

export interface UpcomingPayment {
    contract_id: string;
    contract_number: string;
    next_payment_date: string;
    estimated_amount: number;
    months_remaining: number;
    status: string;
}

export interface ProfitHistoryItem {
    payment_date: string;
    amount: number;
    month_number: number;
    cumulative_total: number;
}

export interface PerformanceTrends {
    current_month: number;
    last_month: number;
    trend_percentage: number;
    is_positive: boolean;
}

/**
 * Get comprehensive portfolio statistics for the current user
 */
export const getPortfolioStats = async (): Promise<PortfolioStats | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.rpc('get_portfolio_stats', {
        p_user_id: user.id
    });

    if (error) {
        console.error("Error fetching portfolio stats:", error);
        throw new Error("Could not fetch portfolio stats.");
    }

    return data as PortfolioStats;
};

/**
 * Calculate ROI and performance metrics for a specific contract
 */
export const getContractROI = async (contractId: string): Promise<ContractROI | null> => {
    const { data, error } = await supabase.rpc('calculate_contract_roi', {
        p_contract_id: contractId
    });

    if (error) {
        console.error("Error calculating contract ROI:", error);
        throw new Error("Could not calculate contract ROI.");
    }

    return data as ContractROI;
};

/**
 * Get upcoming profit payments for the user
 */
export const getUpcomingPayments = async (limit: number = 5): Promise<UpcomingPayment[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.rpc('get_upcoming_payments', {
        p_user_id: user.id,
        p_limit: limit
    });

    if (error) {
        console.error("Error fetching upcoming payments:", error);
        throw new Error("Could not fetch upcoming payments.");
    }

    return data || [];
};

/**
 * Get profit payment history for a specific contract
 */
export const getContractProfitHistory = async (contractId: string): Promise<ProfitHistoryItem[]> => {
    const { data, error } = await supabase.rpc('get_contract_profit_history', {
        p_contract_id: contractId
    });

    if (error) {
        console.error("Error fetching contract profit history:", error);
        throw new Error("Could not fetch contract profit history.");
    }

    return data || [];
};

/**
 * Get performance trends (month over month comparison)
 */
export const getPerformanceTrends = async (): Promise<PerformanceTrends | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase.rpc('get_performance_trends', {
        p_user_id: user.id
    });

    if (error) {
        console.error("Error fetching performance trends:", error);
        throw new Error("Could not fetch performance trends.");
    }

    return data as PerformanceTrends;
};
