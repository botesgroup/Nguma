import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderDormantFundsReminder = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, generateSupportHtml, siteUrl } = helpers;
  const { name, amount, support_phone } = params;

  const subject = `Votre capital dort... réveillez-le !`;
  const previewText = `Vous avez ${formatCurrency(amount)} prêts à être investis.`;

  const content = `
    ${StatusBadge('info', 'Opportunité')}
    <h2>Votre argent n'attend que vous</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Nous avons remarqué que vous avez <strong>${formatCurrency(amount)}</strong> sur votre balance qui ne génèrent pas encore de profits.
    </p>
    
    ${InfoCard(`
      <p>En activant un contrat aujourd'hui, vous pourriez commencer à percevoir des rendements dès le mois prochain.</p>
      <table class="info-table">
        <tr><td>Solde disponible :</td><td class="amount-highlight">${formatCurrency(amount)}</td></tr>
        <tr><td>Rendement estimé :</td><td>15% / mois</td></tr>
      </table>
    `)}

    <div class="cta-buttons">
      <a href="${siteUrl}/contracts" class="btn btn-primary">Créer un contrat maintenant</a>
    </div>
    
    <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">
      Si vous avez déjà prévu d'investir, ignorez ce message. Vous ne recevrez pas d'autre rappel cette semaine.
    </p>
    ${generateSupportHtml(support_phone)}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, vous avez des fonds disponibles (${formatCurrency(amount)}) sur votre compte Nguma.`,
    html
  };
};

const renderNotificationPreferencesUpdated = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, date } = params;

  const subject = `Confirmation : Vos préférences de notification ont été mises à jour`;
  const previewText = `Vos préférences pour les notifications par e-mail ont été modifiées.`;

  const content = `
    ${StatusBadge('info', 'Préférences Mises à Jour')}
    <h2>Mise à jour de vos préférences de notification</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Nous vous confirmons que vos préférences de notification pour votre compte Nguma ont été mises à jour avec succès.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Date et heure :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `)}
    <p>Vous pouvez consulter et modifier vos préférences à tout moment depuis votre profil.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/settings/notifications" class="btn btn-primary">Gérer mes préférences</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, vos préférences de notification pour votre compte Nguma ont été mises à jour le ${date || formatDate()}.`,
    html
  };
};

const renderDepositAvailabilityReminder = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { siteUrl } = helpers;
  const { name } = params;

  const subject = `🔔 Les dépôts sont de nouveau ouverts !`;
  const previewText = `Vous pouvez maintenant effectuer un nouveau dépôt sur votre compte Nguma.`;

  const content = `
    ${StatusBadge('info', 'Dépôts Ouverts')}
    <h2>Bonne nouvelle !</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Vous avez demandé à être notifié, et nous avons le plaisir de vous informer que les dépôts sont de nouveau activés sur la plateforme.
    </p>
    <div class="cta-buttons">
      <a href="${siteUrl}/dashboard" class="btn btn-primary">Effectuer un dépôt</a>
    </div>
    <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">
      Vous recevez cet e-mail car vous vous êtes abonné aux notifications de disponibilité des dépôts.
    </p>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, les dépôts sont de nouveau ouverts. Vous pouvez vous connecter à votre tableau de bord pour effectuer un dépôt.`,
    html
  };
};

const renderTestMailTester = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { name, siteUrl } = helpers;

  const subject = `Email de Test pour Nguma`;
  const previewText = `Ceci est un test de délivrabilité.`;

  const content = `
    ${StatusBadge('info', 'Test Technique')}
    <h2>Vérification du système d'envoi</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Cet e-mail a été envoyé pour vérifier la configuration du serveur (SPF, DKIM, DMARC) et la qualité du template HTML.
    </p>
    ${InfoCard(`
      <p>Si vous recevez cet e-mail, cela signifie que la partie "envoi" fonctionne correctement.</p>
      <p>Merci de vérifier le score sur mail-tester.com.</p>
    `)}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, ceci est un e-mail de test envoyé depuis le système Nguma pour vérifier la configuration de l'envoi.`,
    html
  };
};


export const dormantFundsReminderTemplate: EmailTemplate = {
  id: 'dormant_funds_reminder',
  category: 'marketing',
  requiredFields: ['to', 'name', 'amount'],
  render: renderDormantFundsReminder
};

export const notificationPreferencesUpdatedTemplate: EmailTemplate = {
  id: 'notification_preferences_updated',
  category: 'marketing',
  requiredFields: ['to', 'name'],
  render: renderNotificationPreferencesUpdated
};

export const depositAvailabilityReminderTemplate: EmailTemplate = {
  id: 'deposit_availability_reminder',
  category: 'marketing',
  requiredFields: ['to', 'name'],
  render: renderDepositAvailabilityReminder
};

export const testMailTesterTemplate: EmailTemplate = {
  id: 'test_mail_tester',
  category: 'system', // Changed to system as it's a technical test
  requiredFields: ['to', 'name'],
  render: renderTestMailTester
};
