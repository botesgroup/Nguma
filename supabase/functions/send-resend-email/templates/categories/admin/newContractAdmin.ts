import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderNewContractAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
    const { userName, email, amount, duration, rate, contractId, startDate } = params;

    const subject = `[ADMIN] Nouveau Contrat : ${formatCurrency(amount)} - ${userName}`;
    const previewText = `${userName} a créé un contrat de ${formatCurrency(amount)} pour ${duration} mois`;

    const content = `
    ${StatusBadge('success', 'Nouveau Contrat')}
    <h2>Nouveau Contrat d'Investissement</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Un utilisateur vient de créer un nouveau contrat d'investissement sur la plateforme.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">👤 Investisseur</h3>
      <table class="info-table">
        <tr><td>Nom :</td><td><strong>${escapeHtml(userName)}</strong></td></tr>
        <tr><td>Email :</td><td>${escapeHtml(email)}</td></tr>
      </table>
      
      <h3>📝 Détails du Contrat</h3>
      <table class="info-table">
        <tr><td>Montant :</td><td class="amount-success"><strong>${formatCurrency(amount)}</strong></td></tr>
        <tr><td>Durée :</td><td>${duration} mois</td></tr>
        <tr><td>Taux :</td><td><strong>${rate}%</strong></td></tr>
        <tr><td>ID Contrat :</td><td><code>${escapeHtml(contractId)}</code></td></tr>
        <tr><td>Date début :</td><td>${escapeHtml(startDate || formatDate())}</td></tr>
        <tr><td>Profit mensuel estimé :</td><td class="amount-success">${formatCurrency(amount * rate / 100)}</td></tr>
      </table>
    `, 'success')}
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/contracts?id=${contractId}" class="btn btn-primary">Voir le contrat</a>
      <a href="${siteUrl}/admin/users?email=${escapeHtml(email)}" class="btn" style="background: #6B7280; color: white;">Profil investisseur</a>
    </div>
  `;

    const html = BaseLayout(content, previewText, siteUrl);

    return {
        subject,
        previewText,
        text: `${userName} a créé un contrat de ${formatCurrency(amount)} pour ${duration} mois à ${rate}%. ID: ${contractId}`,
        html
    };
};

export const newContractAdminTemplate: EmailTemplate = {
    id: 'new_contract_admin',
    category: 'admin',
    requiredFields: ['to', 'userName', 'email', 'amount', 'duration', 'rate', 'contractId'],
    render: renderNewContractAdmin
};
