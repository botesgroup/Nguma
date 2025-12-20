import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

// 1. User: Profile Updated by Admin
const renderProfileUpdatedByAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { escapeHtml, formatDate, siteUrl } = helpers;
    const { name, updatedFields, date } = params;

    const subject = `Mise à jour de votre profil`;
    const previewText = `Un administrateur a mis à jour certaines informations de votre profil.`;

    const content = `
    ${StatusBadge('warning', 'Profil Mis à Jour')}
    <h2>Mise à jour administrative</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Bonjour ${escapeHtml(name)},<br>
      Un administrateur a mis à jour les informations de votre profil pour garantir l'exactitude de votre dossier.
    </p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Date :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
      <p style="margin-top: 10px; font-size: 14px;"><strong>Champs mis à jour :</strong></p>
      <p>${escapeHtml(updatedFields || 'Informations générales')}</p>
    `, 'warning')}

    <p style="font-size: 14px; color: #666;">
      Assurez-vous de vérifier ces informations lors de votre prochaine connexion.
    </p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/settings" class="btn btn-primary">Voir mon profil</a>
    </div>
  `;

    return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: previewText };
};

// Exports
export const profileTemplates: EmailTemplate[] = [
    {
        id: 'profile_updated_by_admin',
        category: 'security',
        requiredFields: ['to', 'name'],
        render: renderProfileUpdatedByAdmin
    }
];
