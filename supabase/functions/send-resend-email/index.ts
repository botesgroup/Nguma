import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

// Get secrets from environment variables
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN");
const SITE_URL = Deno.env.get("SITE_URL") || "https://nguma.org";

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY!);

// Helper: Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount);
};

// --- Enhanced Email Templates with Rich Content and CTAs ---
const templates = {
  // ✅ FOR USER: Deposit Approved
  deposit_approved: (params: any) => ({
    subject: `✅ Votre dépôt de ${formatCurrency(params.amount)} a été approuvé !`,
    body: `
      <div class="status-badge success">
        <span class="icon">✓</span> Dépôt Approuvé
      </div>
      
      <h2>Félicitations ${params.name} !</h2>
      
      <p class="lead">Bonne nouvelle ! Votre dépôt a été approuvé avec succès et les fonds sont maintenant disponibles sur votre compte Nguma.</p>
      
      <div class="info-card">
        <h3>📊 Détails de la transaction</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant crédité :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-success">Approuvé</span></td>
          </tr>
          <tr>
            <td><strong>Date :</strong></td>
            <td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      
      <div class="highlight-box">
        <p><strong>💡 Prochaine étape :</strong> Vos fonds sont prêts à être investis ! Créez votre premier contrat d'investissement pour commencer à générer des profits mensuels.</p>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Voir Mon Solde</a>
        <a href="${SITE_URL}/dashboard" class="btn btn-secondary">Créer un Investissement</a>
      </div>
    `,
  }),

  // ❌ FOR USER: Deposit Rejected
  deposit_rejected: (params: any) => ({
    subject: `❌ Votre dépôt de ${formatCurrency(params.amount)} n'a pas pu être validé`,
    body: `
      <div class="status-badge error">
        <span class="icon">✖</span> Dépôt Non Validé
      </div>
      
      <h2>Bonjour ${params.name},</h2>
      
      <p class="lead">Nous avons examiné votre demande de dépôt, mais malheureusement nous ne pouvons pas la valider pour le moment.</p>
      
      <div class="info-card error-card">
        <h3>📋 Informations sur le dépôt</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant :</strong></td>
            <td>${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-error">Rejeté</span></td>
          </tr>
          <tr>
            <td><strong>Raison :</strong></td>
            <td class="rejection-reason">${params.reason || "Informations de paiement invalides ou incomplètes"}</td>
          </tr>
        </table>
      </div>
      
      <div class="highlight-box warning">
        <p><strong>🔧 Comment corriger cela ?</strong></p>
        <ul>
          <li>Vérifiez que la preuve de paiement est claire et lisible</li>
          <li>Assurez-vous que le montant correspond exactement</li>
          <li>Utilisez le bon numéro de référence pour le transfert</li>
        </ul>
      </div>
      
      <p><strong>Besoin d'aide ?</strong> Notre équipe support est là pour vous assister. Contactez-nous pour toute question.</p>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/support" class="btn btn-primary">Contacter le Support</a>
        <a href="${SITE_URL}/wallet" class="btn btn-secondary">Réessayer un Dépôt</a>
      </div>
    `,
  }),

  // 🔔 FOR ADMIN: New Deposit Request
  new_deposit_request: (params: any) => ({
    subject: `🔔 Nouvelle demande de dépôt - ${formatCurrency(params.amount)}`,
    body: `
      <div class="status-badge info">
        <span class="icon">🔔</span> Nouvelle Demande
      </div>
      
      <h2>Nouveau Dépôt à Traiter</h2>
      
      <p class="lead">Un utilisateur a soumis une nouvelle demande de dépôt qui nécessite votre validation.</p>
      
      <div class="info-card">
        <h3>👤 Informations Utilisateur</h3>
        <table class="info-table">
          <tr>
            <td><strong>Nom :</strong></td>
            <td>${params.name}</td>
          </tr>
          <tr>
            <td><strong>Email :</strong></td>
            <td>${params.email}</td>
          </tr>
          <tr>
            <td><strong>Montant :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Date de soumission :</strong></td>
            <td>${new Date().toLocaleString('fr-FR')}</td>
          </tr>
        </table>
      </div>
      
      <div class="highlight-box">
        <p><strong>⚡ Action requise :</strong> Veuillez vérifier la preuve de paiement et valider ou rejeter cette demande dans le panneau d'administration.</p>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/admin/deposits" class="btn btn-primary">Voir les Détails</a>
        <a href="${SITE_URL}/admin" class="btn btn-secondary">Panneau Admin</a>
      </div>
    `,
  }),

  // ✅ FOR USER: Withdrawal Approved
  withdrawal_approved: (params: any) => ({
    subject: `✅ Votre retrait de ${formatCurrency(params.amount)} est approuvé`,
    body: `
      <div class="status-badge success">
        <span class="icon">✓</span> Retrait Approuvé
      </div>
      
      <h2>Excellent ${params.name} !</h2>
      
      <p class="lead">Votre demande de retrait a été approuvée et est maintenant en cours de traitement.</p>
      
      <div class="info-card">
        <h3>💸 Détails du Retrait</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-success">Approuvé</span></td>
          </tr>
          <tr>
            <td><strong>Délai estimé :</strong></td>
            <td>24-48 heures ouvrées</td>
          </tr>
        </table>
      </div>
      
      <div class="timeline">
        <div class="timeline-item completed">
          <span class="timeline-icon">✓</span>
          <div>
            <strong>Demande soumise</strong>
            <p>Votre demande a été reçue</p>
          </div>
        </div>
        <div class="timeline-item completed">
          <span class="timeline-icon">✓</span>
          <div>
            <strong>Validation effectuée</strong>
            <p>Votre retrait est approuvé</p>
          </div>
        </div>
        <div class="timeline-item active">
          <span class="timeline-icon">⏳</span>
          <div>
            <strong>Traitement en cours</strong>
            <p>Le paiement est en cours d'envoi</p>
          </div>
        </div>
        <div class="timeline-item">
          <span class="timeline-icon">○</span>
          <div>
            <strong>Paiement reçu</strong>
            <p>Vous recevrez une confirmation</p>
          </div>
        </div>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Mon Retrait</a>
        <a href="${SITE_URL}/transactions" class="btn btn-secondary">Historique</a>
      </div>
    `,
  }),

  // ❌ FOR USER: Withdrawal Rejected
  withdrawal_rejected: (params: any) => ({
    subject: `❌ Votre retrait de ${formatCurrency(params.amount)} n'a pas été validé`,
    body: `
      <div class="status-badge error">
        <span class="icon">✖</span> Retrait Non Validé
      </div>
      
      <h2>Bonjour ${params.name},</h2>
      
      <p class="lead">Nous avons examiné votre demande de retrait, mais nous ne pouvons pas la traiter pour le moment.</p>
      
      <div class="info-card error-card">
        <h3>📋 Informations sur le retrait</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant demandé :</strong></td>
            <td>${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-error">Rejeté</span></td>
          </tr>
          <tr>
            <td><strong>Raison :</strong></td>
            <td class="rejection-reason">${params.reason || "Informations de paiement manquantes ou incorrectes"}</td>
          </tr>
        </table>
      </div>
      
      <div class="highlight-box success">
        <p><strong>✓ Votre solde est intact</strong><br>
        Rassurez-vous, aucun montant n'a été débité de votre compte. Votre solde reste inchangé.</p>
      </div>
      
      <div class="highlight-box warning">
        <p><strong>💡 Solutions :</strong></p>
        <ul>
          <li>Vérifiez vos informations de paiement</li>
          <li>Assurez-vous que votre solde est suffisant</li>
          <li>Contactez notre support pour assistance</li>
        </ul>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Voir Mon Solde</a>
        <a href="${SITE_URL}/support" class="btn btn-secondary">Contacter le Support</a>
      </div>
    `,
  }),

  // 🔔 FOR ADMIN: New Withdrawal Request
  new_withdrawal_request: (params: any) => ({
    subject: `🔔 Nouvelle demande de retrait - ${formatCurrency(params.amount)}`,
    body: `
      <div class="status-badge info">
        <span class="icon">🔔</span> Nouvelle Demande
      </div>
      
      <h2>Nouveau Retrait à Traiter</h2>
      
      <p class="lead">Un utilisateur a soumis une demande de retrait qui nécessite votre validation.</p>
      
      <div class="info-card">
        <h3>👤 Informations Utilisateur</h3>
        <table class="info-table">
          <tr>
            <td><strong>Nom :</strong></td>
            <td>${params.name}</td>
          </tr>
          <tr>
            <td><strong>Email :</strong></td>
            <td>${params.email}</td>
          </tr>
          <tr>
            <td><strong>Montant demandé :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Date de soumission :</strong></td>
            <td>${new Date().toLocaleString('fr-FR')}</td>
          </tr>
        </table>
      </div>
      
      <div class="highlight-box">
        <p><strong>⚡ Action requise :</strong> Vérifiez le solde de l'utilisateur et les informations de paiement avant de valider ce retrait.</p>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/admin/withdrawals" class="btn btn-primary">Voir les Détails</a>
        <a href="${SITE_URL}/admin" class="btn btn-secondary">Panneau Admin</a>
      </div>
    `,
  }),

  // 📈 FOR USER: Monthly Profit
  monthly_profit: (params: any) => ({
    subject: `📈 Votre profit mensuel de ${formatCurrency(params.amount)} est disponible !`,
    body: `
      <div class="status-badge success">
        <span class="icon">🎉</span> Profit Versé
      </div>
      
      <h2>Félicitations ${params.name} !</h2>
      
      <p class="lead">Votre profit mensuel vient d'être versé sur votre compte. Votre investissement continue de générer des revenus !</p>
      
      <div class="info-card success-card">
        <h3>💰 Paiement de Profit</h3>
        <table class="info-table">
          <tr>
            <td><strong>Profit versé :</strong></td>
            <td class="amount-success profit-amount">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Type de paiement :</strong></td>
            <td>Profit mensuel</td>
          </tr>
          <tr>
            <td><strong>Date :</strong></td>
            <td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-icon">📊</div>
          <div class="stat-label">Performance</div>
          <div class="stat-value">Excellent</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon">⏱️</div>
          <div class="stat-label">Prochain paiement</div>
          <div class="stat-value">Dans 30 jours</div>
        </div>
      </div>
      
      <div class="highlight-box">
        <p><strong>💡 Maximisez vos revenus :</strong> Réinvestissez vos profits pour bénéficier de l'effet des intérêts composés et augmenter vos gains mensuels !</p>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Voir Mes Profits</a>
        <a href="${SITE_URL}/dashboard" class="btn btn-secondary">Réinvestir</a>
      </div>
    `,
  }),

  // 🎉 FOR USER: New Investment
  new_investment: (params: any) => ({
    subject: `🎉 Votre investissement de ${formatCurrency(params.amount)} est créé !`,
    body: `
      <div class="status-badge success">
        <span class="icon">🎉</span> Investissement Actif
      </div>
      
      <h2>Félicitations ${params.name} !</h2>
      
      <p class="lead">Vous avez franchi une étape importante ! Votre contrat d'investissement est maintenant actif et va commencer à générer des profits mensuels.</p>
      
      <div class="info-card success-card">
        <h3>📄 Récapitulatif de votre contrat</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant investi :</strong></td>
            <td class="amount-success">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Durée du contrat :</strong></td>
            <td>12 mois</td>
          </tr>
          <tr>
            <td><strong>Taux mensuel :</strong></td>
            <td>15%</td>
          </tr>
          <tr>
            <td><strong>Profit mensuel estimé :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount * 0.15)}</td>
          </tr>
        </table>
      </div>
      
      <div class="timeline-simple">
        <div class="timeline-item-simple">
          <span class="timeline-number">1</span>
          <div>
            <strong>Dans 30 jours</strong>
            <p>Premier paiement de profit</p>
          </div>
        </div>
        <div class="timeline-item-simple">
          <span class="timeline-number">12</span>
          <div>
            <strong>À maturité</strong>
            <p>Capital + tous les profits versés</p>
          </div>
        </div>
      </div>
      
      <div class="highlight-box success">
        <p><strong>🚀 Votre investissement travaille pour vous !</strong><br>
        Vous n'avez rien à faire, vos profits seront automatiquement versés chaque mois.</p>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/dashboard" class="btn btn-primary">Voir Mon Contrat</a>
        <a href="${SITE_URL}/wallet" class="btn btn-secondary">Tableau de Bord</a>
      </div>
    `,
  }),
};

// Enhanced HTML template generator with modern design
function generateEmailHtml(bodyContent: string) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nguma</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1F2937;
          background-color: #F3F4F6;
        }
        
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background-color: #FFFFFF;
        }
        
        .email-header {
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          padding: 40px 30px;
          text-align: center;
        }
        
        .logo {
          font-size: 32px;
          font-weight: 700;
          color: #FFFFFF;
          letter-spacing: 1px;
        }
        
        .email-body {
          padding: 40px 30px;
        }
        
        h2 {
          font-size: 24px;
          font-weight: 700;
          color: #1F2937;
          margin-bottom: 16px;
        }
        
        h3 {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }
        
        .lead {
          font-size: 16px;
          color: #4B5563;
          margin-bottom: 24px;
          line-height: 1.7;
        }
        
        p {
          margin-bottom: 16px;
          color: #4B5563;
        }
        
        .status-badge {
          display: inline-block;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          margin-bottom: 24px;
          font-size: 14px;
        }
        
        .status-badge.success {
          background-color: #ECFDF5;
          color: #059669;
          border: 1px solid #10B981;
        }
        
        .status-badge.error {
          background-color: #FEF2F2;
          color: #DC2626;
          border: 1px solid #EF4444;
        }
        
        .status-badge.info {
          background-color: #EFF6FF;
          color: #2563EB;
          border: 1px solid #3B82F6;
        }
        
        .status-badge .icon {
          font-size: 18px;
          margin-right: 8px;
        }
        
        .info-card {
          background-color: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        
        .info-card.success-card {
          background-color: #ECFDF5;
          border-color: #A7F3D0;
        }
        
        .info-card.error-card {
          background-color: #FEF2F2;
          border-color: #FECACA;
        }
        
        .info-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .info-table tr {
          border-bottom: 1px solid #E5E7EB;
        }
        
        .info-table tr:last-child {
          border-bottom: none;
        }
        
        .info-table td {
          padding: 12px 0;
        }
        
        .info-table td:first-child {
          color: #6B7280;
          width: 50%;
        }
        
        .info-table td:last-child {
          text-align: right;
          font-weight: 500;
        }
        
        .amount-success {
          color: #059669;
          font-size: 20px;
          font-weight: 700;
        }
        
        .amount-highlight {
          color: #7C3AED;
          font-size: 18px;
          font-weight: 700;
        }
        
        .profit-amount {
          font-size: 24px !important;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .badge-success {
          background-color: #D1FAE5;
          color: #065F46;
        }
        
        .badge-error {
          background-color: #FEE2E2;
          color: #991B1B;
        }
        
        .highlight-box {
          background-color: #EFF6FF;
          border-left: 4px solid #3B82F6;
          padding: 16px 20px;
          margin-bottom: 24px;
          border-radius: 4px;
        }
        
        .highlight-box.success {
          background-color: #ECFDF5;
          border-left-color: #10B981;
        }
        
        .highlight-box.warning {
          background-color: #FFFBEB;
          border-left-color: #F59E0B;
        }
        
        .highlight-box p {
          margin-bottom: 8px;
        }
        
        .highlight-box ul {
          margin-left: 20px;
          margin-top: 8px;
        }
        
        .highlight-box li {
          margin-bottom: 4px;
          color: #4B5563;
        }
        
        .rejection-reason {
          color: #DC2626;
          font-weight: 600;
        }
        
        .timeline {
          margin: 24px 0;
        }
        
        .timeline-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .timeline-item.completed,
        .timeline-item.active {
          opacity: 1;
        }
        
        .timeline-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #E5E7EB;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          flex-shrink: 0;
          font-size: 16px;
        }
        
        .timeline-item.completed .timeline-icon {
          background-color: #10B981;
          color: #FFFFFF;
        }
        
        .timeline-item.active .timeline-icon {
          background-color: #3B82F6;
          color: #FFFFFF;
        }
        
        .timeline-item strong {
          display: block;
          color: #1F2937;
          margin-bottom: 4px;
        }
        
        .timeline-item p {
          color: #6B7280;
          font-size: 14px;
          margin: 0;
        }
        
        .timeline-simple {
          display: flex;
          justify-content: space-around;
          margin: 24px 0;
        }
        
        .timeline-item-simple {
          text-align: center;
          flex: 1;
        }
        
        .timeline-number {
          display: inline-block;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          color: #FFFFFF;
          font-size: 18px;
          font-weight: 700;
          line-height: 40px;
          margin-bottom: 12px;
        }
        
        .timeline-item-simple strong {
          display: block;
          color: #1F2937;
          margin-bottom: 4px;
        }
        
        .timeline-item-simple p {
          color: #6B7280;
          font-size: 14px;
          margin: 0;
        }
        
        .stats-grid {
          display: flex;
          gap: 16px;
          margin: 24px 0;
        }
        
        .stat-box {
          flex: 1;
          background-color: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        
        .stat-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }
        
        .stat-label {
          font-size: 12px;
          color: #6B7280;
          margin-bottom: 4px;
        }
        
        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #1F2937;
        }
        
        .cta-buttons {
          text-align: center;
          margin: 32px 0;
        }
        
        .btn {
          display: inline-block;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 8px;
          transition: all 0.3s ease;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          color: #FFFFFF !important;
          box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);
        }
        
        .btn-secondary {
          background-color: #FFFFFF;
          color: #667EEA !important;
          border: 2px solid #667EEA;
        }
        
        .email-footer {
          background-color: #F9FAFB;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        }
        
        .footer-links {
          margin-bottom: 20px;
        }
        
        .footer-links a {
          color: #667EEA;
          text-decoration: none;
          margin: 0 12px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .footer-text {
          font-size: 13px;
          color: #6B7280;
          margin-bottom: 8px;
        }
        
        .footer-copyright {
          font-size: 12px;
          color: #9CA3AF;
        }
        
        @media only screen and (max-width: 600px) {
          .email-header { padding: 30px 20px; }
          .email-body { padding: 30px 20px; }
          .email-footer { padding: 20px; }
          h2 { font-size: 20px; }
          .btn { display: block; margin: 8px 0; }
          .stats-grid { flex-direction: column; }
          .timeline-simple { flex-direction: column; gap: 16px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-header">
          <div class="logo">NGUMA</div>
        </div>
        
        <div class="email-body">
          ${bodyContent}
        </div>
        
        <div class="email-footer">
          <div class="footer-links">
            <a href="${SITE_URL}/dashboard">Tableau de bord</a>
            <a href="${SITE_URL}/wallet">Portefeuille</a>
            <a href="${SITE_URL}/support">Support</a>
          </div>
          <p class="footer-text">
            <strong>Nguma</strong> - Votre plateforme d'investissement de confiance<br>
            Vous recevez cet e-mail car vous avez un compte actif sur Nguma.
          </p>
          <p class="footer-copyright">© ${new Date().getFullYear()} Nguma. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_DOMAIN) {
    const errorMessage = "RESEND_API_KEY or RESEND_FROM_DOMAIN environment variable is not set.";
    console.error(errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const payload = await req.json();
    const { template_id, ...params } = payload;

    const templateGenerator = templates[template_id];
    if (!templateGenerator) {
      throw new Error(`Template with id '${template_id}' not found.`);
    }

    const { subject, body } = templateGenerator(params);
    const html = generateEmailHtml(body);
    const fromAddress = `Nguma <notification@${RESEND_FROM_DOMAIN}>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [params.to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error({ error });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});