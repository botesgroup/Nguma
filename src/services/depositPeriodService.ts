/**
 * Service de gestion des dépôts
 * Fournit des fonctions pour vérifier l'état des dépôts selon les paramètres système
 */

import { supabase } from '@/integrations/supabase/client';
import { getSettingByKey } from '@/services/settingsService';
import { sendResendNotification } from '@/services/resendNotificationService';


/**
 * Vérifie si les dépôts sont actuellement autorisés
 * @returns {Promise<boolean>} true si les dépôts sont autorisés, false sinon
 */
export const isDepositEnabled = async (): Promise<boolean> => {
  try {
    const depositEnabledSetting = await getSettingByKey('deposit_enabled');
    const isEnabled = depositEnabledSetting?.value === 'true';
    return isEnabled;
  } catch (error) {
    console.error('Error checking deposit enabled status:', error);
    return false; // En cas d'erreur, on désactive par sécurité
  }
};


