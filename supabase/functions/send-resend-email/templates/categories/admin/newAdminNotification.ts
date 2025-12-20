import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderNewUserRegisteredAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, email, userId } = params;

  const subject = `[ADMIN] Nouvel utilisateur inscrit : ${escapeHtml(name || email)}`;
  const previewText = `Un nouvel utilisateur, ${escapeHtml(name || email)}, s'est inscrit sur Nguma.`;

  const content = `
    ${StatusBadge('info', 'Nouvelle Inscription')}
    <h2>Nouvel utilisateur sur Nguma</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Un nouvel utilisateur vient de s'inscrire sur la plateforme. Veuillez vérifier ses informations si nécessaire.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Nom :</td><td><strong>${escapeHtml(name || 'N/A')}</strong></td></tr>
        <tr><td>Email :</td><td>${escapeHtml(email || 'N/A')}</td></tr>
        <tr><td>User ID :</td><td>${escapeHtml(userId || 'N/A')}</td></tr>
        <tr><td>Date d'inscription :</td><td>${formatDate()}</td></tr>
      </table>
    `, 'info')}
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/users/${escapeHtml(userId || '')}" class="btn btn-primary">Voir le profil utilisateur</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Un nouvel utilisateur ${name} (${email}) s'est inscrit. ID: ${userId}.`,
    html
  };
};

export const newUserRegisteredAdminTemplate: EmailTemplate = {
  id: 'new_user_registered_admin',
  category: 'admin',
  requiredFields: ['to', 'name', 'email', 'userId'],
  render: renderNewUserRegisteredAdmin
};
