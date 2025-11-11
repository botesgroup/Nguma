import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Contract = Database['public']['Tables']['contracts']['Row'];

/**
 * Fetches all contracts for the currently authenticated user.
 */
export const getContracts = async (): Promise<Contract[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated. Please log in.");

  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching contracts:", error.message);
    throw new Error("Could not fetch contracts data.");
  }
  return data || [];
};

/**
 * Creates a new investment contract for the user by calling a database RPC function.
 */
export const createContract = async (amount: number) => {
  const { data, error } = await supabase.rpc('create_new_contract', { 
    investment_amount: amount 
  });

  if (error) {
    console.error("Error creating contract:", error.message);
    throw new Error("Failed to create contract.");
  }
  if (data && !data.success) {
    throw new Error(data.error || "An unknown error occurred in the database function.");
  }
  return data;
};

/**
 * Requests an early refund for a specific contract.
 */
export const requestRefund = async (contractId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated.");

  const { data, error } = await supabase.rpc('request_refund', {
    _contract_id: contractId
  });

  if (error) {
    console.error("Error requesting refund:", error.message);
    throw new Error("Failed to request refund.");
  }
  if (data && !data.success) {
    throw new Error(data.error || "An unknown error occurred during the refund request process.");
  }
  return data;
};

/**
 * Creates a new investment contract using the user's profit balance.
 */
export const reinvestProfit = async (amount: number) => {
  const { data, error } = await supabase.rpc('reinvest_from_profit', { 
    reinvestment_amount: amount 
  });

  if (error) {
    console.error("Error reinvesting profit:", error.message);
    throw new Error("Failed to create reinvestment contract.");
  }
  if (data && !data.success) {
    throw new Error(data.error || "An unknown error occurred in the database function.");
  }
  return data;
};