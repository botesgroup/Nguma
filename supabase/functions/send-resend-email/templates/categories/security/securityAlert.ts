import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderSecurityAlert = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { escapeHtml, formatDate, siteUrl } = helpers;
    const { name, activityType, ipAddress, date } = params;
    
    const subject = '⚠️ Alerte de Sécurité';
    const previewText = 'Une activité inhabituelle a été détectée sur votre compte.';
    
    const content = `
      ${StatusBadge('error', 'Alerte de Sécurité')}
      <h2>Activité Inhabituelle Détectée</h2>
      <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
        Une activité inhabituelle a été détectée sur votre compte. Veuillez examiner les détails ci-dessous.
      </p>
      
      ${InfoCard(`
        <table class="info-table">
          <tr><td>Date :</td><td>${escapeHtml(date || formatDate())}</td></tr>
          <tr><td>Type d'activité :</td><td>${escapeHtml(activityType || 'N/A')}</td></tr>
          <tr><td>Adresse IP :</td><td>${escapeHtml(ipAddress || 'N/A')}</td></tr>
        </table>
      `, 'error')}
      
      <p style="font-size: 14px; color: #DC2626;">
        Si vous n'êtes pas à l'origine de cette activité, veuillez contacter immédiatement le support.
      </p>
      
      <div class="cta-buttons">
        <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
      </div>
    `;
    
    const html = BaseLayout(content, previewText, siteUrl);
    
    return {
      subject,
      previewText,
      text: `Bonjour ${name}, une activité inhabituelle a été détectée sur votre compte. Détails: Date: ${date || formatDate()}, Type: ${activityType}, IP: ${ipAddress}.`,
      html
    };
};

export const securityAlertTemplate: EmailTemplate = {
  id: 'security_alert',
  category: 'security',
  requiredFields: ['to', 'name', 'activityType', 'ipAddress'],
  render: renderSecurityAlert
};
