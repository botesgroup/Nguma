
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Setting = Database['public']['Tables']['settings']['Row'];

/**
 * Fetches a single setting by its key.
 * Assumes the setting is publicly readable via RLS.
 * @param key The key of the setting to fetch.
 * @returns {Promise<Setting | null>} A promise that resolves to the setting object or null if not found.
 */
export const getSettingByKey = async (key: string): Promise<Setting | null> => {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("key", key)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = "single row not found"
    console.error(`Error fetching setting "${key}":`, error);
    throw new Error(`Could not fetch setting for "${key}".`);
  }

  return data;
};


/**
 * Fetches all application settings.
 * Requires admin privileges (enforced by RLS).
 * @returns {Promise<Setting[]>} A promise that resolves to an array of settings.
 */
export const getSettings = async (): Promise<Setting[]> => {
  const { data, error } = await supabase.from("settings").select("*");

  if (error) {
    console.error("Error fetching settings:", error);
    throw new Error("Could not fetch settings.");
  }

  return data || [];
};

/**
 * Updates a specific application setting.
 * Requires admin privileges (enforced by RLS).
 * @param key The key of the setting to update.
 * @param value The new value for the setting.
 * @returns {Promise<any>} The result of the update operation.
 */
export const updateSetting = async ({ key, value }: { key: string; value: string }) => {
  const { data, error } = await supabase
    .from("settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    console.error("Error updating setting:", error);
    throw new Error("Could not update setting.");
  }

  return data;
};

/**
 * Updates the 'withdrawal_otp_enabled' setting.
 * @param enabled Whether OTP verification should be enabled (true) or disabled (false).
 * @returns {Promise<any>} The result of the update operation.
 */
export const updateWithdrawalOtpSetting = async (enabled: boolean) => {
  return updateSetting({ key: 'withdrawal_otp_enabled', value: enabled.toString() });
};

/**
 * Uploads a generic contract PDF to Supabase Storage and updates the setting.
 * @param file The PDF file to upload.
 * @returns {Promise<string>} The public URL of the uploaded PDF.
 */
export const uploadGenericContractPdf = async (file: File): Promise<string> => {
  const filePath = `template/generic_contract.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('contracts') // Using the existing 'contracts' bucket
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) {
    console.error("Error uploading generic contract PDF:", uploadError);
    throw new Error("Could not upload generic contract PDF.");
  }

  const { data: publicUrlData } = supabase.storage
    .from('contracts')
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // Update the settings table with the new URL
  const { error: updateError } = await supabase
    .from('settings')
    .upsert({ key: 'generic_contract_pdf_url', value: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (updateError) {
    console.error("Error updating generic contract PDF URL in settings:", updateError);
    throw new Error("Could not update generic contract PDF URL in settings.");
  }

  return publicUrl;
};
