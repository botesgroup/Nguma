export const createTemplateHelpers = (siteUrl: string) => ({
  formatCurrency: (amount?: number): string => {
    if (amount === undefined || amount === null) return "0,00 $";
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  },

  escapeHtml: (unsafe: string | undefined): string => {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  formatDate: (date?: string): string => {
    const dateObj = date ? new Date(date) : new Date();
    return dateObj.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  generateSupportHtml: (phone?: string): string => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; text-align: center;">
        <p>Besoin d'aide ? Contactez notre support sur WhatsApp : <br>
        <a href="https://wa.me/${cleanPhone}" style="color: #25D366; font-weight: bold; text-decoration: none;">
          ${phone}
        </a></p>
      </div>
    `;
  },

  siteUrl: siteUrl
});
