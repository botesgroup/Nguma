import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderAdminActionLog = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, formatCurrency, siteUrl } = helpers;
  const { 
    adminName, 
    actionType, 
    targetUserName, 
    amount, 
    reason, 
    details 
  } = params as any;

  const subject = `[LOG ADMIN] ${actionType} - par ${adminName}`;
  const previewText = `${adminName} a effectué l'action : ${actionType}`;

  const content = `
    ${StatusBadge('info', 'Log Activité Admin')}
    <h2>Rapport d'action administrative</h2>
    <p style="font-size: 15px; color: #374151;">
      Une action sensible a été effectuée sur la plateforme par un membre de l'équipe administrative.
    </p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Administrateur :</td><td><strong>${escapeHtml(adminName)}</strong></td></tr>
        <tr><td>Action :</td><td><span style="color:#4F46E5; font-weight:bold;">${escapeHtml(actionType)}</span></td></tr>
        <tr><td>Cible :</td><td>${escapeHtml(targetUserName || 'N/A')}</td></tr>
        ${amount ? `<tr><td>Montant :</td><td>${formatCurrency(amount)}</td></tr>` : ''}
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
      </table>
    `)}

    ${reason ? `
    <div style="margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; border-left: 4px solid #D1D5DB;">
      <p style="margin:0; font-weight:bold; color: #4B5563;">Motif renseigné :</p>
      <p style="margin:5px 0 0 0; color: #6B7280; font-style: italic;">"${escapeHtml(reason)}"</p>
    </div>
    ` : ''}

    <div class="cta-buttons" style="margin-top: 30px;">
      <a href="${siteUrl}/admin" class="btn btn-primary">Ouvrir le panel Admin</a>
    </div>
  `;

  return {
    subject,
    previewText,
    text: `Log Admin: ${adminName} a effectué ${actionType} sur ${targetUserName}.`,
    html: BaseLayout(content, previewText, siteUrl)
  };
};

export const adminActionLogTemplate: EmailTemplate = {
  id: 'admin_action_log',
  category: 'admin',
  requiredFields: ['to', 'adminName', 'actionType'],
  render: renderAdminActionLog
};
