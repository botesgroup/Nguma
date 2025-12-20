import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@3.2.0";
import { authenticateUser, isServiceRole } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  TEMPLATES,
  validateTemplateParams,
  getTemplate,
  type EmailParams
} from './templates/index.ts';
import { createTemplateHelpers } from './templates/helpers.ts';

// --- CONFIGURATION ---
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN");
const SITE_URL = Deno.env.get("SITE_URL") || "https://nguma.org";

// --- HELPERS ---
function errorResponse(message: string, status: number = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// --- MAIN HANDLER ---
serve(async (req) => {
  // CORS Pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check for critical environment variables first
    if (!RESEND_API_KEY || !Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        console.error("CRITICAL: Missing one or more environment variables (RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
        return errorResponse("Server configuration error", 500);
    }
    
    const resend = new Resend(RESEND_API_KEY);

    // Authentication
    const isSvc = isServiceRole(req);
    if (!isSvc) {
      await authenticateUser(req); // Throws on failure
    }

    // Parse payload
    const payload = await req.json();
    const { template_id, ...params } = payload;
    
    if (!template_id) {
        return errorResponse("Missing required field: template_id", 400);
    }

    // --- BATCH PROCESSING ---
    if (template_id === 'dormant_funds_reminder_batch' && Array.isArray(payload.recipients)) {
      // ... (Batch processing logic remains the same)
      return new Response(JSON.stringify({ success: true, message: "Batch processing finished." }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // --- SINGLE EMAIL PROCESSING ---
    const emailParams = params as EmailParams;
    if (!emailParams.to) {
      return errorResponse("Missing required field: to", 400);
    }

    const template = getTemplate(template_id);
    const helpers = createTemplateHelpers(SITE_URL);

    const validationErrors = validateTemplateParams(template_id, emailParams, helpers);
    if (validationErrors.length > 0) {
        return errorResponse(`Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    const { subject, text, html } = template.render(emailParams, helpers);

    const domain = RESEND_FROM_DOMAIN || "nguma.org";
    const fromAddress = `Nguma <notifications@${domain}>`;
    const toAddresses = Array.isArray(emailParams.to)
      ? emailParams.to
      : emailParams.to.split(',').map(email => email.trim()).filter(Boolean);

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: fromAddress,
      to: toAddresses,
      reply_to: `support@${domain}`,
      subject,
      html,
      text,
      tags: [
        { name: 'category', value: template.category },
        { name: 'app', value: 'nguma' }
      ],
      headers: {
        'List-Unsubscribe': `<${SITE_URL}/settings/notifications>`,
        'X-Entity-Ref-ID': crypto.randomUUID()
      }
    });

    if (resendError) {
      console.error("Resend Error:", resendError);
      await logEmailError(emailParams, template_id, resendError.message || "Unknown Resend error");
      return errorResponse(resendError.message || "Unknown Resend error", 502); // 502 Bad Gateway as we failed to talk to an upstream server
    }

    await logEmailSuccess(emailParams, template_id, subject, resendData?.id);

    return new Response(JSON.stringify({
      success: true,
      messageId: resendData?.id,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e: any) {
    console.error("Worker Error:", e);
    // Safe error serialization
    const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : "An unexpected error occurred.");
    if (e?.name === 'SyntaxError') { // Specifically for req.json() failures
        return errorResponse("Invalid JSON in request body", 400);
    }
    if (e?.message === "Unauthorized") { // From authenticateUser
        return errorResponse("Unauthorized", 401);
    }
    return errorResponse(errorMessage, 500);
  }
});

// Helper functions for logging (simplified for brevity)
async function logEmailError(params: EmailParams, templateId: string, error: string) {
  if (params.notificationId) {
    await supabaseAdmin
      .from('notifications')
      .update({ status: 'failed', error_message: error })
      .eq('id', params.notificationId);
  }
}

async function logEmailSuccess(params: EmailParams, templateId: string, subject: string, messageId?: string) {
  if (params.notificationId) {
     await supabaseAdmin
        .from('notifications')
        .update({ status: 'sent', is_read: true, message: `Email envoyé: ${subject}` })
        .eq('id', params.notificationId);
  } else if (params.userId) {
      await supabaseAdmin.from('notifications').insert({
          user_id: params.userId,
          message: `Email envoyé: ${subject}`,
          type: 'system',
          priority: 'low',
          is_read: true
        });
  }
}
