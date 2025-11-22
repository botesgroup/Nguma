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

// Helper: Escape HTML to prevent XSS injection
const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- Email Templates ---
const templates = {
  // ✅ FOR USER: Deposit Approved
  deposit_approved: (params: any) => ({
    subject: `Votre dépôt de ${formatCurrency(params.amount)} a été approuvé`,
    text: `Bonjour ${params.name},\n\nBonne nouvelle ! Votre dépôt de ${formatCurrency(params.amount)} a été approuvé avec succès.\n\nDÉTAILS DE LA TRANSACTION\nMontant crédité : ${formatCurrency(params.amount)}\nStatus : Approuvé\nDate : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nPROCHAINE ÉTAPE\nVos fonds sont prêts à être investis ! Créez votre premier contrat d'investissement pour commencer à générer des profits mensuels.\n\nACCÉDER À VOTRE COMPTE\nVoir mon solde : ${SITE_URL}/wallet\nCréer un investissement : ${SITE_URL}/dashboard\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge success">
        <span class="icon">✓</span> Dépôt Approuvé
      </div>
      
      <h2>Félicitations ${escapeHtml(params.name)} !</h2>
      
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
    subject: `Mise à jour concernant votre dépôt de ${formatCurrency(params.amount)}`,
    text: `Bonjour ${params.name},\n\nNous avons examiné votre demande de dépôt de ${formatCurrency(params.amount)}, mais malheureusement nous ne pouvons pas la valider pour le moment.\n\nINFORMATIONS SUR LE DÉPÔT\nMontant : ${formatCurrency(params.amount)}\nStatus : Rejeté\nRaison : ${params.reason || "Informations de paiement invalides ou incomplètes"}\n\nCOMMENT CORRIGER CELA\n- Vérifiez que la preuve de paiement est claire et lisible\n- Assurez-vous que le montant correspond exactement\n- Utilisez le bon numéro de référence pour le transfert\n\nBESOIN D'AIDE\nNotre équipe support est là pour vous assister.\nContacter le support : ${SITE_URL}/support\nRéessayer un dépôt : ${SITE_URL}/wallet\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge error">
        <span class="icon">✖</span> Dépôt Non Validé
      </div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
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
            <td class="rejection-reason">${escapeHtml(params.reason || "Informations de paiement invalides ou incomplètes")}</td>
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

  // ⏳ FOR USER: Deposit Pending
  deposit_pending: (params: any) => ({
    subject: `Votre demande de dépôt de ${formatCurrency(params.amount)} est en cours de traitement`,
    text: `Bonjour ${params.name},\n\nNous avons bien reçu votre demande de dépôt.\n\nDÉTAILS DE VOTRE DEMANDE\nMontant : ${formatCurrency(params.amount)}\nStatus : En attente de validation\nDate de soumission : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nPROCHAINES ÉTAPES\n1. Notre équipe vérifie votre preuve de paiement\n2. Validation sous 24-48 heures ouvrées\n3. Vous recevrez un email de confirmation une fois approuvé\n\nDÉLAI DE TRAITEMENT\nNos équipes traitent les demandes du lundi au vendredi, de 9h à 18h (GMT+1). Les demandes soumises le week-end seront traitées le lundi suivant.\n\nBESOIN D'AIDE ?\nSi vous avez des questions concernant votre dépôt, notre équipe support est disponible pour vous aider.\n\nSUIVRE VOTRE DEMANDE\nPortefeuille : ${SITE_URL}/wallet\nSupport : ${SITE_URL}/support\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge info">
        <span class="icon">⏳</span> Demande en Cours
      </div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Nous avons bien reçu votre demande de dépôt. Notre équipe va la vérifier dans les plus brefs délais.</p>
      
      <div class="info-card">
        <h3>📋 Détails de votre demande</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-info">En attente de validation</span></td>
          </tr>
          <tr>
            <td><strong>Date de soumission :</strong></td>
            <td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
          <tr>
            <td><strong>Délai estimé :</strong></td>
            <td>24-48 heures ouvrées</td>
          </tr>
        </table>
      </div>
      
      <div class="timeline-simple">
        <div class="timeline-item-simple">
          <span class="timeline-number">✓</span>
          <div>
            <strong>Demande soumise</strong>
            <p>Votre demande a été enregistrée</p>
          </div>
        </div>
        <div class="timeline-item-simple">
          <span class="timeline-number">⏳</span>
          <div>
            <strong>Vérification en cours</strong>
            <p>Notre équipe vérifie votre paiement</p>
          </div>
        </div>
        <div class="timeline-item-simple">
          <span class="timeline-number">○</span>
          <div>
            <strong>Validation</strong>
            <p>Vous recevrez un email de confirmation</p>
          </div>
        </div>
      </div>
      
      <div class="highlight-box">
        <p><strong>⏱️ Délai de traitement :</strong> Nos équipes traitent les demandes du lundi au vendredi, de 9h à 18h (GMT+1). Les demandes soumises le week-end seront traitées le lundi suivant.</p>
      </div>
      
      <p><strong>Que se passe-t-il maintenant ?</strong></p>
      <ul>
        <li>Notre équipe vérifie votre preuve de paiement</li>
        <li>Nous validons la correspondance du montant</li>
        <li>Vous recevrez un email dès que votre dépôt sera approuvé</li>
      </ul>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Ma Demande</a>
        <a href="${SITE_URL}/support" class="btn btn-secondary">Contacter le Support</a>
      </div>
    `,
  }),

  // 🔔 FOR ADMIN: New Deposit Request
  new_deposit_request: (params: any) => ({
    subject: `Nouvelle demande de dépôt - ${formatCurrency(params.amount)}`,
    text: `NOUVELLE DEMANDE DE DÉPÔT À TRAITER\n\nINFORMATIONS UTILISATEUR\nNom : ${params.name}\nEmail : ${params.email}\nMontant : ${formatCurrency(params.amount)}\nDate de soumission : ${new Date().toLocaleString('fr-FR')}\n\nACTION REQUISE\nVeuillez vérifier la preuve de paiement et valider ou rejeter cette demande dans le panneau d'administration.\n\nACCÉDER AU PANNEAU ADMIN\nVoir les détails : ${SITE_URL}/admin/deposits\nPanneau admin : ${SITE_URL}/admin\n\n---\nNguma - Panneau d'Administration\nCet e-mail est destiné aux administrateurs uniquement.`,
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
            <td>${escapeHtml(params.name)}</td>
          </tr>
          <tr>
            <td><strong>Email :</strong></td>
            <td>${escapeHtml(params.email)}</td>
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
    subject: `Confirmation de votre retrait de ${formatCurrency(params.amount)}`,
    text: `Bonjour ${params.name},\n\nVotre demande de retrait de ${formatCurrency(params.amount)} a été approuvée.\n\nDÉTAILS DU RETRAIT\nMontant : ${formatCurrency(params.amount)}\nStatus : Approuvé\nDélai estimé : 24-48 heures ouvrées\n\nÉTAPES DU TRAITEMENT\n✓ Demande soumise - Votre demande a été reçue\n✓ Validation effectuée - Votre retrait est approuvé\n⏳ Traitement en cours - Le paiement est en cours d'envoi\n○ Paiement reçu - Vous recevrez une confirmation\n\nSUIVRE VOTRE RETRAIT\nPortefeuille : ${SITE_URL}/wallet\nHistorique : ${SITE_URL}/transactions\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge success">
        <span class="icon">✓</span> Retrait Approuvé
      </div>
      
      <h2>Excellent ${escapeHtml(params.name)} !</h2>
      
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
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Mon Retrait</a>
        <a href="${SITE_URL}/transactions" class="btn btn-secondary">Historique</a>
      </div>
    `,
  }),

  // ❌ FOR USER: Withdrawal Rejected
  withdrawal_rejected: (params: any) => ({
    subject: `Mise à jour concernant votre retrait de ${formatCurrency(params.amount)}`,
    text: `Bonjour ${params.name},\n\nNous avons examiné votre demande de retrait, mais nous ne pouvons pas la traiter pour le moment.\n\nINFORMATIONS SUR LE RETRAIT\nMontant demandé : ${formatCurrency(params.amount)}\nStatus : Rejeté\nRaison : ${params.reason || "Informations de paiement manquantes ou incorrectes"}\n\nVOTRE SOLDE EST INTACT\nRassurez-vous, aucun montant n'a été débité de votre compte. Votre solde reste inchangé.\n\nSOLUTIONS\n- Vérifiez vos informations de paiement\n- Assurez-vous que votre solde est suffisant\n- Contactez notre support pour assistance\n\nACCÉDER À VOTRE COMPTE\nVoir mon solde : ${SITE_URL}/wallet\nContacter le support : ${SITE_URL}/support\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge error">
        <span class="icon">✖</span> Retrait Non Validé
      </div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
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
            <td class="rejection-reason">${escapeHtml(params.reason || "Informations de paiement manquantes ou incorrectes")}</td>
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

  // ⏳ FOR USER: Withdrawal Pending
  withdrawal_pending: (params: any) => ({
    subject: `Votre demande de retrait de ${formatCurrency(params.amount)} est en cours de traitement`,
    text: `Bonjour ${params.name},\n\nNous avons bien reçu votre demande de retrait.\n\nDÉTAILS DE VOTRE DEMANDE\nMontant demandé : ${formatCurrency(params.amount)}\nStatus : En attente de validation\nDate de soumission : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nPROCHAINES ÉTAPES\n1. Notre équipe vérifie votre demande\n2. Validation sous 24-48 heures ouvrées\n3. Traitement du paiement après validation\n4. Vous recevrez un email de confirmation\n\nIMPORTANT : VOS FONDS SONT SÉCURISÉS\nLe montant demandé a été temporairement verrouillé sur votre compte pour garantir la disponibilité des fonds. Si votre demande est rejetée, le montant sera immédiatement débloqué.\n\nDÉLAI DE TRAITEMENT\nNos équipes traitent les demandes du lundi au vendredi, de 9h à 18h (GMT+1). Les demandes soumises le week-end seront traitées le lundi suivant.\n\nBESOIN D'AIDE ?\nSi vous avez des questions concernant votre retrait, notre équipe support est disponible pour vous aider.\n\nSUIVRE VOTRE DEMANDE\nPortefeuille : ${SITE_URL}/wallet\nSupport : ${SITE_URL}/support\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge info">
        <span class="icon">⏳</span> Demande en Cours
      </div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Nous avons bien reçu votre demande de retrait. Notre équipe va la traiter dans les plus brefs délais.</p>
      
      <div class="info-card">
        <h3>💸 Détails de votre demande</h3>
        <table class="info-table">
          <tr>
            <td><strong>Montant demandé :</strong></td>
            <td class="amount-highlight">${formatCurrency(params.amount)}</td>
          </tr>
          <tr>
            <td><strong>Status :</strong></td>
            <td><span class="badge badge-info">En attente de validation</span></td>
          </tr>
          <tr>
            <td><strong>Date de soumission :</strong></td>
            <td>${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
          <tr>
            <td><strong>Délai estimé :</strong></td>
            <td>24-48 heures ouvrées</td>
          </tr>
        </table>
      </div>
      
      <div class="highlight-box success">
        <p><strong>🔒 Vos fonds sont sécurisés</strong><br>
        Le montant demandé a été temporairement verrouillé sur votre compte pour garantir la disponibilité des fonds. Si votre demande est rejetée, le montant sera immédiatement débloqué.</p>
      </div>
      
      <div class="highlight-box">
        <p><strong>⏱️ Délai de traitement :</strong> Nos équipes traitent les demandes du lundi au vendredi, de 9h à 18h (GMT+1). Les demandes soumises le week-end seront traitées le lundi suivant.</p>
      </div>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Suivre Mon Retrait</a>
        <a href="${SITE_URL}/support" class="btn btn-secondary">Contacter le Support</a>
      </div>
    `,
  }),

  // 🔔 FOR ADMIN: New Withdrawal Request
  new_withdrawal_request: (params: any) => ({
    subject: `Nouvelle demande de retrait - ${formatCurrency(params.amount)}`,
    text: `NOUVELLE DEMANDE DE RETRAIT À TRAITER\n\nINFORMATIONS UTILISATEUR\nNom : ${params.name}\nEmail : ${params.email}\nMontant demandé : ${formatCurrency(params.amount)}\nDate de soumission : ${new Date().toLocaleString('fr-FR')}\n\nACTION REQUISE\nVérifiez le solde de l'utilisateur et les informations de paiement avant de valider ce retrait.\n\nACCÉDER AU PANNEAU ADMIN\nVoir les détails : ${SITE_URL}/admin/withdrawals\nPanneau admin : ${SITE_URL}/admin\n\n---\nNguma - Panneau d'Administration\nCet e-mail est destiné aux administrateurs uniquement.`,
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
            <td>${escapeHtml(params.name)}</td>
          </tr>
          <tr>
            <td><strong>Email :</strong></td>
            <td>${escapeHtml(params.email)}</td>
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
    subject: `Votre profit mensuel de ${formatCurrency(params.amount)} est disponible`,
    text: `Félicitations ${params.name} !\n\nVotre profit mensuel vient d'être versé sur votre compte. Votre investissement continue de générer des revenus !\n\nPAIEMENT DE PROFIT\nProfit versé : ${formatCurrency(params.amount)}\nType de paiement : Profit mensuel\nDate : ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nPERFORMANCE\nPerformance : Excellent\nProchain paiement : Dans 30 jours\n\nMAXIMISEZ VOS REVENUS\nRéinvestissez vos profits pour bénéficier de l'effet des intérêts composés et augmenter vos gains mensuels !\n\nACCÉDER À VOTRE COMPTE\nVoir mes profits : ${SITE_URL}/wallet\nRéinvestir : ${SITE_URL}/dashboard\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge success">
        <span class="icon">🎉</span> Profit Versé
      </div>
      
      <h2>Félicitations ${escapeHtml(params.name)} !</h2>
      
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
    subject: `Confirmation de votre investissement de ${formatCurrency(params.amount)}`,
    text: `Félicitations ${params.name} !\n\nVous avez franchi une étape importante ! Votre contrat d'investissement est maintenant actif et va commencer à générer des profits mensuels.\n\nRÉCAPITULATIF DE VOTRE CONTRAT\nMontant investi : ${formatCurrency(params.amount)}\nDurée du contrat : 12 mois\nTaux mensuel : 15%\nProfit mensuel estimé : ${formatCurrency(params.amount * 0.15)}\n\nPROCHAINES ÉTAPES\n1. Dans 30 jours - Premier paiement de profit\n2. À maturité (12 mois) - Capital + tous les profits versés\n\nVOTRE INVESTISSEMENT TRAVAILLE POUR VOUS\nVous n'avez rien à faire, vos profits seront automatiquement versés chaque mois.\n\nACCÉDER À VOTRE COMPTE\nVoir mon contrat : ${SITE_URL}/dashboard\nTableau de bord : ${SITE_URL}/wallet\n\nMerci de votre confiance,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge success">
        <span class="icon">🎉</span> Investissement Actif
      </div>
      
      <h2>Félicitations ${escapeHtml(params.name)} !</h2>
      
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

  // 🔐 FOR USER: Withdrawal OTP Code
  withdrawal_otp: (params: any) => ({
    subject: `Code de vérification pour votre retrait de ${formatCurrency(params.amount)}`,
    text: `Bonjour ${params.name},\n\nVous avez demandé un retrait de ${formatCurrency(params.amount)}.\n\nCODE DE VÉRIFICATION\nVotre code OTP : ${params.otp_code}\nValide pendant : 10 minutes\n\nSÉCURITÉ\n⚠️ Ne partagez jamais ce code avec qui que ce soit\n⚠️ Notre équipe ne vous demandera jamais ce code\n⚠️ Si vous n'avez pas demandé ce retrait, contactez-nous immédiatement\n\nACCÉDER À VOTRE COMPTE\nPortefeuille : ${SITE_URL}/wallet\nSupport : ${SITE_URL}/support\n\nCORDIALEMENT,\nL'équipe Nguma\n\n---\nNguma - Votre plateforme d'investissement de confiance\nVous recevez cet e-mail car vous avez un compte actif sur Nguma.\nSe désabonner : ${SITE_URL}/settings/notifications`,
    body: `
      <div class="status-badge info">
        <span class="icon">🔐</span> Code de Vérification
      </div>
      
      <h2>Bonjour ${escapeHtml(params.name)},</h2>
      
      <p class="lead">Vous avez demandé un retrait de <strong>${formatCurrency(params.amount)}</strong>.</p>
      
      <p>Pour confirmer cette opération, veuillez utiliser le code de vérification ci-dessous :</p>
      
      <div style="background: white; border: 2px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
        <p style="margin: 0; font-size: 14px; color: #666; margin-bottom: 12px;">Votre code OTP</p>
        <h1 style="margin: 0; font-size: 48px; color: #667eea; letter-spacing: 12px; font-weight: 700;">${params.otp_code}</h1>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #999;">Valide pendant 10 minutes</p>
      </div>
      
      <div class="highlight-box warning">
        <p><strong>⚠️ Sécurité :</strong></p>
        <ul>
          <li>Ne partagez jamais ce code avec qui que ce soit</li>
          <li>Notre équipe ne vous demandera jamais ce code</li>
          <li>Si vous n'avez pas demandé ce retrait, contactez-nous immédiatement</li>
        </ul>
      </div>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Si vous n'avez pas demandé ce code, veuillez ignorer cet email ou nous contacter.
      </p>
      
      <div class="cta-buttons">
        <a href="${SITE_URL}/wallet" class="btn btn-primary">Accéder à Mon Compte</a>
        <a href="${SITE_URL}/support" class="btn btn-secondary">Contacter le Support</a>
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1F2937; background-color: #F3F4F6; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; }
    .email-header { background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); padding: 40px 30px; text-align: center; }
    .logo { font-size: 32px; font-weight: 700; color: #FFFFFF; letter-spacing: 1px; }
    .email-body { padding: 40px 30px; }
    h2 { font-size: 24px; font-weight: 700; color: #1F2937; margin-bottom: 16px; }
    h3 { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 12px; }
    .lead { font-size: 16px; color: #4B5563; margin-bottom: 24px; line-height: 1.7; }
    p { margin-bottom: 16px; color: #4B5563; }
    .status-badge { display: inline-block; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-bottom: 24px; font-size: 14px; }
    .status-badge.success { background-color: #ECFDF5; color: #059669; border: 1px solid #10B981; }
    .status-badge.error { background-color: #FEF2F2; color: #DC2626; border: 1px solid #EF4444; }
    .status-badge.info { background-color: #EFF6FF; color: #2563EB; border: 1px solid #3B82F6; }
    .status-badge .icon { font-size: 18px; margin-right: 8px; }
    .info-card { background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .info-card.success-card { background-color: #ECFDF5; border-color: #A7F3D0; }
    .info-card.error-card { background-color: #FEF2F2; border-color: #FECACA; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table tr { border-bottom: 1px solid #E5E7EB; }
    .info-table tr:last-child { border-bottom: none; }
    .info-table td { padding: 12px 0; }
    .info-table td:first-child { color: #6B7280; width: 50%; }
    .info-table td:last-child { text-align: right; font-weight: 500; }
    .amount-success { color: #059669; font-size: 20px; font-weight: 700; }
    .amount-highlight { color: #7C3AED; font-size: 18px; font-weight: 700; }
    .profit-amount { font-size: 24px !important; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-success { background-color: #D1FAE5; color: #065F46; }
    .badge-error { background-color: #FEE2E2; color: #991B1B; }
    .badge-info { background-color: #DBEAFE; color: #1E40AF; }
    .highlight-box { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px; }
    .highlight-box.success { background-color: #ECFDF5; border-left-color: #10B981; }
    .highlight-box.warning { background-color: #FFFBEB; border-left-color: #F59E0B; }
    .highlight-box p { margin-bottom: 8px; }
    .highlight-box ul { margin-left: 20px; margin-top: 8px; }
    .highlight-box li { margin-bottom: 4px; color: #4B5563; }
    .rejection-reason { color: #DC2626; font-weight: 600; }
    .timeline-simple { display: flex; justify-content: space-around; margin: 24px 0; }
    .timeline-item-simple { text-align: center; flex: 1; }
    .timeline-number { display: inline-block; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); color: #FFFFFF; font-size: 18px; font-weight: 700; line-height: 40px; margin-bottom: 12px; }
    .timeline-item-simple strong { display: block; color: #1F2937; margin-bottom: 4px; }
    .timeline-item-simple p { color: #6B7280; font-size: 14px; margin: 0; }
    .cta-buttons { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 8px; }
    .btn-primary { background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); color: #FFFFFF !important; }
    .btn-secondary { background-color: #FFFFFF; color: #667EEA !important; border: 2px solid #667EEA; }
    .email-footer { background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB; }
    .footer-links { margin-bottom: 20px; }
    .footer-links a { color: #667EEA; text-decoration: none; margin: 0 12px; font-size: 14px; font-weight: 500; }
    .footer-text { font-size: 13px; color: #6B7280; margin-bottom: 8px; }
    .footer-copyright { font-size: 12px; color: #9CA3AF; }
    @media only screen and (max-width: 600px) {
      .email-header { padding: 30px 20px; }
      .email-body { padding: 30px 20px; }
      .email-footer { padding: 20px; }
      h2 { font-size: 20px; }
      .btn { display: block; margin: 8px 0; }
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
        <a href="${SITE_URL}/settings/notifications">Gérer les notifications</a>
      </div>
      <p class="footer-text">
        <strong>Nguma</strong> - Votre plateforme d'investissement de confiance<br>
        Vous recevez cet e-mail car vous avez un compte actif sur Nguma.<br>
        <a href="${SITE_URL}/settings/notifications" style="color: #667EEA; text-decoration: none;">Se désabonner</a> | <a href="${SITE_URL}/privacy" style="color: #667EEA; text-decoration: none;">Politique de confidentialité</a>
      </p>
      <p class="footer-text" style="margin-top: 16px;">
        <strong>Nguma Inc.</strong><br>
        Kinshasa, République Démocratique du Congo<br>
        Email: <a href="mailto:contact@nguma.org" style="color: #667EEA; text-decoration: none;">contact@nguma.org</a>
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

    const { subject, body, text } = templateGenerator(params);
    const html = generateEmailHtml(body);
    const fromAddress = `Nguma <notification@${RESEND_FROM_DOMAIN}>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [params.to],
      subject: subject,
      html: html,
      text: text,
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