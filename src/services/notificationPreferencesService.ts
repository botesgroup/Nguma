/**
 * Service de gestion des préférences de notification
 * Permet aux utilisateurs de contrôler quels types de notifications ils reçoivent
 */

import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'deposit'
  | 'withdrawal'
  | 'contract'
  | 'profit'
  | 'security'
  | 'system'
  | 'deposit_availability_reminder'
  | 'admin_deposit'
  | 'admin_withdrawal'
  | 'admin_user'
  | 'admin_contract'
  | 'admin_support'
  | 'admin_refund';

export interface NotificationPreferences {
  deposit: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  withdrawal: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  contract: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  profit: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  security: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  system: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  deposit_availability_reminder: { // New default preference
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  admin_deposit: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  admin_withdrawal: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  admin_user: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  admin_contract: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  admin_support: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
  admin_refund: {
    email: boolean;
    push: boolean;
    internal: boolean;
  };
}

// Préférences par défaut
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  deposit: {
    email: true,
    push: true,
    internal: true
  },
  withdrawal: {
    email: true,
    push: true,
    internal: true
  },
  contract: {
    email: true,
    push: true,
    internal: true
  },
  profit: {
    email: true,
    push: true,
    internal: true
  },
  security: {
    email: true,
    push: true,
    internal: true
  },
  system: {
    email: true,
    push: true,
    internal: true
  },
  deposit_availability_reminder: { // New default preference
    email: true,
    push: false, // Default to false for push for this type
    internal: false // Default to false for internal for this type
  },
  admin_deposit: {
    email: true,
    push: false,
    internal: true
  },
  admin_withdrawal: {
    email: true,
    push: false,
    internal: true
  },
  admin_user: {
    email: true,
    push: false,
    internal: true
  },
  admin_contract: {
    email: true,
    push: false,
    internal: true
  },
  admin_support: {
    email: true,
    push: false,
    internal: true
  },
  admin_refund: {
    email: true,
    push: false,
    internal: true
  }
};

/**
 * Récupère les préférences de notification pour un utilisateur.
 * N'a pas d'effets de bord: ne crée pas de préférences si elles n'existent pas.
 */
export const getUserNotificationPreferences = async (
  userId: string
): Promise<NotificationPreferences> => {
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('notification_type, email_enabled, push_enabled, internal_enabled')
      .eq('user_id', userId);

    if (error) {
      // Retourner les préférences par défaut en cas d'erreur
      return DEFAULT_PREFERENCES;
    }

    if (!data || data.length === 0) {
      // Si aucune préférence n'est trouvée, retourner l'objet par défaut en mémoire
      return DEFAULT_PREFERENCES;
    }

    // Convertir les préférences brutes en objet structuré
    const preferences: Partial<NotificationPreferences> = {};

    data.forEach(pref => {
      const type = pref.notification_type as NotificationType;
      if (type in DEFAULT_PREFERENCES) {
        preferences[type] = {
          email: pref.email_enabled ?? true,
          push: pref.push_enabled ?? false,
          internal: pref.internal_enabled ?? true
        };
      }
    });

    // Fusionner avec les valeurs par défaut pour s'assurer que tous les types sont présents
    return mergedPreferences;

  } catch (error) {
    return DEFAULT_PREFERENCES;
  }
};

/**
 * Met à jour les préférences de notification pour un utilisateur en utilisant "upsert".
 * C'est une opération atomique qui insère ou met à jour les enregistrements.
 */
export const updateUserNotificationPreferences = async (
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Préparer les données pour l'upsert
    const upsertData = Object.entries(preferences).map(([type, prefs]) => ({
      user_id: userId,
      notification_type: type,
      email_enabled: prefs.email ?? true,
      push_enabled: prefs.push ?? false,
      internal_enabled: prefs.internal ?? true,
      updated_at: new Date().toISOString()
    }));

    if (upsertData.length === 0) {
      return { success: true };
    }

    // Utiliser upsert pour insérer ou mettre à jour en se basant sur la contrainte unique
    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert(upsertData, { onConflict: 'user_id, notification_type' });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};



/**
 * Vérifie si un utilisateur souhaite recevoir une notification spécifique
 */
export const shouldSendNotification = async (
  userId: string,
  type: NotificationType,
  channel: 'email' | 'push' | 'internal' = 'email'
): Promise<boolean> => {
  try {
    const preferences = await getUserNotificationPreferences(userId);
    const typePrefs = preferences[type];

    if (!typePrefs) {
      // Si le type n'existe pas dans les préférences, utiliser la valeur par défaut
      const defaultValue = DEFAULT_PREFERENCES[type]?.[channel] ?? true;
      return defaultValue;
    }
    return typePrefs[channel] ?? false;
  } catch (error) {
    // En cas d'erreur, envoyer la notification par sécurité
    return true;
  }
};

/**
 * Bascule une préférence spécifique
 */
export const toggleNotificationPreference = async (
  userId: string,
  type: NotificationType,
  channel: 'email' | 'push' | 'internal'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentPreferences = await getUserNotificationPreferences(userId);
    const currentValue = currentPreferences[type][channel];

    // Mettre à jour seulement ce canal spécifique
    const newPreferences = { ...currentPreferences };
    newPreferences[type][channel] = !currentValue;

    return await updateUserNotificationPreferences(userId, newPreferences);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

/**
 * Récupère les préférences par utilisateur pour un type spécifique
 */
export const getNotificationPreferencesByType = async (
  userId: string,
  type: NotificationType
): Promise<{ email: boolean; push: boolean; internal: boolean } | null> => {
  try {
    const preferences = await getUserNotificationPreferences(userId);
    return preferences[type] || null;
  } catch (error) {
    return null;
  }
};

/**
 * S'abonne ou se désabonne à un type de notification spécifique pour le canal email.
 * Utilise la nouvelle logique d'upsert pour une opération atomique.
 */
export const subscribeToNotification = async (
  type: NotificationType,
  enabled: boolean,
  userId?: string // Optionnel: si l'userId n'est pas fourni, il sera récupéré
): Promise<{ success: boolean; error?: string }> => {
  try {
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Utilisateur non authentifié." };
      currentUserId = user.id;
    }

    // 1. Récupérer l'état actuel des préférences (sans effets de bord)
    const currentPreferences = await getUserNotificationPreferences(currentUserId);

    // 2. Créer un nouvel objet de préférences avec la modification souhaitée
    const newPreferences: Partial<NotificationPreferences> = {
      ...currentPreferences,
      [type]: {
        ...currentPreferences[type],
        email: enabled,
      },
    };

    // 3. Appeler la fonction d'update robuste qui utilise upsert
    return await updateUserNotificationPreferences(currentUserId, newPreferences);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};