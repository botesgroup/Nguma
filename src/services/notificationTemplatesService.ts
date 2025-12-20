/**
 * Service de gestion des templates de notification
 * Fournit des modèles de messages pour différents événements
 */

export interface TemplateData {
  [key: string]: string | number;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // Templates pour les dépôts
  'deposit.approved': {
    subject: '✅ Dépôt Approuvé - {{amount}} {{currency}}',
    body: `Bonjour,

Votre dépôt de {{amount}} {{currency}} a été approuvé avec succès.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Méthode : {{method}}
- Référence : {{reference}}

Votre solde a été mis à jour.

Cordialement,
L'équipe Nguma Botes Group`
  },

  'deposit.rejected': {
    subject: '❌ Dépôt Rejeté - {{amount}} {{currency}}',
    body: `Bonjour,

Votre dépôt de {{amount}} {{currency}} a été rejeté.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Méthode : {{method}}
- Référence : {{reference}}

Raison : {{reason}}

Veuillez contacter le support pour plus d'informations.

Cordialement,
L'équipe Nguma Botes Group`
  },

  'deposit.pending': {
    subject: '⏳ Dépôt En Attente - {{amount}} {{currency}}',
    body: `Bonjour,

Votre dépôt de {{amount}} {{currency}} est en attente de validation.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Méthode : {{method}}
- Référence : {{reference}}

Notre équipe procédera à la vérification dans les plus brefs délais.

Cordialement,
L'équipe Nguma Botes Group`
  },

  // Templates pour les retraits
  'withdrawal.approved': {
    subject: '✅ Retrait Approuvé - {{amount}} {{currency}}',
    body: `Bonjour,

Votre retrait de {{amount}} {{currency}} a été approuvé.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Méthode : {{method}}
- Référence : {{reference}}

Fonds transférés selon les modalités spécifiées.

Cordialement,
L'équipe Nguma Botes Group`
  },

  'withdrawal.rejected': {
    subject: '❌ Retrait Rejeté - {{amount}} {{currency}}',
    body: `Bonjour,

Votre retrait de {{amount}} {{currency}} a été rejeté.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Méthode : {{method}}
- Référence : {{reference}}

Raison : {{reason}}

Veuillez contacter le support pour plus d'informations.

Cordialement,
L'équipe Nguma Botes Group`
  },

  'withdrawal.pending': {
    subject: '⏳ Retrait En Attente - {{amount}} {{currency}}',
    body: `Bonjour,

Votre retrait de {{amount}} {{currency}} est en attente de validation.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Méthode : {{method}}
- Référence : {{reference}}

Notre équipe procédera à la vérification dans les plus brefs délais.

Cordialement,
L'équipe Nguma Botes Group`
  },

  // Templates pour les contrats
  'contract.started': {
    subject: '📈 Contrat Activé - Génération de Profits en Cours',
    body: `Bonjour,

Votre contrat d'investissement a été activé avec succès.

Détails :
- Montant investi : {{amount}} {{currency}}
- Méthode : {{method}}
- Date de démarrage : {{startDate}}
- Date de fin prévue : {{endDate}}
- ID du contrat : {{contractId}}

La génération de profits commence immédiatement selon les termes du contrat.

Cordialement,
L'équipe Nguma Botes Group`
  },

  'contract.ended': {
    subject: `🏁 Contrat Terminé - {{contractId}}`,
    body: `Bonjour,

Votre contrat d'investissement (ID: {{contractId}}) est maintenant terminé.

Résumé :
- Montant initial : {{amount}} {{currency}}
- Période : {{startDate}} à {{endDate}}
- Méthode : {{method}}
- Profits totaux : {{totalProfits}} {{currency}}

Consultez votre tableau de bord pour voir les profits réalisés et les options de réinvestissement.

Cordialement,
L'équipe Nguma Botes Group`
  },

  'contract.profit_credited': {
    subject: '💰 Profits Crédités - {{amount}} {{currency}}',
    body: `Bonjour,

{{amount}} {{currency}} de profits ont été crédités à votre compte.

Détails :
- Montant : {{amount}} {{currency}}
- Date : {{date}}
- Contrat : {{contractId}}
- Profit mensuel : {{monthlyRate}}%

Consultez votre tableau de bord pour plus de détails.

Cordialement,
L'équipe Nguma Botes Group`
  },

  // Templates pour les alertes de sécurité
  'security.login_detected': {
    subject: '🔑 Nouvelle Connexion Détectée',
    body: `Bonjour,

Une nouvelle connexion a été détectée sur votre compte.

Détails :
- Date : {{date}}
- Adresse IP : {{ipAddress}}
- Navigateur : {{browser}}
- Pays : {{country}}

Si vous n'êtes pas à l'origine de cette connexion, veuillez changer immédiatement votre mot de passe.

Cordialement,
L'équipe de sécurité Nguma Botes Group`
  },

  'security.password_changed': {
    subject: '🔐 Mot de Passe Modifié',
    body: `Bonjour,

Votre mot de passe a été modifié avec succès.

Détails :
- Date : {{date}}
- Adresse IP : {{ipAddress}}

Si vous n'êtes pas à l'origine de ce changement, veuillez contacter immédiatement le support.

Cordialement,
L'équipe de sécurité Nguma Botes Group`
  },

  'security.profile_updated': {
    subject: '👤 Profil Mis à Jour',
    body: `Bonjour,

Votre profil a été mis à jour.

Détails :
- Date : {{date}}
- Champs modifiés : {{fields}}

Si vous n'êtes pas à l'origine de ces modifications, veuillez contacter le support.

Cordialement,
L'équipe Nguma Botes Group`
  },

  // Templates pour les systèmes
  'system.maintenance': {
    subject: '🔧 Maintenance Planifiée - {{startTime}}',
    body: `Bonjour,

Une maintenance du système est planifiée.

Détails :
- Date : {{startTime}}
- Heure de début : {{startTime}}
- Durée estimée : {{duration}}
- Impact : {{impact}}

Veuillez sauvegarder votre travail avant cette période.

Cordialement,
L'équipe technique Nguma Botes Group`
  },

  'system.update_available': {
    subject: '🆕 Mise à Jour Disponible',
    body: `Bonjour,

Une nouvelle version de notre application est disponible.

Détails :
- Version : {{version}}
- Date de publication : {{releaseDate}}
- Nouvelles fonctionnalités : {{features}}

Actualisez votre navigateur ou rechargez l'application pour bénéficier des dernières améliorations.

Cordialement,
L'équipe Nguma Botes Group`
  }
};

/**
 * Remplace les variables dans un template
 */
export const replaceTemplateVariables = (
  template: string,
  variables: TemplateData
): string => {
  let processedTemplate = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedTemplate = processedTemplate.replace(regex, String(value));
  }
  
  return processedTemplate;
};

/**
 * Récupère un template spécifique
 */
export const getNotificationTemplate = (
  eventType: string
): NotificationTemplate | null => {
  return NOTIFICATION_TEMPLATES[eventType] || null;
};

/**
 * Compile un template avec les données fournies
 */
export const compileNotificationTemplate = (
  eventType: string,
  data: TemplateData
): { subject: string; body: string } | null => {
  const template = getNotificationTemplate(eventType);
  
  if (!template) {
    console.warn(`Template not found for event type: ${eventType}`);
    return null;
  }

  const compiledSubject = replaceTemplateVariables(template.subject, data);
  const compiledBody = replaceTemplateVariables(template.body, data);

  return {
    subject: compiledSubject,
    body: compiledBody
  };
};

/**
 * Liste tous les types de notifications disponibles
 */
export const getAvailableNotificationTypes = (): string[] => {
  return Object.keys(NOTIFICATION_TEMPLATES);
};

/**
 * Valide les données fournies pour un type de notification spécifique
 */
export const validateNotificationData = (
  eventType: string,
  data: TemplateData
): { isValid: boolean; missingFields?: string[] } => {
  const template = getNotificationTemplate(eventType);
  
  if (!template) {
    return { isValid: false, missingFields: [] };
  }

  // Extraire toutes les variables requises du template
  const requiredVars: string[] = [];
  const subjectMatches = template.subject.match(/{{(\w+)}}/g);
  const bodyMatches = template.body.match(/{{(\w+)}}/g);

  if (subjectMatches) {
    subjectMatches.forEach(match => {
      const varName = match.substring(2, match.length - 2); // Enlever les accolades
      if (!requiredVars.includes(varName)) {
        requiredVars.push(varName);
      }
    });
  }

  if (bodyMatches) {
    bodyMatches.forEach(match => {
      const varName = match.substring(2, match.length - 2); // Enlever les accolades
      if (!requiredVars.includes(varName)) {
        requiredVars.push(varName);
      }
    });
  }

  // Vérifier quelles variables sont manquantes
  const missingFields = requiredVars.filter(varName => !(varName in data));

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};