import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

const renderWithdrawalOtp = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { formatCurrency, siteUrl } = helpers;
  const { name, amount, otp_code } = params;

  const subject = `Code de vérification`;
  const previewText = `Votre code de sécurité est ${otp_code}.`;

  const content = `
    ${StatusBadge('info', 'Sécurité')}
    <h2>Vérification d'identité</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Vous avez initié un retrait de <strong>${formatCurrency(amount)}</strong>. Utilisez ce code unique pour valider l'opération.
    </p>
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
      <span style="display:block; font-size: 14px; color: #666; margin-bottom: 8px;">Code de validation</span>
      <span style="display:block; font-size: 32px; color: #1F2937; letter-spacing: 8px; font-weight: 700; font-family: monospace;">${otp_code}</span>
    </div>
    
    <p style="font-size: 12px; color: #666;">Si vous n'êtes pas à l'origine de cette demande, changez immédiatement votre mot de passe.</p>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Votre code est ${otp_code}.`,
    html
  };
};

const renderPasswordChanged = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, date } = params;

  const subject = `Votre mot de passe a été modifié`;
  const previewText = `La modification de votre mot de passe a été enregistrée avec succès.`;

  const content = `
    ${StatusBadge('info', 'Mot de passe modifié')}
    <h2>Modification de votre mot de passe</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Nous vous confirmons que le mot de passe de votre compte Nguma a été modifié avec succès.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Date et heure :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `)}
    <p style="font-size: 14px; color: #DC2626;">
      Si vous n'êtes pas à l'origine de cette modification, veuillez contacter immédiatement notre service de support.
    </p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre mot de passe a été modifié le ${date || formatDate()}. Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.`,
    html
  };
};

const renderEmailChangedOldAddress = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, old_email, new_email, date } = params;

  const subject = `Alerte de sécurité : Votre adresse e-mail a été modifiée`;
  const previewText = `L'adresse e-mail associée à votre compte a été modifiée de ${old_email} à ${new_email}.`;

  const content = `
    ${StatusBadge('error', 'Alerte de Sécurité')}
    <h2>Modification de votre adresse e-mail</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      L'adresse e-mail associée à votre compte Nguma a été modifiée.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Ancienne adresse :</td><td><strong>${escapeHtml(old_email || 'N/A')}</strong></td></tr>
        <tr><td>Nouvelle adresse :</td><td><strong>${escapeHtml(new_email || 'N/A')}</strong></td></tr>
        <tr><td>Date et heure :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'error')}
    <p style="font-size: 14px; color: #DC2626;">
      Si vous n'êtes pas à l'origine de cette modification, veuillez contacter immédiatement notre service de support.
    </p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, l'adresse e-mail de votre compte Nguma a été modifiée de ${old_email} à ${new_email} le ${date || formatDate()}. Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.`,
    html
  };
};

const renderEmailChangedNewAddress = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, new_email, date } = params;

  const subject = `Confirmation : Votre adresse e-mail a été mise à jour`;
  const previewText = `Votre nouvelle adresse e-mail, ${new_email}, a été vérifiée et associée à votre compte.`;

  const content = `
    ${StatusBadge('success', 'Adresse e-mail mise à jour')}
    <h2>Confirmation de modification d'adresse e-mail</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Votre adresse e-mail a été mise à jour avec succès et est maintenant associée à votre compte Nguma.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Nouvelle adresse :</td><td><strong>${escapeHtml(new_email || 'N/A')}</strong></td></tr>
        <tr><td>Date et heure :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'success')}
    <p>Vous recevrez désormais toutes les communications importantes à cette nouvelle adresse.</p>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, votre adresse e-mail de compte Nguma a été mise à jour à ${new_email} le ${date || formatDate()}.`,
    html
  };
};

const render2FaSetupConfirmed = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, date } = params;

  const subject = `Confirmation : L'authentification à deux facteurs est activée`;
  const previewText = `L'authentification à deux facteurs (2FA) a été activée sur votre compte Nguma.`;

  const content = `
    ${StatusBadge('success', '2FA Activée')}
    <h2>Authentification à deux facteurs (2FA) activée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Nous vous confirmons que l'authentification à deux facteurs a été activée sur votre compte Nguma.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Statut :</td><td><strong>Activée</strong></td></tr>
        <tr><td>Date et heure :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'success')}
    <p>Votre compte est maintenant protégé par une couche de sécurité supplémentaire. Chaque connexion nécessitera votre mot de passe et un code de votre application d'authentification.</p>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, l'authentification à deux facteurs (2FA) a été activée sur votre compte Nguma le ${date || formatDate()}.`,
    html
  };
};

const render2FaDisabledConfirmed = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
  const { escapeHtml, formatDate, siteUrl } = helpers;
  const { name, date } = params;

  const subject = `Alerte de sécurité : L'authentification à deux facteurs est désactivée`;
  const previewText = `L'authentification à deux facteurs (2FA) a été désactivée sur votre compte Nguma.`;

  const content = `
    ${StatusBadge('error', '2FA Désactivée')}
    <h2>Authentification à deux facteurs (2FA) désactivée</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Nous vous confirmons que l'authentification à deux facteurs a été désactivée sur votre compte Nguma.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Statut :</td><td><strong>Désactivée</strong></td></tr>
        <tr><td>Date et heure :</td><td>${escapeHtml(date || formatDate())}</td></tr>
      </table>
    `, 'error')}
    <p style="font-size: 14px; color: #DC2626;">
      Si vous n'êtes pas à l'origine de cette désactivation, veuillez nous contacter immédiatement.
    </p>
    <div class="cta-buttons">
      <a href="${siteUrl}/support" class="btn btn-primary">Contacter le support</a>
    </div>
  `;
  const html = BaseLayout(content, previewText, siteUrl);
  return {
    subject,
    previewText,
    text: `Bonjour ${name}, l'authentification à deux facteurs (2FA) a été désactivée sur votre compte Nguma le ${date || formatDate()}. Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.`,
    html
  };
};

export const withdrawalOtpTemplate: EmailTemplate = {
  id: 'withdrawal_otp',
  category: 'security',
  requiredFields: ['to', 'name', 'amount', 'otp_code'],
  render: renderWithdrawalOtp
};

export const passwordChangedTemplate: EmailTemplate = {
  id: 'password_changed',
  category: 'security',
  requiredFields: ['to', 'name'],
  render: renderPasswordChanged
};

export const emailChangedOldAddressTemplate: EmailTemplate = {
  id: 'email_changed_old_address',
  category: 'security',
  requiredFields: ['to', 'name', 'old_email', 'new_email'],
  render: renderEmailChangedOldAddress
};

export const emailChangedNewAddressTemplate: EmailTemplate = {
  id: 'email_changed_new_address',
  category: 'security',
  requiredFields: ['to', 'name', 'new_email'],
  render: renderEmailChangedNewAddress
};

export const twoFactorSetupConfirmedTemplate: EmailTemplate = {
  id: '2fa_setup_confirmed',
  category: 'security',
  requiredFields: ['to', 'name'],
  render: render2FaSetupConfirmed
};

export const twoFactorDisabledConfirmedTemplate: EmailTemplate = {
  id: '2fa_disabled_confirmed',
  category: 'security',
  requiredFields: ['to', 'name'],
  render: render2FaDisabledConfirmed
};
