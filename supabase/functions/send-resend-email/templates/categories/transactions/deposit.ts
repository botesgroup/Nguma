import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderDepositApproved = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, formatDate, generateSupportHtml, siteUrl } = helpers;
  const { name, amount, support_phone } = params;

  const subject = `Crédit confirmé sur votre compte`;
  const previewText = `Les fonds de ${formatCurrency(amount)} sont disponibles.`;

  const content = `
    ${StatusBadge('success', 'Opération validée')}
    <h2>Fonds disponibles</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre transaction récente a été traitée avec succès. Le montant a été crédité sur votre balance.
    </p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant crédité :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Référence :</td><td>Dépôt</td></tr>
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
      </table>
    `, 'success')}
    
    <div class="cta-buttons">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Consulter mon solde</a>
    </div>
    
    ${generateSupportHtml(support_phone)}
  `;

  const html = BaseLayout(content, previewText, siteUrl);

  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre dépôt de ${formatCurrency(amount)} est confirmé.`,
    html
  };
};

const renderDepositRejected = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, escapeHtml, siteUrl } = helpers;
    const { name, amount, reason } = params;
    
    const subject = `Mise à jour concernant votre transaction`;
    const previewText = `Nous ne pouvons pas valider votre opération de ${formatCurrency(amount)}.`;

    const content = `
      ${StatusBadge('error', 'Opération non aboutie')}
      <h2>Information importante</h2>
      <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
        Nous avons analysé votre demande de dépôt. Pour des raisons de sécurité ou de conformité, elle n'a pas pu être validée.
      </p>
      
      ${InfoCard(`
        <table class="info-table" style="width: 100%; table-layout: fixed;">
          <tr>
            <td style="width: 35%; vertical-align: top;">Montant :</td>
            <td style="width: 65%; vertical-align: top;">${formatCurrency(amount)}</td>
          </tr>
          <tr>
            <td style="width: 35%; vertical-align: top;">Motif :</td>
            <td style="width: 65%; vertical-align: top; word-wrap: break-word;" class="rejection-reason">${escapeHtml(reason || "Vérification incomplète")}</td>
          </tr>
        </table>
      `, 'error')}
      
      <div class="cta-buttons">
        <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
      </div>
    `;

    const html = BaseLayout(content, previewText, siteUrl);

    return {
      subject,
      previewText,
      text: `Bonjour ${name}, votre transaction n'a pas pu aboutir.`,
      html
    };
};

const renderDepositPending = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, siteUrl } = helpers;
    const { name, amount } = params;

    const subject = `Réception de votre demande de dépôt`;
    const previewText = `Votre demande de ${formatCurrency(amount)} est en cours d'analyse.`;
    
    const content = `
      ${StatusBadge('info', 'En cours de traitement')}
      <h2>Demande reçue</h2>
      <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
        Nous avons bien reçu votre demande de dépôt. Nos services procèdent actuellement à la vérification de la transaction.
      </p>
      
      ${InfoCard(`
        <table class="info-table">
          <tr><td>Montant :</td><td class="amount-highlight">${formatCurrency(amount)}</td></tr>
          <tr><td>Délai de traitement :</td><td>Jusqu'à 5 jours ouvrables</td></tr>
        </table>
      `)}
      
      <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
        Vous recevrez une notification de confirmation dès que les fonds seront crédités sur votre compte.
      </p>
    `;

    const html = BaseLayout(content, previewText, siteUrl);
    
    return {
      subject,
      previewText,
      text: `Bonjour ${name}, nous analysons votre demande.`,
      html
    };
};

export const depositApprovedTemplate: EmailTemplate = {
  id: 'deposit_approved',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderDepositApproved
};

export const depositRejectedTemplate: EmailTemplate = {
  id: 'deposit_rejected',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderDepositRejected
};

export const depositPendingTemplate: EmailTemplate = {
  id: 'deposit_pending',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderDepositPending
};
