import { supabase } from "@/integrations/supabase/client";
import { EmailParams } from "../types/emailTypes";
import { validateEmailParams } from "../utils/emailValidation";

/**
 * Interface combining the template ID and the email parameters.
 */
export type SendEmailPayload = EmailParams & {
  template_id: string;
};

/**
 * Triggers the 'send-resend-email' Edge Function.
 *
 * @param payload The data required to populate the email template.
 * @returns The result from the Edge Function invocation.
 */
export const sendEmailNotification = async (payload: SendEmailPayload) => {
  // 1. Client-side Validation
  const validation = validateEmailParams(payload);
  if (!validation.valid) {
    console.error("Email parameter validation failed:", validation.errors);
    return { success: false, error: "Validation failed: " + validation.errors.join(", ") };
  }

  // 2. Invoke Edge Function
  const { data, error } = await supabase.functions.invoke('send-resend-email', {
    body: payload,
  });

  if (error) {
    console.error("Error invoking send-resend-email function:", error);
    // We don't throw here to avoid breaking the parent flow,
    // as email notification might be a non-critical side-effect.
    // The calling function should decide how to handle the error.
    return { success: false, error: error.message };
  }

  return { success: true, data };
};
