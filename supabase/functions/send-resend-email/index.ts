import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

// --- TYPES & INTERFACES (Pour la robustesse) ---

interface EmailParams {
    to: string;
    name: string;
    amount?: number;
    reason?: string;
    otp_code?: string;
    email?: string; // Pour les notifs admin
}

interface TemplateData {
    subject: string;
    text: string;
    body: string;
    previewText: string; // Texte invisible qui s'affiche sous l'objet dans Gmail
}

// --- CONFIGURATION ---

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN"); // ex: updates.nguma.org
const SITE_URL = Deno.env.get("SITE_URL") || "https://nguma.org";

const resend = new Resend(RESEND_API_KEY);

// --- HELPERS ---

const formatCurrency = (amount?: number): string => {
    if (amount === undefined || amount === null) return "0,00 $";
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
};

const escapeHtml = (unsafe: string | undefined): string => {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const formatDate = (): string => {
    return new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

// --- TEMPLATES (Optimisés Anti-Spam) ---

const templates: Record<string, (p: EmailParams) => TemplateData> = {

    // 1. Dépôt Approuvé
    deposit_approved: (p) => ({
        subject: `Crédit confirmé sur votre compte`, // Moins agressif que "Statut dépôt"
        previewText: `Les fonds de ${formatCurrency(p.amount)} sont disponibles.`,
        text: `Bonjour ${p.name}, votre dépôt de ${formatCurrency(p.amount)} est confirmé.`,
        body: `
      <div class="status-badge success">Opération validée</div>
      <h2>Fonds disponibles</h2>
      <p class="lead">Votre transaction récente a été traitée avec succès. Le montant a été crédité sur votre balance.</p>
      <div class="info-card">
        <table class="info-table">
          <tr><td>Montant crédité :</td><td class="amount-success">${formatCurrency(p.amount)}</td></tr>
          <tr><td>Référence :</td><td>Dépôt</td></tr>
          <tr><td>Date :</td><td>${formatDate()}</td></tr>
        </table>
      </div>
      <div class="cta-buttons"><a href="${SITE_URL}/wallet" class="btn btn-primary">Consulter mon solde</a></div>
    `
    }),

    // 2. Dépôt Rejeté
    deposit_rejected: (p) => ({
        subject: `Mise à jour concernant votre transaction`, // Neutre
        previewText: `Nous ne pouvons pas valider votre opération de ${formatCurrency(p.amount)}.`,
        text: `Bonjour ${p.name}, votre transaction n'a pas pu aboutir.`,
        body: `
      <div class="status-badge error">Opération non aboutie</div>
      <h2>Information importante</h2>
      <p class="lead">Nous avons analysé votre demande de dépôt. Pour des raisons de sécurité ou de conformité, elle n'a pas pu être validée.</p>
      <div class="info-card error-card">
        <table class="info-table">
          <tr><td>Montant :</td><td>${formatCurrency(p.amount)}</td></tr>
          <tr><td>Motif :</td><td class="rejection-reason">${escapeHtml(p.reason || "Vérification incomplète")}</td></tr>
        </table>
      </div>
      <div class="cta-buttons"><a href="${SITE_URL}/support" class="btn btn-primary">Contacter le support</a></div>
    `
    }),

    // 3. Dépôt En Attente
    deposit_pending: (p) => ({
        subject: `Réception de votre demande`,
        previewText: `Votre demande de ${formatCurrency(p.amount)} est en cours d'analyse.`,
        text: `Bonjour ${p.name}, nous analysons votre demande.`,
        body: `
      <div class="status-badge info">En cours de traitement</div>
      <h2>Demande reçue</h2>
      <p class="lead">Nous avons bien reçu les détails de votre transaction. Nos services procèdent actuellement aux vérifications d'usage.</p>
      <div class="info-card">
        <table class="info-table">
          <tr><td>Montant :</td><td class="amount-highlight">${formatCurrency(p.amount)}</td></tr>
          <tr><td>Délai estimé :</td><td>24h ouvrées</td></tr>
        </table>
      </div>
    `
    }),

    // 4. Retrait Approuvé
    withdrawal_approved: (p) => ({
        subject: `Validation de votre transfert sortant`,
        previewText: `Le retrait de ${formatCurrency(p.amount)} a été approuvé.`,
        text: `Bonjour ${p.name}, votre retrait est validé.`,
        body: `
      <div class="status-badge success">Transfert validé</div>
      <h2>Opération confirmée</h2>
      <p class="lead">Votre demande de retrait a été validée par nos services financiers. Les fonds sont en route vers votre compte de destination.</p>
      <div class="info-card">
        <table class="info-table">
          <tr><td>Montant retiré :</td><td class="amount-success">${formatCurrency(p.amount)}</td></tr>
          <tr><td>Statut :</td><td>Envoyé</td></tr>
        </table>
      </div>
    `
    }),

    // 5. Retrait Rejeté
    withdrawal_rejected: (p) => ({
        subject: `Information sur votre demande de retrait`,
        previewText: `Impossible de traiter le retrait de ${formatCurrency(p.amount)}.`,
        text: `Bonjour ${p.name}, votre retrait n'a pas pu être traité.`,
        body: `
      <div class="status-badge error">Transfert annulé</div>
      <h2>Action requise</h2>
      <p class="lead">Votre demande de retrait n'a pas pu être finalisée. Aucun montant n'a été débité de votre solde.</p>
      <div class="info-card error-card">
        <table class="info-table">
          <tr><td>Montant :</td><td>${formatCurrency(p.amount)}</td></tr>
          <tr><td>Raison :</td><td class="rejection-reason">${escapeHtml(p.reason || "Données incorrectes")}</td></tr>
        </table>
      </div>
    `
    }),

    // 6. Retrait En Attente
    withdrawal_pending: (p) => ({
        subject: `Demande de retrait enregistrée`,
        previewText: `Confirmation de votre demande de ${formatCurrency(p.amount)}.`,
        text: `Bonjour ${p.name}, votre demande est enregistrée.`,
        body: `
      <div class="status-badge info">Vérification en cours</div>
      <h2>Demande enregistrée</h2>
      <p class="lead">Vous avez initié une demande de retrait. Pour votre sécurité, notre équipe va valider cette opération manuellement.</p>
      <div class="info-card">
        <table class="info-table">
          <tr><td>Montant demandé :</td><td class="amount-highlight">${formatCurrency(p.amount)}</td></tr>
          <tr><td>Délai :</td><td>24-48h</td></tr>
        </table>
      </div>
    `
    }),

    // 7. Profit Mensuel (ATTENTION SPAM : Vocabulaire changé)
    monthly_profit: (p) => ({
        subject: `Relevé mensuel : Nouveau crédit`, // "Profit" supprimé du sujet
        previewText: `Un montant de ${formatCurrency(p.amount)} a été ajouté à votre solde.`,
        text: `Bonjour ${p.name}, votre solde a été mis à jour.`,
        body: `
      <div class="status-badge success">Solde mis à jour</div>
      <h2>Relevé mensuel</h2>
      <p class="lead">Le rendement mensuel de votre plan actif a été crédité sur votre compte.</p>
      <div class="info-card success-card">
        <table class="info-table">
          <tr><td>Montant crédité :</td><td class="amount-success">${formatCurrency(p.amount)}</td></tr>
          <tr><td>Origine :</td><td>Rendement mensuel</td></tr>
          <tr><td>Date :</td><td>${formatDate()}</td></tr>
        </table>
      </div>
      <div class="cta-buttons"><a href="${SITE_URL}/wallet" class="btn btn-primary">Voir mon tableau de bord</a></div>
    `
    }),

    // 8. Nouvel Investissement (Vocabulaire "Contrat" préféré à "Investissement")
    new_investment: (p) => ({
        subject: `Confirmation d'activation de contrat`,
        previewText: `Votre plan de ${formatCurrency(p.amount)} est maintenant actif.`,
        text: `Félicitations ${p.name}, votre contrat est actif.`,
        body: `
      <div class="status-badge success">Contrat Actif</div>
      <h2>Activation confirmée</h2>
      <p class="lead">Votre souscription a bien été prise en compte. Votre capital commence à travailler dès aujourd'hui selon les termes prévus.</p>
      <div class="info-card success-card">
        <table class="info-table">
          <tr><td>Capital initial :</td><td class="amount-success">${formatCurrency(p.amount)}</td></tr>
          <tr><td>Durée :</td><td>12 mois</td></tr>
          <tr><td>Taux appliqué :</td><td>Standard (15%)</td></tr>
        </table>
      </div>
      <div class="cta-buttons"><a href="${SITE_URL}/dashboard" class="btn btn-primary">Gérer mon contrat</a></div>
    `
    }),

    // 9. OTP Code (Sécurité)
    withdrawal_otp: (p) => ({
        subject: `Code de vérification`,
        previewText: `Votre code de sécurité est ${p.otp_code}.`,
        text: `Votre code est ${p.otp_code}.`,
        body: `
      <div class="status-badge info">Sécurité</div>
      <h2>Vérification d'identité</h2>
      <p class="lead">Vous avez initié un retrait de <strong>${formatCurrency(p.amount)}</strong>. Utilisez ce code unique pour valider l'opération.</p>
      
      <div style="background: white; border: 2px solid #667eea; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
        <span style="display:block; font-size: 14px; color: #666; margin-bottom: 8px;">Code de validation</span>
        <span style="display:block; font-size: 32px; color: #1F2937; letter-spacing: 8px; font-weight: 700; font-family: monospace;">${p.otp_code}</span>
      </div>
      
      <p style="font-size: 12px; color: #666;">Si vous n'êtes pas à l'origine de cette demande, changez immédiatement votre mot de passe.</p>
    `
    }),

    // 10. Admin Notifications (Simplifié)
    new_deposit_request: (p) => ({
        subject: `[ADMIN] Nouveau Dépôt : ${formatCurrency(p.amount)}`,
        previewText: `Utilisateur : ${p.name}`,
        text: `Nouveau dépôt à valider.`,
        body: `<h2>Admin : Nouveau Dépôt</h2><p>Utilisateur: ${escapeHtml(p.email)}<br>Montant: <strong>${formatCurrency(p.amount)}</strong></p><a href="${SITE_URL}/admin/deposits" class="btn btn-primary">Traiter</a>`
    }),

    new_withdrawal_request: (p) => ({
        subject: `[ADMIN] Nouveau Retrait : ${formatCurrency(p.amount)}`,
        previewText: `Utilisateur : ${p.name}`,
        text: `Nouveau retrait à valider.`,
        body: `<h2>Admin : Nouveau Retrait</h2><p>Utilisateur: ${escapeHtml(p.email)}<br>Montant: <strong>${formatCurrency(p.amount)}</strong></p><a href="${SITE_URL}/admin/withdrawals" class="btn btn-primary">Traiter</a>`
    }),

    // 11. Test Template for Mail Tester
    test_mail_tester: (p) => ({
        subject: `Email de Test pour Nguma`,
        previewText: `Ceci est un test de délivrabilité.`,
        text: `Bonjour ${p.name}, ceci est un e-mail de test envoyé depuis le système Nguma pour vérifier la configuration de l'envoi.`,
        body: `
      <div class="status-badge info">Test Technique</div>
      <h2>Vérification du système d'envoi</h2>
      <p class="lead">Cet e-mail a été envoyé pour vérifier la configuration du serveur (SPF, DKIM, DMARC) et la qualité du template HTML.</p>
      <div class="info-card">
        <p>Si vous recevez cet e-mail, cela signifie que la partie "envoi" fonctionne correctement.</p>
        <p>Merci de vérifier le score sur mail-tester.com.</p>
      </div>
    `
    })
};

// --- HTML GENERATOR (CSS Inliné + Preheader) ---

function generateEmailHtml(content: string, previewText: string): string {
    // Le "Preheader" est une astuce pour afficher du texte dans la liste des emails sans l'afficher dans le corps
    const preheaderHtml = `
    <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${previewText}
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </span>
  `;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nguma Notification</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 0; color: #374151; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
    .logo { color: white; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-decoration: none; }
    .content { padding: 40px 30px; }
    .footer { background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
    
    /* Components */
    .btn { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 20px; }
    .btn-primary { background-color: #4F46E5; color: #ffffff !important; }
    
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
    .success { background-color: #D1FAE5; color: #065F46; }
    .error { background-color: #FEE2E2; color: #991B1B; }
    .info { background-color: #DBEAFE; color: #1E40AF; }
    
    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .success-card { background: #F0FDF4; border-color: #BBF7D0; }
    .error-card { background: #FEF2F2; border-color: #FECACA; }
    
    .info-table { width: 100%; }
    .info-table td { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
    .info-table td:last-child { text-align: right; font-weight: bold; border-bottom: none; }
    .info-table tr:last-child td { border-bottom: none; }
    
    .amount-success { color: #059669; font-size: 18px; }
    .amount-highlight { color: #4F46E5; font-size: 18px; }
    .rejection-reason { color: #DC2626; }
    .cta-buttons { text-align: center; }
    
    @media only screen and (max-width: 600px) {
      .content { padding: 20px; }
    }
  </style>
</head>
<body>
  ${preheaderHtml}
  <div class="container">
    <div class="header">
      <div class="logo">NGUMA</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Cet email automatique concerne votre compte Nguma.</p>
      <p>© ${new Date().getFullYear()} Nguma Inc. Kinshasa, RDC.</p>
      <a href="${SITE_URL}/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">Gérer mes préférences</a>
    </div>
  </div>
</body>
</html>
  `;
}

// --- SERVER HANDLER ---

serve(async (req) => {
    // 1. CORS Pre-flight
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    // 2. Env check
    if (!RESEND_API_KEY) {
        console.error("CRITICAL: RESEND_API_KEY is missing");
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
            status: 500, headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // 3. Parse Body
        const payload = await req.json();
        const { template_id, ...params } = payload;
        const emailParams = params as EmailParams; // Type casting

        // 4. Validation
        if (!emailParams.to || !emailParams.name || !template_id) {
            return new Response(JSON.stringify({ error: "Missing required fields (to, name, template_id)" }), {
                status: 400, headers: { "Content-Type": "application/json" }
            });
        }

        // 5. Template Lookup
        const renderTemplate = templates[template_id];
        if (!renderTemplate) {
            return new Response(JSON.stringify({ error: `Invalid template_id: ${template_id}` }), {
                status: 404, headers: { "Content-Type": "application/json" }
            });
        }

        // 6. Generate Content
        const { subject, body, text, previewText } = renderTemplate(emailParams);
        const html = generateEmailHtml(body, previewText);

        // 7. Send via Resend
        // Important: Utiliser un sous-domaine si possible (ex: updates@notifications.nguma.org)
        // Si RESEND_FROM_DOMAIN est vide, fallback sur une valeur sûre
        const domain = RESEND_FROM_DOMAIN || "nguma.org";
        const fromAddress = `Nguma <notifications@${domain}>`;

        const { data, error } = await resend.emails.send({
            from: fromAddress,
            to: [emailParams.to],
            reply_to: `support@${domain}`,
            subject: subject,
            html: html,
            text: text, // Version texte brut importante pour l'anti-spam
            tags: [
                { name: 'category', value: template_id }, // Utile pour les analytics Resend
                { name: 'app', value: 'nguma' }
            ],
            headers: {
                'List-Unsubscribe': `<${SITE_URL}/settings/notifications>`, // Critique pour Gmail
                'X-Entity-Ref-ID': crypto.randomUUID()
            }
        });

        if (error) {
            console.error("Resend Error:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500, headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200, headers: { "Content-Type": "application/json" }
        });

    } catch (e: any) {
        console.error("Worker Error:", e);
        return new Response(JSON.stringify({ error: e.message || "Internal Server Error" }), {
            status: 500, headers: { "Content-Type": "application/json" }
        });
    }
});
