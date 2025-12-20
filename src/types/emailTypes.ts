
// Base Interface for all email parameters
export interface BaseEmailParams {
    to: string | string[];
    name?: string;
    userId?: string;
    notificationId?: string;
}

// Transaction Parameters
export interface TransactionEmailParams extends BaseEmailParams {
    amount: number;
    currency?: string;
    transactionId?: string;
    date?: string;
    method?: string;
    reason?: string;
    proof_url?: string;
    contractId?: string;
    startDate?: string;
    endDate?: string;
    totalProfits?: number;
    support_phone?: string;
}

// Security Parameters
export interface SecurityEmailParams extends BaseEmailParams {
    otp_code?: string;
    ipAddress?: string;
    activityType?: string;
    date?: string;
    old_email?: string;
    new_email?: string;
    updatedFields?: string;
}

// Admin Notification Parameters
export interface AdminNotificationParams extends BaseEmailParams {
    userName: string;
    userEmail?: string;
    email?: string;
    activityType?: string;
    amount?: number;
    transactionId?: string;
    contractId?: string;
    duration?: number;
    rate?: number;
    startDate?: string;
    details?: Record<string, any>;
    date?: string;
    reason?: string;
}

// System Parameters
export interface SystemEmailParams extends BaseEmailParams {
    message: string;
    actionUrl?: string;
    actionText?: string;
}

export type EmailParams =
    | TransactionEmailParams
    | SecurityEmailParams
    | AdminNotificationParams
    | SystemEmailParams;
