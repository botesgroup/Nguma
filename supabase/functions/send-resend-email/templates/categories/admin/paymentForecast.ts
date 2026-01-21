import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderDailyPaymentForecastAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, siteUrl } = helpers;
    const { totalAmount, investorCount, date } = params;

    const subject = `[PRÉVISION] Paiements du Jour : ${formatCurrency(totalAmount)}`;
    const previewText = `Préparation de trésorerie pour le ${date} : ${formatCurrency(totalAmount)} à prévoir pour ${investorCount} investisseurs.`;

    const content = `
    ${StatusBadge('info', 'Prévision Quotidienne')}
    <h2>Paiements Prévisibles du Jour</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Voici le récapitulatif des profits dont l'anniversaire de contrat tombe aujourd'hui, le <strong>${date}</strong>. 
      Ces montants seront automatiquement crédités aux wallets des clients au cours de la journée.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">💰 Besoins de Trésorerie</h3>
      <table class="info-table">
        <tr><td>Total à Verser :</td><td class="amount-highlight" style="font-size: 18px;"><strong>${formatCurrency(totalAmount)}</strong></td></tr>
        <tr><td>Nombre de Bénéficiaires :</td><td><strong>${investorCount}</strong></td></tr>
        <tr><td>Date Concernée :</td><td>${date}</td></tr>
      </table>
    `, 'info')}
    
    <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
      ℹ️ <em>Ce montant représente les profits qui seront distribués automatiquement par le système. Assurez-vous que les fonds sont prêts pour couvrir les éventuelles demandes de retrait qui pourraient suivre ces versements.</em>
    </p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/accounting" class="btn btn-primary">Voir les Détails Comptables</a>
      <a href="${siteUrl}/admin/contracts" class="btn" style="background: #6B7280; color: white;">Liste des Contrats Actifs</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Prévision de paiements pour le ${date} : ${formatCurrency(totalAmount)} pour ${investorCount} investisseurs.`,
        html
    };
};

export const dailyPaymentForecastAdminTemplate: EmailTemplate = {
    id: 'daily_payment_forecast_admin',
    category: 'admin',
    requiredFields: ['to', 'totalAmount', 'investorCount', 'date'],
    render: renderDailyPaymentForecastAdmin
};
