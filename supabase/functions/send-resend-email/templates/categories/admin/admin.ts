import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderAdminManualCredit = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
  const { name, amount, reason, date } = params;

  const subject = `Information : Votre compte a été crédité`;
  const previewText = `Un montant de ${formatCurrency(amount)} a été ajouté à votre compte par un administrateur.`;

  const content = `
    ${StatusBadge('info', 'Action Administrative')}
    <h2>Votre compte a été crédité</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Une opération manuelle a été effectuée sur votre compte par notre équipe administrative.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Type d'opération :</td><td><strong>Crédit manuel</strong></td></tr>
        <tr><td>Montant ajouté :</td><td class="amount-success">${formatCurrency(amount)}</td></tr>
        <tr><td>Raison :</td><td>${escapeHtml(reason || 'Correction administrative')}</td></tr>
        <tr><td>Date :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'success')}
    <p>Ce montant est maintenant disponible dans votre solde. Pour toute question, n'hésitez pas à contacter le support.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Consulter mon solde</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, un administrateur a crédité votre compte de ${formatCurrency(amount)}. Raison : ${reason}.`,
    html
  };
};

const renderAdminManualDebit = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
  const { name, amount, reason, date } = params;

  const subject = `Information : Un débit a été effectué sur votre compte`;
  const previewText = `Un montant de ${formatCurrency(amount)} a été retiré de votre compte par un administrateur.`;

  const content = `
    ${StatusBadge('error', 'Action Administrative')}
    <h2>Un débit a été effectué sur votre compte</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Une opération manuelle a été effectuée sur votre compte par notre équipe administrative.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Type d'opération :</td><td><strong>Débit manuel</strong></td></tr>
        <tr><td>Montant retiré :</td><td class="rejection-reason">${formatCurrency(amount)}</td></tr>
        <tr><td>Raison :</td><td>${escapeHtml(reason || 'Correction administrative')}</td></tr>
        <tr><td>Date :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'error')}
    <p>Ce montant a été retiré de votre solde. Pour toute question, veuillez contacter immédiatement le support.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, un administrateur a débité votre compte de ${formatCurrency(amount)}. Raison : ${reason}.`,
    html
  };
};

const renderNewDepositRequest = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
  const { amount, email, userName, transactionId, paymentMethod, proofUrl } = params;

  const subject = `[ADMIN] Nouveau Dépôt : ${formatCurrency(amount)} - ${userName || email}`;
  const previewText = `${userName || email} demande un dépôt de ${formatCurrency(amount)}`;

  const content = `
    ${StatusBadge('info', 'Nouveau Dépôt')}
    <h2>Nouvelle Demande de Dépôt</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Un utilisateur a soumis une nouvelle demande de dépôt nécessitant votre validation.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">👤 Informations Utilisateur</h3>
      <table class="info-table">
        <tr><td>Nom :</td><td><strong>${escapeHtml(userName || 'N/A')}</strong></td></tr>
        <tr><td>Email :</td><td>${escapeHtml(email)}</td></tr>
      </table>
      
      <h3>💰 Détails de la Transaction</h3>
      <table class="info-table">
        <tr><td>Montant :</td><td class="amount-highlight"><strong>${formatCurrency(amount)}</strong></td></tr>
        <tr><td>Méthode :</td><td>${escapeHtml(paymentMethod || 'Non spécifiée')}</td></tr>
        <tr><td>Réf. Transaction :</td><td><code>${escapeHtml(transactionId || 'N/A')}</code></td></tr>
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
        <tr><td>Preuve :</td><td>${proofUrl ? '✅ <strong>Uploadée</strong>' : '❌ Absente'}</td></tr>
      </table>
    `)}
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/deposits${transactionId ? `?id=${transactionId}` : ''}" class="btn btn-primary">Traiter la demande</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Nouveau dépôt de ${formatCurrency(amount)} par ${userName || email}. Ref: ${transactionId}`,
    html
  };
};

const renderNewWithdrawalRequest = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, escapeHtml, formatDate, siteUrl } = helpers;
  const { amount, email, userName, transactionId, withdrawalMethod, recipientName } = params;

  const subject = `[ADMIN] Nouveau Retrait : ${formatCurrency(amount)} - ${userName || email}`;
  const previewText = `${userName || email} demande un retrait de ${formatCurrency(amount)}`;

  const content = `
    ${StatusBadge('warning', 'Nouveau Retrait')}
    <h2>Nouvelle Demande de Retrait</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Un utilisateur a soumis une nouvelle demande de retrait nécessitant validation et upload de preuve de transfert.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">👤 Informations Utilisateur</h3>
      <table class="info-table">
        <tr><td>Nom :</td><td><strong>${escapeHtml(userName || 'N/A')}</strong></td></tr>
        <tr><td>Email :</td><td>${escapeHtml(email)}</td></tr>
      </table>
      
      <h3>💸 Détails du Retrait</h3>
      <table class="info-table">
        <tr><td>Montant :</td><td class="amount-highlight"><strong>${formatCurrency(amount)}</strong></td></tr>
        <tr><td>Méthode :</td><td>${escapeHtml(withdrawalMethod || 'Non spécifiée')}</td></tr>
        <tr><td>Bénéficiaire :</td><td>${escapeHtml(recipientName || 'Non spécifié')}</td></tr>
        <tr><td>Réf. Transaction :</td><td><code>${escapeHtml(transactionId || 'N/A')}</code></td></tr>
        <tr><td>Date :</td><td>${formatDate()}</td></tr>
      </table>
    `, 'warning')}
    
    <p style="font-size: 14px; color: #EF4444; font-weight: 600;">
      ⚠️ Rappel : Upload de la preuve de transfert obligatoire lors de l'approbation
    </p>
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/withdrawals${transactionId ? `?id=${transactionId}` : ''}" class="btn btn-primary">Traiter la demande</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Nouveau retrait de ${formatCurrency(amount)} par ${userName || email}. PREUVE REQUISE. Ref: ${transactionId}`,
    html
  };
};

const renderAccountSuspended = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, reason, date } = params;

  const subject = `Alerte : Votre compte a été suspendu`;
  const previewText = `L'accès à votre compte Nguma a été temporairement restreint.`;

  const content = `
    ${StatusBadge('error', 'Compte Suspendu')}
    <h2>Votre accès a été restreint</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Pour des raisons de sécurité et/ou de conformité, l'accès à votre compte a été temporairement suspendu par nos administrateurs.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Statut du compte :</td><td><strong>Suspendu</strong></td></tr>
        <tr><td>Raison :</td><td>${escapeHtml(reason || 'Vérification de sécurité requise')}</td></tr>
        <tr><td>Date :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'error')}
    <p>Vous ne pourrez pas vous connecter ni accéder aux fonctionnalités de la plateforme pendant cette période. Veuillez contacter le support pour plus d'informations.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre compte a été suspendu. Raison : ${reason}.`,
    html
  };
};

const renderAccountReactivated = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, date } = params;

  const subject = `Information : Votre compte a été réactivé`;
  const previewText = `L'accès à votre compte Nguma a été restauré.`;

  const content = `
    ${StatusBadge('success', 'Compte Réactivé')}
    <h2>Accès restauré</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Bonne nouvelle ! Votre compte a été révisé par notre équipe et est de nouveau pleinement fonctionnel.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Statut du compte :</td><td><strong>Actif</strong></td></tr>
        <tr><td>Date :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'success')}
    <p>Toutes les restrictions ont été levées. Vous pouvez vous connecter et utiliser la plateforme normalement.</p>
    <div class="cta-buttons">
      <a href="${siteUrl}/dashboard" class="btn btn-primary">Accéder à mon compte</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre compte est de nouveau pleinement fonctionnel.`,
    html
  };
};


export const adminManualCreditTemplate: EmailTemplate = {
  id: 'admin_manual_credit',
  category: 'admin',
  requiredFields: ['to', 'name', 'amount', 'reason'],
  render: renderAdminManualCredit
};

export const adminManualDebitTemplate: EmailTemplate = {
  id: 'admin_manual_debit',
  category: 'admin',
  requiredFields: ['to', 'name', 'amount', 'reason'],
  render: renderAdminManualDebit
};

export const newDepositRequestTemplate: EmailTemplate = {
  id: 'new_deposit_request',
  category: 'admin',
  requiredFields: ['to', 'amount', 'email', 'userName', 'transactionId', 'paymentMethod'],
  render: renderNewDepositRequest
};

export const newWithdrawalRequestTemplate: EmailTemplate = {
  id: 'new_withdrawal_request',
  category: 'admin',
  requiredFields: ['to', 'amount', 'email', 'userName', 'transactionId', 'withdrawalMethod', 'recipientName'],
  render: renderNewWithdrawalRequest
};

export const accountSuspendedTemplate: EmailTemplate = {
  id: 'account_suspended',
  category: 'admin',
  requiredFields: ['to', 'name', 'reason'],
  render: renderAccountSuspended
};

export const accountReactivatedTemplate: EmailTemplate = {
  id: 'account_reactivated',
  category: 'admin',
  requiredFields: ['to', 'name'],
  render: renderAccountReactivated
};
