import { supabase } from '@/integrations/supabase/client';
import { getProfile } from '@/services/profileService'; // New import

// Types pour les templates de notification
export type NotificationTemplate = 
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
  | 'test_mail_tester'
  | 'password_changed'
  | 'email_changed_old_address'
  | 'email_changed_new_address'
  | '2fa_setup_confirmed'
  | '2fa_disabled_confirmed'
  | 'notification_preferences_updated'
  | 'new_user_registered_admin' // Ajouté
  | 'support_request_received_user' // Ajouté
  | 'new_support_request_admin'; // Ajouté

export interface NotificationParams {
  to?: string | string[]; // 'to' devient optionnel, car la RPC peut déduire l'utilisateur courant
  name?: string;
  amount?: number;
  reason?: string;
  otp_code?: string;
  email?: string; // Email du nouvel utilisateur, par exemple
  method?: string;
  proof_url?: string;
  date?: string;
  support_phone?: string;
  userId?: string; // ID utilisateur de l'événement
  notificationId?: string;
  activity?: string;
  ip?: string;
  timestamp?: string;
  startDate?: string;
  endDate?: string;
  contractId?: string;
  profitAmount?: number;
  monthlyRate?: string;
  activityType?: string;
  ipAddress?: string;
  old_email?: string;
  new_email?: string;
  // Paramètres spécifiques pour les demandes de support
  support_request_id?: string;
  subject?: string; // Sujet de la demande de support
  message?: string; // Message de la demande de support
}

/**
 * Envoie une notification via notre système de file d'attente d'emails.
 * Appelle la RPC SQL `enqueue_email_notification` pour insérer dans la queue.
 */
export const sendResendNotification = async (
  templateId: NotificationTemplate,
  params: NotificationParams
): Promise<{ success: boolean; error?: string; id?: string }> => {
  try {
    const { data, error } = await supabase.rpc('enqueue_email_notification', {
      p_template_id: templateId,
      p_params: params // Passer tous les paramètres nécessaires
    });

    if (error) {
      console.error('Error enqueuing notification via RPC:', error);
      return { success: false, error: error.message };
    }

    // Si la RPC retourne un succès, nous considérons que c'est en file d'attente
    return { success: true }; 
  } catch (error) {
    console.error('Error in sendResendNotification (RPC call):', error);
    return { success: false, error: (error as Error).message };
  }
};

/**
 * Récupère les préférences de notification pour un utilisateur
 */
export const getUserNotificationPreferences = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching notification preferences:', error);
      return null;
    }

    // Transformer les données en objet structuré
    const preferences: Record<string, any> = {};
    data.forEach(pref => {
      preferences[pref.notification_type] = {
        email: pref.email_enabled,
        push: pref.push_enabled,
        internal: pref.internal_enabled
      };
    });

    return preferences;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return null;
  }
};

/**
 * Met à jour les préférences de notification pour un utilisateur
 */
export const updateUserNotificationPreferences = async (
  userId: string,
  preferences: Partial<Record<string, { email: boolean; push: boolean; internal: boolean }>>
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Supprimer les préférences existantes pour cet utilisateur
    const { error: deleteError } = await supabase
      .from('user_notification_preferences')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting old notification preferences:', deleteError);
      return { success: false, error: deleteError.message };
    }

    // Insérer les nouvelles préférences
    const preferencesToInsert = Object.entries(preferences).map(([type, prefs]) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      notification_type: type,
      email_enabled: prefs.email,
      push_enabled: prefs.push || false,
      internal_enabled: prefs.internal || true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    if (preferencesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('user_notification_preferences')
        .insert(preferencesToInsert);

      if (insertError) {
        console.error('Error inserting notification preferences:', insertError);
        return { success: false, error: insertError.message };
      }
    }
    
    // --- Send Notification Preferences Updated Confirmation ---
    const profile = await getProfile(); // Fetch profile to get full_name
    if (profile?.email) {
      await sendResendNotification('notification_preferences_updated', {
        to: profile.email,
        name: profile.first_name || 'Cher utilisateur',
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        userId: userId
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return { success: false, error: (error as Error).message };
  }
};