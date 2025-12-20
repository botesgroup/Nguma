import { EmailTemplate, TemplateHelpers } from './types.ts';

// Import transaction templates
import { depositApprovedTemplate, depositRejectedTemplate, depositPendingTemplate } from './categories/transactions/deposit.ts';
import { withdrawalApprovedTemplate, withdrawalRejectedTemplate, withdrawalPendingTemplate, withdrawalApprovedWithProofTemplate } from './categories/transactions/withdrawal.ts';
import { monthlyProfitTemplate, newInvestmentTemplate, contractEndedTemplate, reinvestmentConfirmedTemplate, contractExpiringSoonTemplate } from './categories/transactions/investments.ts';

// Import security templates
import { securityAlertTemplate } from './categories/security/securityAlert.ts';
import { withdrawalOtpTemplate, passwordChangedTemplate, emailChangedOldAddressTemplate, emailChangedNewAddressTemplate, twoFactorSetupConfirmedTemplate, twoFactorDisabledConfirmedTemplate } from './categories/security/auth.ts';
import { profileTemplates } from './categories/security/profiles.ts'; // ✅ Imported profile templates

// Import admin templates
import {
  adminManualCreditTemplate,
  adminManualDebitTemplate,
  newDepositRequestTemplate,
  newWithdrawalRequestTemplate,
  accountSuspendedTemplate,
  accountReactivatedTemplate
} from './categories/admin/admin.ts';
import { newUserRegisteredAdminTemplate } from './categories/admin/newAdminNotification.ts';
import { newContractAdminTemplate } from './categories/admin/newContractAdmin.ts';

// Import marketing & system templates
import {
  dormantFundsReminderTemplate,
  notificationPreferencesUpdatedTemplate,
  depositAvailabilityReminderTemplate,
  testMailTesterTemplate
} from './categories/marketing/marketing.ts';

// Import support templates
import {
  supportRequestReceivedUserTemplate,
  newSupportRequestAdminTemplate
} from './categories/support/supportRequest.ts';

// Import refund templates
import {
  refundRequestedTemplate,
  newRefundRequestTemplate,
  refundApprovedTemplate,
  refundRejectedTemplate
} from './categories/transactions/refunds.ts';

export const TEMPLATES: Record<string, EmailTemplate> = {
  // ...
  // Security Templates
  security_alert: securityAlertTemplate,
  withdrawal_otp: withdrawalOtpTemplate,
  password_changed: passwordChangedTemplate,
  email_changed_old_address: emailChangedOldAddressTemplate,
  email_changed_new_address: emailChangedNewAddressTemplate,
  '2fa_setup_confirmed': twoFactorSetupConfirmedTemplate,
  '2fa_disabled_confirmed': twoFactorDisabledConfirmedTemplate,

  // Profile Templates
  profile_updated_by_admin: profileTemplates[0], // ✅ Added profile template

  // Admin Templates
  // ...
  admin_manual_credit: adminManualCreditTemplate,
  admin_manual_debit: adminManualDebitTemplate,               // ⏳ READY (RPC function pending)
  new_deposit_request: newDepositRequestTemplate,
  new_withdrawal_request: newWithdrawalRequestTemplate,
  account_suspended: accountSuspendedTemplate,
  account_reactivated: accountReactivatedTemplate,
  new_user_registered_admin: newUserRegisteredAdminTemplate,
  new_contract_admin: newContractAdminTemplate,               // ✅ NOUVEAU - Notification admin nouveau contrat

  // Marketing & System Templates
  dormant_funds_reminder: dormantFundsReminderTemplate,
  notification_preferences_updated: notificationPreferencesUpdatedTemplate, // ⏳ READY (not integrated in NotificationSettings.tsx yet)
  deposit_availability_reminder: depositAvailabilityReminderTemplate,
  test_mail_tester: testMailTesterTemplate,

  // Support Templates
  support_request_received_user: supportRequestReceivedUserTemplate,
  new_support_request_admin: newSupportRequestAdminTemplate,

  // Refund Templates
  refund_requested: refundTemplates[0],
  new_refund_request: refundTemplates[1],
  refund_approved: refundTemplates[2],
  refund_rejected: refundTemplates[3],
};

export const validateTemplateParams = (
  templateId: string,
  params: any,
  helpers: TemplateHelpers // Added for consistency, though not strictly used here for validation logic itself
): string[] => {
  const template = TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const errors: string[] = [];
  template.requiredFields.forEach(field => {
    if (params[field] === undefined || params[field] === null) { // Check for undefined or null explicitly
      errors.push(`Missing required field: ${String(field)}`);
    }
  });

  return errors;
};

export const getTemplate = (templateId: string): EmailTemplate => {
  const template = TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }
  return template;
};
