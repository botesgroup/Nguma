import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderWithdrawalApproved = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, siteUrl } = helpers;
  const { name, amount } = params;

  const subject = `Validation de votre transfert sortant`;
  const previewText = `Le retrait de ${formatCurrency(amount)} a été approuvé.`;

  const content = `
    ${StatusBadge('success', 'Transfert validé')}
    <h2>Opération confirmée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de retrait a été validée par nos services financiers. Les fonds sont en route vers votre compte de destination.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant retiré :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Statut :</td><td>Envoyé</td></tr>
      </table>
    `)}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre retrait est validé.`,
    html
  };
};

const renderWithdrawalRejected = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, siteUrl } = helpers;
  const { name, amount, reason } = params;

  const subject = `Information sur votre demande de retrait`;
  const previewText = `Impossible de traiter le retrait de ${formatCurrency(amount)}.`;

  const content = `
    ${StatusBadge('error', 'Transfert annulé')}
    <h2>Action requise</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de retrait n'a pas pu être finalisée. Aucun montant n'a été débité de votre solde.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant :</td><td>${formatCurrency(amount)}</td></tr>
        <tr><td>Raison :</td><td class="rejection-reason">${escapeHtml(reason || "Données incorrectes")}</td></tr>
      </table>
    `, 'error')}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre retrait n'a pas pu être traité.`,
    html
  };
};

const renderWithdrawalPending = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, siteUrl } = helpers;
  const { name, amount } = params;

  const subject = `Demande de retrait enregistrée`;
  const previewText = `Confirmation de votre demande de ${formatCurrency(amount)}.`;

  const content = `
    ${StatusBadge('info', 'Vérification en cours')}
    <h2>Demande enregistrée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Vous avez initié une demande de retrait. Pour votre sécurité, notre équipe va valider cette opération manuellement.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant demandé :</td><td class="amount-highlight">${formatCurrency(amount)}</td></tr>
        <tr><td>Délai :</td><td>24-48h</td></tr>
      </table>
    `)}
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre demande est enregistrée.`,
    html
  };
};

const renderWithdrawalApprovedWithProof = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
  const { name, amount, proof_url, method, date } = params;

  const subject = `Confirmation de transfert - ${formatCurrency(amount)}`;
  const previewText = `Votre retrait a été transféré. Preuve jointe.`;

  const content = `
    ${StatusBadge('success', 'Transfert Effectué ✅')}
    <h2>Opération Confirmée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre demande de retrait a été approuvée et transférée vers votre compte. Vous trouverez ci-dessous la preuve officielle du transfert.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">📋 Détails du Transfert</h3>
      <table class="info-table">
        <tr><td>Méthode :</td><td><strong>${escapeHtml(method || 'N/A')}</strong></td></tr>
        <tr><td>Montant net :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Date :</td><td>${date || formatDate()}</td></tr>
        <tr><td>Statut :</td><td style="color:#059669;">✓ Envoyé</td></tr>
      </table>
    `, 'success')}

    <div class="info-card" style="margin-top: 30px; background: #F0FDF4; border-color: #BBF7D0;">
      <h3 style="margin-top:0; color: #059669;">📑 Preuve de Transfert</h3>
      <p>Voici la confirmation officielle de votre transfert :</p>
      <div style="text-align: center; margin: 20px 0; background: white; padding: 15px; border-radius: 8px;">
        <img src="${proof_url}" alt="Preuve de transfert" 
             style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #D1FAE5; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
      </div>
      <div class="cta-buttons">
        <a href="${proof_url}" download class="btn btn-primary" style="background-color: #059669;">
          📥 Télécharger la preuve
        </a>
      </div>
      <p style="font-size: 12px; color: #059669; margin-top: 15px; text-align: center;">
        💡 Conservez cette preuve pour vos archives personnelles.
      </p>
    </div>
    
    <div class="cta-buttons" style="margin-top: 30px;">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Voir mon historique</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre retrait de ${formatCurrency(amount)} a été transféré. Preuve disponible : ${proof_url}`,
    html
  };
};

export const withdrawalApprovedTemplate: EmailTemplate = {
  id: 'withdrawal_approved',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderWithdrawalApproved
};

export const withdrawalRejectedTemplate: EmailTemplate = {
  id: 'withdrawal_rejected',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderWithdrawalRejected
};

export const withdrawalPendingTemplate: EmailTemplate = {
  id: 'withdrawal_pending',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount'],
  render: renderWithdrawalPending
};

export const withdrawalApprovedWithProofTemplate: EmailTemplate = {
  id: 'withdrawal_approved_with_proof',
  category: 'transaction',
  requiredFields: ['to', 'name', 'amount', 'proof_url'],
  render: renderWithdrawalApprovedWithProof
};
