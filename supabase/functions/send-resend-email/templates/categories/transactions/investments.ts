import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderMonthlyProfit = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, formatDate, siteUrl } = helpers;
  const { name, amount } = params;

  const subject = `Relevé mensuel : Nouveau crédit`;
  const previewText = `Un montant de ${formatCurrency(amount)} a été ajouté à votre solde.`;

  const content = `
    ${StatusBadge('success', 'Solde mis à jour')}
    <h2>Relevé mensuel</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Le rendement mensuel de votre plan actif a été crédité sur votre compte.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant crédité :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Origine :</td><td>Rendement mensuel</td></tr>
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
      </table>
    `, 'success')}
    <div class="cta-buttons">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Voir mon tableau de bord</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre solde a été mis à jour.`,
    html
  };
};

const renderNewInvestment = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, generateSupportHtml, siteUrl } = helpers;
  const { name, amount, support_phone } = params;

  const subject = `Confirmation d'activation de contrat`;
  const previewText = `Votre plan de ${formatCurrency(amount)} est maintenant actif.`;

  const content = `
    ${StatusBadge('success', 'Contrat Actif')}
    <h2>Activation confirmée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre souscription a bien été prise en compte. Votre capital commence à travailler dès aujourd'hui selon les termes prévus.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Capital initial :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Durée :</td><td>12 mois</td></tr>
        <tr><td>Taux appliqué :</td><td>Standard (15%)</td></tr>
      </table>
    `, 'success')}
    <div class="cta-buttons">
      <a href="${siteUrl}/dashboard" class="btn btn-primary">Gérer mon contrat</a>
    </div>
    ${generateSupportHtml(support_phone)}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Félicitations ${name}, votre contrat est actif.`,
    html
  };
};

const renderContractEnded = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, siteUrl } = helpers;
  const { name, contractId, amount, startDate, endDate, method, totalProfits } = params;

  const subject = `🏁 Contrat Terminé - ${contractId}`;
  const previewText = `Votre contrat (ID: ${contractId}) est maintenant terminé.`;

  const content = `
    ${StatusBadge('info', 'Contrat Terminé')}
    <h2>Votre contrat a pris fin</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre contrat d'investissement (ID: <strong>${escapeHtml(contractId)}</strong>) est maintenant terminé.
      Voici un récapitulatif de votre investissement.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">📊 Récapitulatif Financier</h3>
      <table class="info-table">
        <tr><td>💰 Capital initial :</td><td>${formatCurrency(amount)}</td></tr>
        <tr><td>📈 Total profits générés :</td><td class="amount-success"><strong>${formatCurrency(totalProfits || 0)}</strong></td></tr>
        <tr style="border-top: 2px solid #D1D5DB; background: #F0FDF4;">
          <td><strong>💵 Montant total transféré au solde :</strong></td>
          <td class="amount-success" style="font-size: 18px;"><strong>${formatCurrency(amount + (totalProfits || 0))}</strong></td>
        </tr>
      </table>
    `, 'success')}
    
    ${InfoCard(`
      <h3 style="margin-top:0;">📅 Informations du Contrat</h3>
      <table class="info-table">
        <tr><td>Période :</td><td>${escapeHtml(startDate || 'N/A')} à ${escapeHtml(endDate || 'N/A')}</td></tr>
        <tr><td>Méthode :</td><td>${escapeHtml(method || 'N/A')}</td></tr>
      </table>
    `)}
    
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563; margin-top: 30px;">
      Le montant total (capital + profits) a été automatiquement transféré sur votre solde principal. 
      Vous pouvez maintenant réinvestir vos profits pour continuer à faire fructifier votre capital.
    </p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/contracts/new" class="btn btn-primary">💎 Réinvestir mes profits</a>
      <a href="${siteUrl}/wallet" class="btn" style="background: #6B7280; color: white;">Voir mon solde</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre contrat (ID: ${contractId}) est terminé. Capital: ${formatCurrency(amount)}, Profits: ${formatCurrency(totalProfits || 0)}, Total transféré: ${formatCurrency(amount + (totalProfits || 0))}.`,
    html
  };
};

const renderReinvestmentConfirmed = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, siteUrl } = helpers;
  const { name, amount } = params;

  const subject = `Confirmation de votre réinvestissement`;
  const previewText = `Votre réinvestissement de ${formatCurrency(amount)} a été activé.`;

  const content = `
    ${StatusBadge('success', 'Réinvestissement Activé')}
    <h2>Opération confirmée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de réinvestissement de vos profits a été traitée avec succès. Votre capital continue de croître !
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant réinvesti :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Origine :</td><td>Solde de profits</td></tr>
        <tr><td>Statut :</td><td>Actif sur un nouveau contrat</td></tr>
      </table>
    `, 'success')}
    <p>Vous pouvez suivre la performance de tous vos contrats depuis votre tableau de bord.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/contracts" class="btn btn-primary">Voir mes contrats</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, nous confirmons votre réinvestissement de ${formatCurrency(amount)}.`,
    html
  };
};

const renderContractExpiringSoon = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, siteUrl } = helpers;
  const { name, contractId, amount, endDate } = params;

  const subject = `Rappel : Votre contrat arrive à expiration`;
  const previewText = `Votre contrat ${contractId} se termine le ${endDate}.`;

  const content = `
    ${StatusBadge('info', 'Rappel d\'Expiration')}
    <h2>Votre contrat arrive à son terme</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Ceci est un rappel pour vous informer que l'un de vos contrats d'investissement arrive bientôt à expiration.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>ID du Contrat :</td><td><strong>${escapeHtml(contractId)}</strong></td></tr>
        <tr><td>Montant initial :</td><td>${formatCurrency(amount)}</td></tr>
        <tr><td>Date de fin :</td><td><strong>${escapeHtml(endDate)}</strong></td></tr>
      </table>
    `)}
    <p>À la date de fin, le capital et les profits générés seront transférés sur votre solde principal. Pensez à vos prochaines actions :</p>
    <ul>
      <li>Préparer un retrait.</li>
      <li>Planifier un nouveau réinvestissement pour continuer à faire fructifier votre capital.</li>
    </ul>
    <div class="cta-buttons">
      <a href="${siteUrl}/contracts" class="btn btn-primary">Gérer mes contrats</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre contrat (ID: ${contractId}) arrive à expiration le ${endDate}.`,
    html
  };
};

export const monthlyProfitTemplate: EmailTemplate = {
  id: 'monthly_profit',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderMonthlyProfit
};

export const newInvestmentTemplate: EmailTemplate = {
  id: 'new_investment',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderNewInvestment
};

export const contractEndedTemplate: EmailTemplate = {
  id: 'contract_ended',
  category: 'transaction',
  requiredFields: ['to', 'name', 'contractId', 'amount', 'startDate', 'endDate', 'totalProfits'],
  render: renderContractEnded
};

export const reinvestmentConfirmedTemplate: EmailTemplate = {
  id: 'reinvestment_confirmed',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderReinvestmentConfirmed
};

export const contractExpiringSoonTemplate: EmailTemplate = {
  id: 'contract_expiring_soon',
  category: 'transaction',
  requiredFields: ['to', 'name', 'contractId', 'amount', 'endDate'],
  render: renderContractExpiringSoon
};
