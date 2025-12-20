import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderBackupCodesGenerated = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, siteUrl, formatDate } = helpers;
  const { name, date } = params;

  const subject = `[Sécurité] Nouveaux codes de secours générés`;
  const previewText = `De nouveaux codes de secours pour la 2FA ont été générés pour votre compte.`;

  const content = `
    <h1>Alerte de sécurité</h1>
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>De nouveaux codes de secours pour l'authentification à deux facteurs (2FA) ont été générés pour votre compte le ${escapeHtml(date || formatDate())}.</p>
    <p>Si vous n'êtes pas à l'origine de cette action, votre compte est peut-être compromis. Veuillez changer votre mot de passe immédiatement et contacter le support.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: `Bonjour ${name}, de nouveaux codes de secours 2FA ont été générés pour votre compte. Si vous n'êtes pas à l'origine de cette action, contactez le support.` };
};

export const backupCodesGeneratedTemplate: EmailTemplate = {
  id: 'backup_codes_generated',
  category: 'security',
  requiredFields: ['to', 'name'],
  render: renderBackupCodesGenerated
};
