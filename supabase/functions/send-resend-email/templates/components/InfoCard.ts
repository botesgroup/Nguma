export const InfoCard = (content: string, type: 'default' | 'success' | 'error' = 'default'): string => {
  const styles = {
    default: { bg: '#F8FAFC', border: '#E2E8F0' },
    success: { bg: '#F0FDF4', border: '#BBF7D0' },
    error: { bg: '#FEF2F2', border: '#FECACA' },
    info: { bg: '#DBEAFE', border: '#BFDBFE' } // Ajout du style info
  };
  
  return `
    <div class="info-card ${type}" style="
      background: ${styles[type].bg};
      border: 1px solid ${styles[type].border};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    ">
      ${content}
    </div>
  `;
};