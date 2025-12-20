import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

// Template pour l'utilisateur
const renderSupportRequestReceivedUser = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, siteUrl } = helpers;
  const { name, support_request_id, subject: userSubject } = params;

  const subject = `Votre demande de support #${escapeHtml(support_request_id || 'N/A')} a bien été reçue`;
  const previewText = `Nous avons bien reçu votre demande concernant "${escapeHtml(userSubject || 'Votre demande')}".`;

  const content = `
    ${StatusBadge('success', 'Demande Reçue')}
    <h2>Confirmation de votre demande de support</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Bonjour ${escapeHtml(name)},<br>
      Nous avons bien reçu votre demande de support (référence #${escapeHtml(support_request_id || 'N/A')}) concernant :<br>
      "<strong>${escapeHtml(userSubject || 'Aucun sujet fourni')}</strong>".
    </p>
    ${InfoCard(`
      <p>Notre équipe du support technique va examiner votre demande dans les plus brefs délais et vous répondra directement.</p>
      <p>Vous pouvez suivre l'état de votre demande ou consulter nos FAQ ici :</p>
    `, 'info')}
    <div class="cta-buttons">
      <a href="${siteUrl}/support/tickets/${escapeHtml(support_request_id || '')}" class="btn btn-primary">Voir ma demande</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, nous avons bien reçu votre demande de support #${support_request_id} concernant "${userSubject}". Notre équipe vous répondra bientôt.`,
    html
  };
};

// Template pour l'administrateur
const renderNewSupportRequestAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, email, userId, support_request_id, subject: userSubject, message: userMessage } = params;

  const subject = `[ADMIN] Nouvelle demande de support : #${escapeHtml(support_request_id || 'N/A')}`;
  const previewText = `De : ${escapeHtml(name || email)} | Sujet : ${escapeHtml(userSubject || 'N/A')}`;

  const content = `
    ${StatusBadge('info', 'Nouvelle Demande')}
    <h2>Nouvelle demande de support reçue</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Une nouvelle demande de support a été soumise. Veuillez l'examiner et y répondre.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Référence :</td><td><strong>#${escapeHtml(support_request_id || 'N/A')}</strong></td></tr>
        <tr><td>Utilisateur :</td><td>${escapeHtml(name || 'N/A')} (${escapeHtml(email || 'N/A')})</td></tr>
        <tr><td>ID Utilisateur :</td><td>${escapeHtml(userId || 'N/A')}</td></tr>
        <tr><td>Sujet :</td><td><strong>${escapeHtml(userSubject || 'N/A')}</strong></td></tr>
        <tr><td>Message :</td><td>${escapeHtml(userMessage || 'N/A')}</td></tr>
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
      </table>
    `, 'info')}
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/support/tickets/${escapeHtml(support_request_id || '')}" class="btn btn-primary">Voir la demande</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Nouvelle demande de support #${support_request_id} de ${name} (${email}). Sujet: ${userSubject}. Message: ${userMessage}.`,
    html
  };
};

export const supportRequestReceivedUserTemplate: EmailTemplate = {
  id: 'support_request_received_user',
  category: 'system', // Catégorie 'system' car c'est une notification de système
  requiredFields: ['to', 'name', 'support_request_id', 'subject'],
  render: renderSupportRequestReceivedUser
};

export const newSupportRequestAdminTemplate: EmailTemplate = {
  id: 'new_support_request_admin',
  category: 'admin',
  requiredFields: ['to', 'name', 'email', 'userId', 'support_request_id', 'subject', 'message'],
  render: renderNewSupportRequestAdmin
};
