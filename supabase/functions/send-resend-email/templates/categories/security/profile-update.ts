import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderProfileUpdatedByUser = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, siteUrl, formatDate } = helpers;
  const { name, date } = params;

  const subject = `Mise à jour de votre profil`;
  const previewText = `Les informations de votre profil ont été modifiées.`;

  const content = `
    <h1>Mise à jour de votre profil</h1>
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Nous vous confirmons que les informations de votre profil ont été mises à jour le ${escapeHtml(date || formatDate())}.</p>
    <p>Si vous n'êtes pas à l'origine de cette modification, veuillez contacter immédiatement notre support.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: `Bonjour ${name}, votre profil a été mis à jour.` };
};

export const profileUpdatedByUserTemplate: EmailTemplate = {
  id: 'profile_updated_by_user',
  category: 'security',
  requiredFields: ['to', 'name'],
  render: renderProfileUpdatedByUser
};
