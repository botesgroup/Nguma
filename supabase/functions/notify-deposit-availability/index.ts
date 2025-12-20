// supabase/functions/notify-deposit-availability/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    console.log(`DEBUG: Function ${Deno.env.get('SB_FUNCTION_NAME') || 'notify-deposit-availability'} triggered at ${req.url}`);

    // This is an example of a POST request handler
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    console.log('DEBUG: notify-deposit-availability function triggered');

    // 1. Get all users who have opted-in to this specific notification
    console.log('DEBUG: Fetching subscribed users...');
    const { data: subscribedUsers, error: fetchError } = await supabaseAdmin
      .from('user_notification_preferences')
      .select(`
        user_id,
        email_enabled,
        notification_type
      `)
      .eq('notification_type', 'deposit_availability_reminder')
      .eq('email_enabled', true);

    if (fetchError) {
      console.error('DEBUG: Error fetching subscribed users:', fetchError);
      throw new Error(`Failed to fetch subscribers: ${fetchError.message}`);
    }

    console.log(`DEBUG: Found ${subscribedUsers?.length || 0} subscriptions. Fetching profile data...`);

    if (!subscribedUsers || subscribedUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No users to notify.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Fetch profiles separately to be safe with joins
    const userIds = subscribedUsers.map(s => s.user_id);
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('DEBUG: Error fetching profiles:', profilesError);
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`DEBUG: Found ${profiles?.length || 0} profiles for subscriptions`);

    // 3. Prepare notifications and email payloads
    const notificationsToInsert = [];
    const emailPromises = [];
    const notificationMessage = "Les dépôts sont maintenant ouverts ! Vous pouvez effectuer un nouveau dépôt depuis votre tableau de bord.";
    const notificationLink = "/dashboard";
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('DEBUG: Missing environment variables', { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
      throw new Error('Configuration error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const resendUrl = `${supabaseUrl}/functions/v1/send-resend-email`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey
    };

    console.log(`DEBUG: Target resend URL: ${resendUrl}`);
    console.log(`DEBUG: Outgoing headers configured: Content-Type, Authorization, apikey`);

    for (const sub of subscribedUsers) {
      const profile = profiles?.find(p => p.id === sub.user_id);

      if (profile && profile.email) {
        // Prepare in-app notification
        notificationsToInsert.push({
          user_id: sub.user_id,
          message: notificationMessage,
          link_to: notificationLink,
          type: 'system',
          priority: 'medium',
        });

        // Construct full name from first_name and last_name
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

        // Prepare email notification
        const emailPayload = {
          template_id: 'deposit_availability_reminder',
          to: profile.email,
          name: fullName || 'Cher investisseur',
          userId: sub.user_id,
        };

        console.log(`DEBUG: Queueing email for ${profile.email}`);
        emailPromises.push(
          fetch(resendUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(emailPayload),
          }).then(async response => {
            if (!response.ok) {
              const errorBody = await response.json();
              console.error(`Failed to send email to ${profile.email}. Status: ${response.status}. Error: ${errorBody.error}`);
            }
            return response;
          })
        );
      }
    }

    // 3. Insert all in-app notifications in batch
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertError) {
        console.error('Error inserting in-app notifications:', insertError);
        // Do not throw, continue to send emails
      }
    }

    // 4. Send all emails in parallel
    await Promise.all(emailPromises);

    return new Response(JSON.stringify({ success: true, message: `Successfully notified ${subscribedUsers.length} users.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

