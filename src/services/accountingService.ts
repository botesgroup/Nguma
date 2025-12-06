import { supabase } from "@/integrations/supabase/client";

export interface AccountStats {
    [key: string]: number;
}

export interface UpcomingProfit {
    user_id: string;
    contract_id: string;
    amount: number;
    expected_date: string;
    contract_name: string;
}

export interface PaymentBatch {
    id: string;
    batch_number: string;
    status: 'pending' | 'processing' | 'paid' | 'cancelled';
    total_amount: number;
    currency: string;
    period_start: string;
    period_end: string;
    created_at: string;
    processed_at?: string;
}

export interface PaymentBatchItem {
    id: string;
    batch_id: string;
    user_id: string;
    amount: number;
    status: 'pending' | 'paid' | 'failed';
    related_transaction_id?: string;
    user_email?: string; // Joined field
    user_name?: string; // Joined field
}

export interface AccountingEntry {
    id: string;
    transaction_date: string;
    description: string;
    debit_account_id: string;
    credit_account_id: string;
    amount: number;
    created_at: string;
    debit_account_name?: string;
    credit_account_name?: string;
}

export const getAccountingStats = async (): Promise<AccountStats> => {
    const { data, error } = await supabase.rpc('get_accounting_stats');
    if (error) throw error;
    return data as AccountStats;
};

export const getUpcomingProfits = async (startDate?: Date, endDate?: Date): Promise<UpcomingProfit[]> => {
    const { data, error } = await supabase.rpc('get_upcoming_profits', {
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
    });
    if (error) throw error;
    return data as UpcomingProfit[];
};

export const generateWithdrawalBatch = async (): Promise<string | null> => {
    const { data, error } = await supabase.rpc('generate_withdrawal_batch');
    if (error) throw error;
    return data as string | null;
};

export const processPaymentBatch = async (batchId: string, proofUrl?: string): Promise<void> => {
    const { error } = await supabase.rpc('process_payment_batch', {
        p_batch_id: batchId,
        p_proof_url: proofUrl,
    });
    if (error) throw error;
};

export const getPaymentBatches = async (): Promise<PaymentBatch[]> => {
    const { data, error } = await supabase
        .from('payment_batches')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data as PaymentBatch[];
};

export const getPaymentBatchItems = async (batchId: string): Promise<PaymentBatchItem[]> => {
    const { data, error } = await supabase
        .from('payment_batch_items')
        .select(`
      *,
      profiles:user_id (email, full_name)
    `)
        .eq('batch_id', batchId);

    if (error) throw error;

    // Transform to flatten profile data
    return data.map((item: any) => ({
        ...item,
        user_email: item.profiles?.email,
        user_name: item.profiles?.full_name,
    }));
};

export const getAccountingEntries = async (
    dateFrom?: string,
    dateTo?: string,
    searchQuery?: string
): Promise<AccountingEntry[]> => {
    let query = supabase
        .from('accounting_entries')
        .select(`
      *,
      debit_account:debit_account_id (name),
      credit_account:credit_account_id (name)
    `)
        .order('transaction_date', { ascending: false });

    if (dateFrom) {
        query = query.gte('transaction_date', dateFrom);
    }

    if (dateTo) {
        // Add one day to include the end date fully if it's just a date string
        const nextDay = new Date(dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('transaction_date', nextDay.toISOString());
    }

    if (searchQuery) {
        query = query.ilike('description', `%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map((item: any) => ({
        ...item,
        debit_account_name: item.debit_account?.name,
        credit_account_name: item.credit_account?.name,
    }));
};
