// supabase/functions/daily-payment-forecast/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('[daily-payment-forecast] Starting daily forecast process...');

        // 1. Authorization check for CRON
        const authorization = req.headers.get('Authorization');
        const CRON_SECRET = Deno.env.get('CRON_SECRET');

        if (authorization !== `Bearer ${CRON_SECRET}`) {
            console.error('[daily-payment-forecast] Unauthorized attempt.');
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }

        // 2. Call the RPC to get the daily summary
        const { data: summary, error: rpcError } = await supabaseAdmin.rpc('get_daily_profit_forecast_summary');

        if (rpcError) {
            throw new Error(`Failed to fetch forecast summary: ${rpcError.message}`);
        }

        console.log(`[daily-payment-forecast] Forecast found: ${summary.totalAmount} for ${summary.investorCount} investors.`);

        // 3. Enqueue the admin notification if there's something to pay
        if (summary.totalAmount > 0) {
            const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email_notification', {
                p_template_id: 'daily_payment_forecast_admin',
                p_params: {
                    totalAmount: summary.totalAmount,
                    investorCount: summary.investorCount,
                    date: summary.date
                }
            });

            if (enqueueError) {
                throw new Error(`Failed to enqueue admin notification: ${enqueueError.message}`);
            }

            console.log('[daily-payment-forecast] Admin notification successfully enqueued.');
        } else {
            console.log('[daily-payment-forecast] No payments scheduled for today. Skipping notification.');
        }

        return new Response(JSON.stringify({
            success: true,
            message: summary.totalAmount > 0 ? 'Forecast sent to admins' : 'No payments today',
            data: summary
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('[daily-payment-forecast] Unhandled error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
