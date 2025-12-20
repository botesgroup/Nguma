// supabase/functions/cron-contract-reminders/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const REMINDER_DAYS_BEFORE_EXPIRATION = 7;

Deno.serve(async (req) => {
  try {
    // 1. Check for secret key to prevent unauthorized access
    const authorization = req.headers.get('Authorization');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');

    if (authorization !== `Bearer ${CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // 2. Calculate the target date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + REMINDER_DAYS_BEFORE_EXPIRATION);
    const targetDateString = targetDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'

    console.log(`[cron-contract-reminders] Ssearching for contracts ending on ${targetDateString}`);

    // 3. Fetch contracts expiring on the target date, along with user profiles
    const { data: contracts, error: fetchError } = await supabaseAdmin
      .from('contracts')
      .select(`
        id,
        initial_amount,
        end_date,
        profiles (
          email,
          first_name,
          last_name
        )
      `)
      .eq('status', 'active')
      .eq('end_date', targetDateString);

    if (fetchError) {
      throw new Error(`Failed to fetch contracts: ${fetchError.message}`);
    }

    if (!contracts || contracts.length === 0) {
      const message = "[cron-contract-reminders] No contracts expiring today. Exiting.";
      console.log(message);
      return new Response(JSON.stringify({ success: true, message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`[cron-contract-reminders] Found ${contracts.length} contracts to notify.`);

    // 4. Prepare and enqueue notifications (using queue for consistency)
    const insertPromises = [];
    for (const contract of contracts) {
      const profile = contract.profiles;

      if (profile && profile.email) {
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        const formattedEndDate = new Date(contract.end_date).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        });

        // Insert into notifications_queue instead of direct call
        const notificationParams = {
          to: profile.email,
          name: fullName || 'Cher investisseur',
          contractId: contract.id,
          amount: contract.initial_amount,
          endDate: formattedEndDate,
        };

        insertPromises.push(
          supabaseAdmin
            .from('notifications_queue')
            .insert({
              template_id: 'contract_expiring_soon',
              recipient_email: profile.email,
              notification_params: notificationParams,
              priority: 'medium',
              scheduled_for: new Date().toISOString()
            })
        );
      }
    }

    // 5. Wait for all insertions to complete
    const results = await Promise.allSettled(insertPromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[cron-contract-reminders] Error enqueuing notification for contract ${contracts[index].id}:`, result.reason);
      }
    });

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const message = `[cron-contract-reminders] Processed ${contracts.length} contracts. Enqueued ${successCount} notifications.`;
    console.log(message);

    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[cron-contract-reminders] Unhandled error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
