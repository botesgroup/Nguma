export const BaseLayout = (content: string, previewText: string, siteUrl: string): string => {
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
        ${getBaseStyles()}
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
        ${getFooter(siteUrl)}
      </div>
    </body>
    </html>
  `;
};

const getBaseStyles = (): string => `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 0; color: #374151; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; }
  .logo { color: white; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-decoration: none; }
  .content { padding: 40px 30px; }
  
  .btn { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 20px; }
  .btn-primary { background-color: #4F46E5; color: #ffffff !important; }
  
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
`;

const getFooter = (siteUrl: string): string => `
  <div class="footer" style="
    background-color: #F9FAFB;
    padding: 20px;
    text-align: center;
    font-size: 12px;
    color: #9CA3AF;
    border-top: 1px solid #E5E7EB;
  ">
    <p>Cet email automatique concerne votre compte Nguma.</p>
    <p>© ${new Date().getFullYear()} Nguma Inc. Kinshasa, RDC.</p>
    <a href="${siteUrl}/settings/notifications" style="color:#9CA3AF; text-decoration:underline;">
      Gérer mes préférences
    </a>
  </div>
`;
