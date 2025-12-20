import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderWelcomeNewUser = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, siteUrl } = helpers;
  const { name } = params;

  const subject = `Bienvenue chez Nguma !`;
  const previewText = `Votre aventure d'investissement commence maintenant.`;

  const content = `
    <h1>Bienvenue, ${escapeHtml(name)} !</h1>
    <p>Nous sommes ravis de vous compter parmi nous. Votre compte a été créé avec succès.</p>
    <p>Nguma est votre partenaire de confiance pour faire fructifier votre capital en toute sérénité. Voici quelques étapes pour bien commencer :</p>
    <ul>
      <li><a href="${siteUrl}/profile">Complétez votre profil</a> pour une expérience personnalisée.</li>
      <li><a href="${siteUrl}/how-it-works">Découvrez notre fonctionnement</a> et nos stratégies d'investissement.</li>
      <li>Effectuez votre premier dépôt et commencez à investir.</li>
    </ul>
    <p>Notre équipe est à votre disposition pour toute question.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/dashboard" class="btn btn-primary">Accéder à mon tableau de bord</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: `Bienvenue, ${name} ! Votre compte a été créé. Accédez à votre tableau de bord: ${siteUrl}/dashboard` };
};

export const welcomeNewUserTemplate: EmailTemplate = {
  id: 'welcome_new_user',
  category: 'marketing',
  requiredFields: ['to', 'name'],
  render: renderWelcomeNewUser
};
