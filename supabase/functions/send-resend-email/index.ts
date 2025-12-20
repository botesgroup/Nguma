import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@3.2.0";
import { authenticateUser, isServiceRole } from '../_shared/auth.ts';
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

const resend = new Resend(RESEND_API_KEY);
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// --- MAIN HANDLER ---
serve(async (req) => {
  // CORS Pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    console.log(`DEBUG: Function ${Deno.env.get('SB_FUNCTION_NAME') || 'send-resend-email'} triggered at ${req.url}`);

    // Authentication
    const isSvc = isServiceRole(req);
    if (!isSvc) {
      try {
        await authenticateUser(req);
      } catch (e: any) {
        console.error('Authentication error:', e.message);
        console.log('DEBUG: Received headers:', Object.fromEntries(req.headers.entries()));
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Check environment
    if (!RESEND_API_KEY) {
      console.error("CRITICAL: RESEND_API_KEY is missing");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    // Parse payload
    const payload = await req.json();
    const { template_id, ...params } = payload;
    const emailParams = params as EmailParams;

    // --- BATCH PROCESSING (New) ---
    if (template_id === 'dormant_funds_reminder_batch' && Array.isArray(payload.recipients)) {
      const results = [];
      const recipients = payload.recipients as EmailParams[];

      console.log(`Processing batch of ${recipients.length} emails...`);

      for (const recipient of recipients) {
        try {
          const batchTemplateId = 'dormant_funds_reminder'; // Specific template for batch
          const template = getTemplate(batchTemplateId);
          const helpers = createTemplateHelpers(SITE_URL);

          const validationErrors = validateTemplateParams(batchTemplateId, recipient, helpers);
          if (validationErrors.length > 0) {
            results.push({ email: recipient.to, status: 'validation_error', errors: validationErrors });
            continue;
          }

          const { subject, html, text, previewText } = template.render(recipient, helpers);

          const domain = RESEND_FROM_DOMAIN || "nguma.org";
          const fromAddress = `Nguma <notifications@${domain}>`;
          const toAddresses = Array.isArray(recipient.to) ? recipient.to : [recipient.to];

          const { data, error } = await resend.emails.send({
            from: fromAddress,
            to: toAddresses,
            reply_to: `support@${domain}`,
            subject: subject,
            html: html,
            text: text,
            tags: [{ name: 'category', value: template.category }, { name: 'app', value: 'nguma' }]
          });

          if (error) {
            console.error(`Failed to email ${recipient.to}:`, error);
            results.push({ email: recipient.to, status: 'error', error });
            await logEmailError(recipient, batchTemplateId, error.message);
          } else {
            results.push({ email: recipient.to, status: 'sent', id: data?.id });
            await logEmailSuccess(recipient, batchTemplateId, data?.id);
          }

          // RATE LIMIT PROTECTION: Wait 600ms between emails (Limit is 2/sec, so 500ms min)
          await new Promise(resolve => setTimeout(resolve, 600));

        } catch (err: any) {
          console.error(`Error processing ${recipient.to}:`, err);
          results.push({ email: recipient.to, status: 'error', message: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }

    // --- SINGLE EMAIL PROCESSING (Existing) ---
    // Validation
    if (!emailParams.to || !template_id) {
      return new Response(JSON.stringify({ error: "Missing required fields (to, template_id)" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    // Get template
    const template = getTemplate(template_id);

    // Create helpers
    const helpers = createTemplateHelpers(SITE_URL);

    // Render template
    const { subject, text, html, previewText } = template.render(emailParams, helpers);

    // Send email
    const domain = RESEND_FROM_DOMAIN || "nguma.org";
    const fromAddress = `Nguma <notifications@${domain}>`;
    // Prepare email addresses - handle comma-separated strings from SQL string_agg
    const toAddresses = Array.isArray(emailParams.to)
      ? emailParams.to
      : emailParams.to.split(',').map(email => email.trim()).filter(email => email.length > 0);

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
      return new Response(JSON.stringify({ error: resendError.message || "Unknown Resend error" }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    await logEmailSuccess(emailParams, template_id, subject, text, resendData?.id);

    return new Response(JSON.stringify({
      success: true,
      messageId: resendData?.id,
      template: template_id,
      category: template.category
    }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("Worker Error:", e);
    return new Response(JSON.stringify({
      error: e.message || "Internal Server Error",
      stack: Deno.env.get("DENO_ENV") === "development" ? e.stack : undefined
    }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});

// Helper functions for logging
async function logEmailError(params: EmailParams, templateId: string, error: string) {
  if (params.notificationId) {
    await supabaseAdmin
      .from('notifications')
      .update({
        status: 'failed',
        sent_at: new Date().toISOString(),
        error_message: error
      })
      .eq('id', params.notificationId);
  }
}

async function logEmailSuccess(params: EmailParams, templateId: string, subject: string, body: string, messageId?: string) {
  try {
    if (params.userId) {
      // Basic insert into notifications (common columns)
      // We avoid columns that might not exist yet to prevent crashes
      const { error } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: params.userId,
          message: `Email envoyé: ${subject}`,
          type: 'system',
          priority: 'low',
          is_read: true // Already sent/read from email perspective
        });

      if (error) console.error('Error logging email success to notifications:', error);
    } else if (params.notificationId) {
      // Update existing notification if ID provided
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
          message: `Email envoyé: ${subject}`
        })
        .eq('id', params.notificationId);

      if (error) console.error('Error updating notification log:', error);
    }
  } catch (err) {
    console.error('Panic in logEmailSuccess:', err);
  }
}