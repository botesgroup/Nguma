import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderNewUserRegisteredAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { escapeHtml, siteUrl } = helpers;
    const { name, email, userId } = params;

    const subject = `[ADMIN] Nouvel Utilisateur : ${name || email}`;
    const previewText = `Un nouvel utilisateur vient de s'inscrire : ${name || email}`;

    const content = `
    ${StatusBadge('info', 'Nouvelle Inscription')}
    <h2>Nouvel Utilisateur Inscrit</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Un nouveau profil a été créé sur la plateforme.
    </p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Nom :</td><td><strong>${escapeHtml(name || 'Non spécifié')}</strong></td></tr>
        <tr><td>Email :</td><td>${escapeHtml(email)}</td></tr>
        <tr><td>ID Utilisateur :</td><td><code>${escapeHtml(userId || 'N/A')}</code></td></tr>
        <tr><td>Date :</td><td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
      </table>
    `)}
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/users?email=${escapeHtml(email)}" class="btn btn-primary">Voir le profil</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Nouvel utilisateur inscrit : ${name || email} (ID: ${userId})`,
        html
    };
};

export const newUserRegisteredAdminTemplate: EmailTemplate = {
    id: 'new_user_registered_admin',
    category: 'admin',
    requiredFields: ['to', 'email'],
    render: renderNewUserRegisteredAdmin
};
