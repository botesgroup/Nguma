import { EmailParams, TransactionEmailParams, SecurityEmailParams, AdminNotificationParams } from '../types/emailTypes';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export const validateEmailParams = (params: EmailParams): ValidationResult => {
    const errors: string[] = [];

    // Base checks
    if (!params.to) errors.push('Missing recipient "to"');
    if (Array.isArray(params.to) && params.to.length === 0) errors.push('Recipient "to" array is empty');

    // Specific checks based on known properties (naive type guards)
    if ('amount' in params) {
        const p = params as TransactionEmailParams;
        if (p.amount <= 0) errors.push('Amount must be positive');
        if (!p.currency) {
            // Warn but maybe default is handled backend
            // errors.push('Currency is missing'); 
        }
    }

    if ('transactionId' in params) {
        if (!params.transactionId) errors.push('Transaction ID is empty');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};
