
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Contract = Database['public']['Tables']['contracts']['Row'];

export interface MonthlyProfit {
  month_year: string;
  total_profit: number;
}

export interface UserGrowth {
  month_year: string;
  new_users_count: number;
}

// --- Deposit Management ---
export const getPendingDeposits = async () => {
  const { data, error } = await supabase.rpc('get_pending_deposits_with_profiles');

  if (error) {
    console.error("Error fetching pending deposits:", error);
    throw new Error("Could not fetch pending deposits.");
  }
  return data || [];
};

export const getTransactionMetadata = async (transactionId: string) => {
  const { data, error } = await supabase
    .from('transaction_metadata')
    .select('*')
    .eq('transaction_id', transactionId);

  if (error) {
    console.error("Error fetching transaction metadata:", error);
    throw new Error("Could not fetch transaction metadata.");
  }
  return data || [];
};

export const approveDeposit = async (transactionId: string) => {
  const { data, error } = await supabase.rpc('approve_deposit', { transaction_id_to_approve: transactionId });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const rejectDeposit = async (transactionId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_deposit', { transaction_id_to_reject: transactionId, reason: reason });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const approveDepositsInBulk = async (transactionIds: string[]) => {
  const { data, error } = await supabase.rpc('approve_deposits_in_bulk', { transaction_ids: transactionIds });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string; approved_count: number };

  if (result && !result.success) throw new Error(result.error || "An unknown error occurred during bulk approval.");
  return result;
};

export const rejectDepositsInBulk = async (transactionIds: string[], reason: string) => {
  const { data, error } = await supabase.rpc('reject_deposits_in_bulk', { transaction_ids: transactionIds, reason: reason });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string; rejected_count: number };

  if (result && !result.success) throw new Error(result.error || "An unknown error occurred during bulk rejection.");
  return result;
};

export const adminAdjustDepositAmount = async ({ transactionId, newAmount }: { transactionId: string; newAmount: number }) => {
  const { data, error } = await supabase.rpc('admin_adjust_deposit_amount', { transaction_id_to_adjust: transactionId, new_amount: newAmount });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred while adjusting amount.");
  return result;
};

// --- User Management ---
export const getAllUsers = async () => {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Could not fetch users.");
  return data || [];
};

export const getUserDetails = async (userId: string) => {
  const [profile, wallet, contracts, transactions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('wallets').select('*').eq('user_id', userId).single(),
    supabase.from('contracts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
  ]);
  if (profile.error || wallet.error || contracts.error || transactions.error) {
    throw new Error("Could not fetch complete user details.");
  }
  return { profile: profile.data, wallet: wallet.data, contracts: contracts.data, transactions: transactions.data };
};

export const getUserContracts = async (userId: string): Promise<Contract[]> => {
  const { data, error } = await supabase.rpc('get_contracts_for_user', { p_user_id: userId });

  if (error) {
    console.error("Error fetching contracts for user:", error);
    throw new Error("Could not fetch user contracts.");
  }
  return (data as unknown as Contract[]) || [];
};

export interface InvestorFilters {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  minInvested?: number;
  maxInvested?: number;
  country?: string; // Gardé pour la compatibilité de type, mais non utilisé dans l'appel
  city?: string;    // Gardé pour la compatibilité de type, mais non utilisé dans l'appel
}

export const getInvestorsList = async (filters: InvestorFilters = {}) => {
  const { searchQuery, page = 1, pageSize = 10, dateFrom, dateTo, minInvested, maxInvested, country, city, status } = filters;

  const { data, error } = await supabase.rpc('get_investor_list_details', {
    p_search_query: searchQuery || null,
    p_page_num: page,
    p_page_size: pageSize,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_min_invested: minInvested || null,
    p_max_invested: maxInvested || null,
    param_country: country || null,
    param_city: city || null,
    p_status_filter: status || null
  });

  if (error) {
    console.error("Error fetching investors list:", error);
    throw new Error("Could not fetch investors list.");
  }

  // The RPC returns a single JSON object with 'data' and 'count' keys.
  return data as any;
};

export const exportInvestorsList = async (filters: InvestorFilters = {}) => {
  const { searchQuery, dateFrom, dateTo, minInvested, maxInvested, country, city, status } = filters;

  const { data, error } = await supabase.rpc('export_investor_list', {
    p_search_query: searchQuery || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_min_invested: minInvested || null,
    p_max_invested: maxInvested || null,
    param_country: country || null,
    param_city: city || null,
    p_status_filter: status === 'all' ? null : status
  });

  if (error) {
    console.error("Error exporting investors list:", error);
    throw new Error("Could not export investors list.");
  }
  return data as any[];
};

// --- Admin Actions ---
export const creditUser = async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
  const { data, error } = await supabase.rpc('admin_credit_user', { target_user_id: userId, credit_amount: amount, reason: reason });
  if (error) throw new Error("Could not credit user.");

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const deactivateUser = async (userId: string) => {
  const { data, error } = await supabase.rpc('admin_deactivate_user', { user_id_to_deactivate: userId });
  if (error) throw new Error("Could not deactivate user.");

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const activateUser = async (userId: string) => {
  const { data, error } = await supabase.rpc('admin_activate_user', { user_id_to_activate: userId });
  if (error) throw new Error("Could not activate user.");

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const updateUserProfile = async ({ userId, firstName, lastName, postNom, phone }: { userId: string; firstName: string; lastName: string; postNom: string; phone: string; }) => {
  const { data, error } = await supabase.rpc('admin_update_user_profile', {
    p_user_id: userId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_post_nom: postNom,
    p_phone: phone,
  });
  if (error) throw new Error("Could not update user profile.");

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const sendAdminNotification = async ({ userId, message, priority, type = 'admin' }: { userId: string; message: string; priority: string; type?: string }) => {
  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_user_id: userId,
    p_message: message,
    p_priority: priority,
    p_type: type
  });

  if (error) throw new Error("Could not send notification.");

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

// --- Stats ---
export const getAdminDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error("Could not fetch admin dashboard stats.");

  // The RPC returns a direct JSON object with stats, not a wrapper
  return data as {
    total_investors: number;
    active_investors: number;
    funds_under_management: number;
    total_profit: number;
    pending_deposits: number;
    pending_withdrawals: number;
  };
};

export const getAggregateProfitsByMonth = async () => {
  const { data, error } = await supabase.rpc('get_aggregate_profits_by_month');
  if (error) throw new Error("Could not fetch aggregate profits.");
  return (data as unknown as MonthlyProfit[]) || [];
};

export const getCashFlowSummary = async () => {
  const { data, error } = await supabase.rpc('get_cash_flow_summary');
  if (error) {
    console.error("Error fetching cash flow summary:", error);
    throw new Error("Could not fetch cash flow summary.");
  }
  return data || [];
};

export const getUserGrowthSummary = async () => {
  const { data, error } = await supabase.rpc('get_user_growth_summary');
  if (error) {
    console.error("Error fetching user growth summary:", error);
    throw new Error("Could not fetch user growth summary.");
  }
  return (data as unknown as UserGrowth[]) || [];
};

export const getContractDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_contract_dashboard_stats');
  if (error) throw new Error("Could not fetch contract dashboard stats.");
  return data?.[0] || null;
};

export const getDepositSummary = async (dateFrom: string, dateTo: string) => {
  const { data, error } = await supabase.rpc('get_deposit_summary', {
    start_date: dateFrom,
    end_date: dateTo,
  });
  if (error) throw new Error("Could not fetch deposit summary.");
  return data?.[0] || null;
};

export const getWithdrawalSummary = async (dateFrom: string, dateTo: string) => {
  const { data, error } = await supabase.rpc('get_withdrawal_summary', {
    start_date: dateFrom,
    end_date: dateTo,
  });
  if (error) throw new Error("Could not fetch withdrawal summary.");
  return data?.[0] || null;
};

// --- Withdrawal Management ---
export const getPendingWithdrawals = async () => {
  const { data, error } = await supabase.rpc('get_pending_withdrawals_with_profiles');

  if (error) {
    console.error("Error fetching pending withdrawals:", error);
    throw new Error("Could not fetch pending withdrawals.");
  }
  return data || [];
};

export const approveWithdrawal = async (transactionId: string, proofUrl: string) => {
  const { data, error } = await supabase.rpc('approve_withdrawal', {
    transaction_id_to_approve: transactionId,
    p_proof_url: proofUrl
  });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error);
  return result;
};

export const rejectWithdrawal = async (transactionId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_withdrawal', { transaction_id_to_reject: transactionId, reason: reason });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error);
  return result;
};

// --- Contract Management ---
export const adminGetAllContracts = async (
  searchQuery: string = '',
  statusFilter: string = 'all',
  page: number = 1,
  pageSize: number = 10,
  dateFrom?: string,
  dateTo?: string
) => {
  const { data, error } = await supabase.rpc('admin_list_contracts', {
    p_search_query: searchQuery || '',
    p_status_filter: statusFilter || 'all',
    p_page_num: Number(page) || 1,
    p_page_size: Number(pageSize) || 10,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });

  if (error) {
    console.error("Error fetching contracts:", error);
    throw new Error("Could not fetch contracts list.");
  }

  // The RPC returns a single JSON object with 'data' and 'count' keys.
  return data;
};

// --- Refund Management ---
export const getPendingRefunds = async () => {
  const { data, error } = await supabase.rpc('get_pending_refunds');

  if (error) {
    console.error("Error fetching pending refunds:", error);
    throw new Error("Could not fetch pending refunds.");
  }
  return data || [];
};

export const approveRefund = async (contractId: string) => {
  const { data, error } = await supabase.rpc('approve_refund', { _contract_id: contractId });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const rejectRefund = async (contractId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_refund', { _contract_id: contractId, reason: reason });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

export const adminUpdateContract = async (contractId: string, updates: Record<string, any>) => {
  const { data, error } = await supabase.rpc('admin_update_contract', { _contract_id: contractId, _updates: updates });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (result && !result.success) throw new Error(result.error || "An unknown error occurred.");
  return result;
};

// --- Transaction History ---
export const getAdminTransactionHistory = async (
  searchQuery: string = '',
  typeFilter: string = 'all',
  statusFilter: string = 'all',
  page: number = 1,
  pageSize: number = 10,
  dateFrom?: string,
  dateTo?: string
) => {
  const { data, error } = await supabase.rpc('get_admin_transaction_history', {
    p_search_query: searchQuery || null,
    p_type_filter: typeFilter,
    p_status_filter: statusFilter,
    p_page_num: page,
    p_page_size: pageSize,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });

  if (error) throw new Error(error.message);
  return data as { data: any[], count: number };
};
