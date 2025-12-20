export const StatusBadge = (type: 'success' | 'error' | 'info', text: string): string => {
  const colors = {
    success: { bg: '#D1FAE5', text: '#065F46' },
    error: { bg: '#FEE2E2', text: '#991B1B' },
    info: { bg: '#DBEAFE', text: '#1E40AF' }
  };
  
  return `
    <div class="status-badge ${type}" style="
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 20px;
      background-color: ${colors[type].bg};
      color: ${colors[type].text};
    ">
      ${text}
    </div>
  `;
};
