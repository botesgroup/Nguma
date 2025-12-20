
// Base Interface for all email parameters
export interface BaseEmailParams {
  to: string | string[];  // Single or multiple recipients
  name?: string;          // Recipient name
  userId?: string;        // UUID for tracking
  notificationId?: string;// UUID for tracking
}

// Transaction Parameters (Deposit, Withdrawal, Refund, Investment)
export interface TransactionEmailParams extends BaseEmailParams {
  amount: number;
  currency?: string;      // Defaults to 'USD'
  transactionId?: string; // Reference ID
  date?: string;          // Formatted date string
  method?: string;        // Payment method
  reason?: string;        // Rejection reason
  proof_url?: string;     // URL for proof images
  contractId?: string;    // Contract Reference
  startDate?: string;     // Contract start
  endDate?: string;       // Contract end
  totalProfits?: number;  // For contract ended
  support_phone?: string; // Contact support
}

// Security Parameters (Login, Password, 2FA, OTP)
export interface SecurityEmailParams extends BaseEmailParams {
  otp_code?: string;
  ipAddress?: string;   // Previously 'ip'
  activityType?: string;// e.g. "Connexion depuis un nouvel appareil"
  date?: string;        // Event timestamp
  old_email?: string;
  new_email?: string;
  updatedFields?: string; // For profile updates
}

// Admin Notification Parameters
export interface AdminNotificationParams extends BaseEmailParams {
  userName: string;     // The user subject of the action
  userEmail?: string;   // The email of the user subject (standardized)
  email?: string;       // Legacy: alias for userEmail in some templates
  activityType?: string;// e.g., 'New Deposit Request'
  amount?: number;
  transactionId?: string;
  contractId?: string;  // For new contract notifications
  duration?: number;    // Contract duration (months)
  rate?: number;        // Contract rate (%)
  startDate?: string;   // Contract start date
  details?: Record<string, any>; // Flexible object
  date?: string;
  reason?: string;      // Refund reason etc.
}

// Marketing / System Parameters
export interface SystemEmailParams extends BaseEmailParams {
  message: string;
  actionUrl?: string;
  actionText?: string;
}

// Union Type for usage in templates
export type EmailParams =
  | TransactionEmailParams
  | SecurityEmailParams
  | AdminNotificationParams
  | SystemEmailParams;

export interface TemplateData {
  subject: string;
  text: string;
  html: string;
  previewText: string;
}

export interface TemplateHelpers {
  formatCurrency: (amount?: number) => string;
  escapeHtml: (unsafe: string | undefined) => string;
  formatDate: (date?: string) => string;
  generateSupportHtml: (phone?: string) => string;
  siteUrl: string;
}

export interface EmailTemplate {
  id: string;
  category: 'transaction' | 'security' | 'admin' | 'marketing' | 'system';
  // We use string[] to allow specific keys from any union member
  requiredFields: string[];
  render: (params: EmailParams, helpers: TemplateHelpers) => TemplateData;
}
