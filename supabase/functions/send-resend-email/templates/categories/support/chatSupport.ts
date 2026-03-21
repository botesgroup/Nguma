import { EmailTemplate, EmailParams, TemplateHelpers, TemplateData } from '../../types.ts';
import { StatusBadge } from '../../components/StatusBadge.ts';
import { InfoCard } from '../../components/InfoCard.ts';
import { BaseLayout } from '../../layouts/baseLayout.ts';

// Template pour l'escalade d'une question complexe (Admin)
const renderChatEscalationAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { escapeHtml, siteUrl } = helpers;
    const { name, email, conversationId, message } = params;

    const subject = `[URGENT] Escalade Support Chat : ${escapeHtml(name || email)}`;
    const previewText = `L'IA n'a pas pu répondre à : "${escapeHtml(message?.substring(0, 50) || '...')}"`;

    const content = `
    ${StatusBadge('warning', 'Escalade IA')}
    <h2>Question complexe en attente</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      L'assistant virtuel n'a pas pu répondre avec certitude à un utilisateur. Une intervention humaine est requise.
    </p>
    ${InfoCard(`
      <table class="info-table">
        <tr><td>Utilisateur :</td><td><strong>${escapeHtml(name || 'N/A')}</strong> (${escapeHtml(email || 'N/A')})</td></tr>
        <tr><td>Dernier Message :</td><td><em>"${escapeHtml(message || 'N/A')}"</em></td></tr>
      </table>
    `, 'warning')}
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/support?conversation=${escapeHtml(conversationId || '')}" class="btn btn-primary">Répondre sur le Chat</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Escalade Chat Support de ${name} (${email}). Message: ${message}. Répondre ici: ${siteUrl}/admin/support?conversation=${conversationId}`,
        html
    };
};

// Template pour un nouveau message humain (Admin)
const renderChatNewMessageAdmin = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { escapeHtml, siteUrl } = helpers;
    const { name, email, conversationId, message } = params;

    const subject = `Nouveau message de ${escapeHtml(name || email)}`;
    const previewText = `Message : "${escapeHtml(message?.substring(0, 50) || '...')}"`;

    const content = `
    ${StatusBadge('info', 'Nouveau Message')}
    <h2>Message de support reçu</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      L'utilisateur ${escapeHtml(name)} vous a envoyé un nouveau message sur le chat de support.
    </p>
    ${InfoCard(`
      <p style="font-style: italic; color: #374151;">"${escapeHtml(message || 'N/A')}"</p>
    `, 'info')}
    <div class="cta-buttons">
      <a href="${siteUrl}/admin/support?conversation=${escapeHtml(conversationId || '')}" class="btn btn-primary">Voir la conversation</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Nouveau message de ${name} (${email}) : ${message}`,
        html
    };
};

export const chatEscalationAdminTemplate: EmailTemplate = {
    id: 'chat_escalation_admin',
    category: 'admin',
    requiredFields: ['to', 'name', 'email', 'conversationId', 'message'],
    render: renderChatEscalationAdmin
};

export const chatNewMessageAdminTemplate: EmailTemplate = {
    id: 'chat_new_message_admin',
    category: 'admin',
    requiredFields: ['to', 'name', 'email', 'conversationId', 'message'],
    render: renderChatNewMessageAdmin
};

// Template pour un nouveau message (Utilisateur)
const renderChatNewMessageUser = (params: EmailParams, helpers: TemplateHelpers): TemplateData => {
    const { escapeHtml, siteUrl } = helpers;
    const { name, conversationId, message } = params;

    const subject = `Nouveau message du support technique`;
    const previewText = `L'équipe Nguma a répondu à votre demande : "${escapeHtml(message?.substring(0, 50) || '...')}"`;

    const content = `
    ${StatusBadge('success', 'Nouveau Message')}
    <h2>Nouveau message de notre équipe</h2>
    <p class="lead" style="font-size: 16px; line-height: 1.5; color: #4B5563;">
      Bonjour ${escapeHtml(name || 'cher client')}, l'équipe de support Nguma vient de répondre à votre demande.
    </p>
    ${InfoCard(`
      <p style="font-style: italic; color: #374151;">"${escapeHtml(message || 'N/A')}"</p>
    `, 'info')}
    <div class="cta-buttons">
      <a href="${siteUrl}/support?conversation=${escapeHtml(conversationId || '')}" class="btn btn-primary">Répondre sur le Chat</a>
    </div>
  `;
    const html = BaseLayout(content, previewText, siteUrl);
    return {
        subject,
        previewText,
        text: `Bonjour ${name || 'cher client'}, nouveau message du support : ${message}. Répondre ici: ${siteUrl}/support?conversation=${conversationId}`,
        html
    };
};

export const chatNewMessageUserTemplate: EmailTemplate = {
    id: 'chat_new_message_user',
    category: 'support',
    requiredFields: ['to', 'name', 'conversationId', 'message'],
    render: renderChatNewMessageUser
};
