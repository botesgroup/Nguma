import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderProfitTransferConfirmed = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, siteUrl } = helpers;
    const { name, amount } = params;

    const subject = `Confirmation : Vote transfert de profits`;
    const previewText = `Votre transfert de ${formatCurrency(amount)} vers votre capital déposable a été effectué avec succès.`;

    const content = `
    ${StatusBadge('success', 'Transfert Réussi')}
    <h2>Capitalisation de profits</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Nous confirmons que vous avez transféré avec succès une partie de vos profits vers votre solde de dépôt principal.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Montant transféré :</td><td class="amount-success"><strong>${formatCurrency(amount)}</strong></td></tr>
        <tr><td>Type d'opération :</td><td>Capitalisation (Profit vers Dépôt)</td></tr>
        <tr><td>Date :</td><td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
      </table>
    `, 'success')}
    <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
      Ce montant est désormais disponible pour activer de nouveaux contrats d'investissement ou pour vos opérations courantes.
    </p>
    <div class="cta-buttons">
      <a href="${siteUrl}/wallet" class="btn btn-primary">Voir mon solde</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Bonjour ${name}, votre transfert de ${formatCurrency(amount)} a été effectué avec succès.`,
        html
    };
};

const renderNewProfitTransferAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { formatCurrency, escapeHtml, siteUrl } = helpers;
    const { amount, email, userName, userId } = params;

    const subject = `[ADMIN] Transfert de Profits (Capitalisation) - ${userName || email}`;
    const previewText = `${userName || email} a capitalisé ${formatCurrency(amount)} de profits.`;

    const content = `
    ${StatusBadge('info', 'Nouvelle Capitalisation')}
    <h2>Transfert de Profits vers Capital</h2>
    <p style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Un utilisateur a effectué un transfert interne de son solde de profit vers son solde déposable.
    </p>
    
    ${InfoCard(`
      <h3 style="margin-top:0;">👤 Informations Utilisateur</h3>
      <table class="info-table">
        <tr><td>Nom :</td><td><strong>${escapeHtml(userName || 'N/A')}</strong></td></tr>
        <tr><td>Email :</td><td>${escapeHtml(email)}</td></tr>
        <tr><td>ID Utilisateur :</td><td><code>${escapeHtml(userId || 'N/A')}</code></td></tr>
      </table>
      
      <h3>💰 Détails du Transfert</h3>
      <table class="info-table">
        <tr><td>Montant transféré :</td><td class="amount-highlight"><strong>${formatCurrency(amount)}</strong></td></tr>
        <tr><td>Type :</td><td>Profit -> Dépôt (Total Balance)</td></tr>
        <tr><td>Date :</td><td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
      </table>
    `)}
    
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/users" class="btn btn-primary">Gérer les utilisateurs</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `L'utilisateur ${userName || email} a transféré ${formatCurrency(amount)} de profits vers son capital.`,
        html
    };
};

export const profitTransferConfirmedTemplate: EmailTemplate = {
    id: 'profit_transfer_confirmed',
    category: 'transaction',
    requiredFields: ['to', 'name', 'amount'],
    render: renderProfitTransferConfirmed
};

export const newProfitTransferAdminTemplate: EmailTemplate = {
    id: 'new_profit_transfer_admin',
    category: 'admin',
    requiredFields: ['to', 'amount', 'email', 'userName'],
    render: renderNewProfitTransferAdmin
};
