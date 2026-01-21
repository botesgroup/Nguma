import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderProfitDistributionSummaryAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, siteUrl } = helpers;
    const { totalAmount, investorCount, distributionDate } = params;

    const subject = `[ADMIN] Rapport de Distribution de Profits : ${formatCurrency(totalAmount)}`;
    const previewText = `Résumé de la distribution du ${distributionDate} : ${formatCurrency(totalAmount)} versés à ${investorCount} investisseurs.`;

    const content = `
    ${StatusBadge('success', 'Distribution Terminée')}
    <h2>Rapport de Distribution Mensuelle</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      L'exécution automatique de la distribution des profits mensuels s'est terminée avec succès.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">📊 Statistiques Mondiales</h3>
      <table class="info-table">
        <tr><td>Total Distribué :</td><td class="amount-success" style="font-size: 18px;"><strong>${formatCurrency(totalAmount)}</strong></td></tr>
        <tr><td>Nombre d'Investisseurs :</td><td><strong>${investorCount}</strong></td></tr>
        <tr><td>Date d'exécution :</td><td>${distributionDate}</td></tr>
      </table>
    `, 'success')}
    
    <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
      Cette opération a mis à jour les portefeuilles des utilisateurs et généré les transactions de profit correspondantes.
    </p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/accounting" class="btn btn-primary">Voir la comptabilité</a>
      <a href="${siteUrl}/admin/transactions?type=profit" class="btn" style="background: #6B7280; color: white;">Historique des profits</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Rapport Admin : ${formatCurrency(totalAmount)} versés à ${investorCount} investisseurs le ${distributionDate}.`,
        html
    };
};

export const profitDistributionSummaryAdminTemplate: EmailTemplate = {
    id: 'profit_distribution_summary_admin',
    category: 'admin',
    requiredFields: ['to', 'totalAmount', 'investorCount', 'distributionDate'],
    render: renderProfitDistributionSummaryAdmin
};
