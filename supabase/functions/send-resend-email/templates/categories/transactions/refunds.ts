import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

// 1. User: Refund Requested Confirmation
const renderRefundRequested = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, formatCurrency, siteUrl } = helpers;
  const { name, amount, contractId, reason, date } = params;

  const subject = `Demande de Remboursement Reçue - Contrat #${contractId}`;
  const previewText = `Nous avons bien reçu votre demande de remboursement de ${formatCurrency(amount)}.`;

  const content = `
    ${StatusBadge('info', 'Demande Reçue')}
    <h2>Demande en cours de traitement</h2>
    <p class="lead">Bonjour ${escapeHtml(name)},</p>
    <p>Nous avons bien reçu votre demande de remboursement pour le contrat <strong>#${escapeHtml(contractId)}</strong>.</p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant demandé:</td><td>${formatCurrency(amount)}</td></tr>
        <tr><td>Date:</td><td>${escapeHtml(date || formatDate())}</td></tr>
        <tr><td>Motif:</td><td>${escapeHtml(reason || 'Non spécifié')}</td></tr>
      </table>
    `, 'info')}

    <p>Votre demande est en cours d'examen. Vous recevrez une notification de décision sous un délai de 5 jours ouvrables.</p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/contracts" class="btn btn-primary">Voir mes contrats</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: previewText };
};

// 2. Admin: New Refund Request
const renderNewRefundRequest = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, formatCurrency, siteUrl } = helpers;
  const { userName, userEmail, amount, contractId, reason, date } = params;

  const subject = `🔔 Nouvelle demande de remboursement: ${formatCurrency(amount)}`;
  const previewText = `${userName} a demandé un remboursement pour le contrat #${contractId}.`;

  const content = `
    ${StatusBadge('warning', 'Action Requise')}
    <h2>Nouvelle Demande de Remboursement</h2>
    <p class="lead">Une nouvelle demande nécessite votre attention.</p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Utilisateur:</td><td>${escapeHtml(userName)} <br><small>(${escapeHtml(userEmail)})</small></td></tr>
        <tr><td>Contrat:</td><td>#${escapeHtml(contractId)}</td></tr>
        <tr><td>Montant:</td><td>${formatCurrency(amount)}</td></tr>
        <tr><td>Motif:</td><td>${escapeHtml(reason || 'Non spécifié')}</td></tr>
        <tr><td>Date:</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'warning')}

    <div class="cta-buttons">
      <a href="${siteUrl}/admin/refunds" class="btn btn-primary">Gérer la demande</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: previewText };
};

// 3. User: Refund Approved
const renderRefundApproved = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, formatCurrency, siteUrl } = helpers;
  const { name, amount, contractId, date } = params;

  const subject = `✅ Remboursement Approuvé - Contrat #${contractId}`;
  const previewText = `Votre demande de remboursement de ${formatCurrency(amount)} a été approuvée.`;

  const content = `
    ${StatusBadge('success', 'Remboursement Approuvé')}
    <h2>Bonne nouvelle !</h2>
    <p class="lead">Bonjour ${escapeHtml(name)},</p>
    <p>Votre demande de remboursement pour le contrat <strong>#${escapeHtml(contractId)}</strong> a été validée.</p>
    
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant remboursé:</td><td>${formatCurrency(amount)}</td></tr>
        <tr><td>Date de validation:</td><td>${escapeHtml(date || formatDate())}</td></tr>
        <tr><td>Statut:</td><td><strong>Crédité sur votre solde</strong></td></tr>
      </table>
    `, 'success')}

    <p>Les fonds ont été ajoutés à votre solde disponible. Vous pouvez maintenant effectuer un retrait ou réinvestir.</p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Voir mon solde</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: previewText };
};

// 4. User: Refund Rejected
const renderRefundRejected = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, siteUrl } = helpers;
  const { name, contractId, reason } = params;

  const subject = `❌ Mise à jour concernant votre demande - Contrat #${contractId}`;
  const previewText = `Votre demande de remboursement pour le contrat #${contractId} a été refusée.`;

  const content = `
    ${StatusBadge('error', 'Demande Refusée')}
    <h2>Mise à jour de votre demande</h2>
    <p class="lead">Bonjour ${escapeHtml(name)},</p>
    <p>Après examen, nous ne pouvons pas donner suite à votre demande de remboursement pour le contrat <strong>#${escapeHtml(contractId)}</strong>.</p>
    
    ${InfoCard(`
      <p><strong>Motif du refus :</strong></p>
      <p>${escapeHtml(reason || 'Non respect des conditions générales de vente.')}</p>
    `, 'error')}

    <p>Si vous pensez qu'il s'agit d'une erreur, vous pouvez contacter notre support.</p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-secondary">Contacter le support</a>
    </div>
  `;

  return { subject, previewText, html: BaseLayout(content, previewText, siteUrl), text: previewText };
};

// Exports
export const refundTemplates: EmailTemplate[] = [
  {
    id: 'refund_requested',
    category: 'transaction',
    requiredFields: ['to', 'name', 'amount', 'contractId'],
    render: renderRefundRequested
  },
  {
    id: 'new_refund_request',
    category: 'admin',
    requiredFields: ['to', 'userName', 'userEmail', 'amount', 'contractId'],
    render: renderNewRefundRequest
  },
  {
    id: 'refund_approved',
    category: 'transaction',
    requiredFields: ['to', 'name', 'amount', 'contractId'],
    render: renderRefundApproved
  },
  {
    id: 'refund_rejected',
    category: 'transaction',
    requiredFields: ['to', 'name', 'contractId'],
    render: renderRefundRejected
  }
];
