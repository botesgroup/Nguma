// supabase/functions/check-deposit-cycle-change/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';

// Initialiser Supabase client
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // 24 heures
};

// Types pour les paramètres de notification
interface NotificationParams {
  to: string | string[];
  name: string;
  reason?: string;
  amount?: number;
  otp_code?: string;
  email?: string;
  method?: string;
  proof_url?: string;
  date?: string;
  support_phone?: string;
}

// Types pour les modèles de notification
type NotificationTemplate = 
  | 'deposit_cycle_opened'
  | 'deposit_cycle_closed'
  | 'deposit_cycle_ending_soon'
  | 'deposit_cycle_starting_soon'
  | 'deposit_approved'
  | 'deposit_rejected'
  | 'deposit_pending'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_pending'
  | 'monthly_profit'
  | 'new_investment'
  | 'withdrawal_otp'
  | 'new_deposit_request'
  | 'new_withdrawal_request'
  | 'withdrawal_approved_with_proof'
  | 'dormant_funds_reminder'
  | 'test_mail_tester';

// Fonction pour envoyer des notifications via Resend
const sendResendNotification = async (
  templateId: NotificationTemplate,
  params: NotificationParams
): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    // Appeler la fonction Supabase Edge qui utilise Resend
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-resend-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        ...params
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Unknown error' };
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Error in sendResendNotification:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Fonction pour envoyer une notification de début de cycle
const sendDepositCycleStartNotification = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Récupérer tous les utilisateurs actifs
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .is('deleted_at', null);

    if (userError) {
      console.error('Error fetching users for deposit cycle start notification:', userError);
      return { success: false, error: userError.message };
    }

    if (!users || users.length === 0) {
      console.log('No users found for deposit cycle start notification');
      return { success: true };
    }

    // Pour chaque utilisateur, envoyer une notification
    const results = [];
    for (const user of users) {
      try {
        const result = await sendResendNotification('deposit_cycle_opened', {
          to: user.email,
          name: user.full_name || 'Cher utilisateur',
          reason: 'La période de dépôt est maintenant ouverte'
        });
        
        results.push({
          email: user.email,
          success: result.success,
          error: result.error
        });
        
        // Petit délai pour éviter de surcharger la fonction Resend
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (notificationError) {
        console.error(`Error sending deposit cycle start notification to ${user.email}:`, notificationError);
        results.push({
          email: user.email,
          success: false,
          error: (notificationError as Error).message
        });
      }
    }

    // Compter les succès et échecs
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    
    console.log(`Deposit cycle start notifications: ${successes} succeeded, ${failures} failed`);
    
    return { success: true };
  } catch (error) {
    console.error('Error in sendDepositCycleStartNotification:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Fonction pour envoyer une notification de fin de cycle
const sendDepositCycleEndNotification = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Récupérer tous les utilisateurs actifs
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .is('deleted_at', null);

    if (userError) {
      console.error('Error fetching users for deposit cycle end notification:', userError);
      return { success: false, error: userError.message };
    }

    if (!users || users.length === 0) {
      console.log('No users found for deposit cycle end notification');
      return { success: true };
    }

    // Pour chaque utilisateur, envoyer une notification
    const results = [];
    for (const user of users) {
      try {
        const result = await sendResendNotification('deposit_cycle_closed', {
          to: user.email,
          name: user.full_name || 'Cher utilisateur',
          reason: 'La période de dépôt est maintenant terminée'
        });
        
        results.push({
          email: user.email,
          success: result.success,
          error: result.error
        });
        
        // Petit délai pour éviter de surcharger la fonction Resend
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (notificationError) {
        console.error(`Error sending deposit cycle end notification to ${user.email}:`, notificationError);
        results.push({
          email: user.email,
          success: false,
          error: (notificationError as Error).message
        });
      }
    }

    // Compter les succès et échecs
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    
    console.log(`Deposit cycle end notifications: ${successes} succeeded, ${failures} failed`);
    
    return { success: true };
  } catch (error) {
    console.error('Error in sendDepositCycleEndNotification:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Fonction pour vérifier le cycle de dépôt et envoyer des notifications si nécessaire
const checkDepositCycleChange = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Récupérer les paramètres système
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['deposit_enabled', 'deposit_period_start', 'deposit_period_end']);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return { success: false, message: `Error fetching settings: ${settingsError.message}` };
    }

    const settingsMap: Record<string, string> = {};
    settings?.forEach(setting => {
      if (setting) {
        settingsMap[setting.key] = setting.value;
      }
    });

    const isEnabled = settingsMap['deposit_enabled'] === 'true';
    
    if (!isEnabled) {
      return { success: true, message: 'Deposit cycle is disabled' };
    }

    const depositPeriodStart = settingsMap['deposit_period_start'];
    const depositPeriodEnd = settingsMap['deposit_period_end'];

    if (!depositPeriodStart || !depositPeriodEnd) {
      return { success: true, message: 'Deposit period not configured' };
    }

    const now = new Date();
    const periodStart = new Date(depositPeriodStart.replace('Z', '.000Z'));
    const periodEnd = new Date(depositPeriodEnd.replace('Z', '.000Z'));

    // Vérifier si le cycle vient de commencer (dans la dernière minute)
    const justStarted = now >= periodStart && now <= new Date(periodStart.getTime() + 60000); // 1 minute de tolérance
    
    // Vérifier si le cycle vient de se terminer (dans la dernière minute)
    const justEnded = now >= periodEnd && now <= new Date(periodEnd.getTime() + 60000); // 1 minute de tolérance

    if (justStarted) {
      console.log('Deposit cycle has just started, sending notifications...');
      const result = await sendDepositCycleStartNotification();
      return {
        success: result.success,
        message: result.success 
          ? 'Deposit cycle start notifications sent' 
          : `Error sending start notifications: ${result.error}`
      };
    } else if (justEnded) {
      console.log('Deposit cycle has just ended, sending notifications...');
      const result = await sendDepositCycleEndNotification();
      return {
        success: result.success,
        message: result.success 
          ? 'Deposit cycle end notifications sent' 
          : `Error sending end notifications: ${result.error}`
      };
    }

    return { success: true, message: 'No deposit cycle changes detected' };
  } catch (error) {
    console.error('Error in checkDepositCycleChange:', error);
    return { success: false, message: (error as Error).message };
  }
};

// Serveur HTTP
serve(async (req) => {
  // Gestion CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérifier que la requête est une requête POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Exécuter la vérification du cycle de dépôt
    const result = await checkDepositCycleChange();

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in check-deposit-cycle-change function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});