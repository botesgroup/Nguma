/**
 * Service pour récupérer les paramètres de sécurité
 */

import { supabase } from '@/integrations/supabase/client';

export interface SecuritySettings {
    twoFactorMandatoryForAdmins: boolean;
    twoFactorSetupDeadlineDays: number;
    backupCodesEnabled: boolean;
    loginAuditEnabled: boolean;
    maxLoginAttempts: number;
    loginLockoutMinutes: number;
    sessionTimeoutMinutes: number;
    requireEmailVerification: boolean;
}

let cachedSettings: SecuritySettings | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère les paramètres de sécurité (avec cache)
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
    const now = Date.now();

    // Return cached if still valid
    if (cachedSettings && (now - lastFetchTime) < CACHE_DURATION) {
        return cachedSettings;
    }

    try {
        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .eq('category', 'security');

        if (error) {
            console.error('Error fetching security settings:', error);
            return getDefaultSettings();
        }

        const settingsMap = new Map(data?.map(s => [s.key, s.value]) || []);

        cachedSettings = {
            twoFactorMandatoryForAdmins: settingsMap.get('2fa_mandatory_for_admins') === 'true',
            twoFactorSetupDeadlineDays: parseInt(settingsMap.get('2fa_setup_deadline_days') || '7'),
            backupCodesEnabled: settingsMap.get('backup_codes_enabled') === 'true',
            loginAuditEnabled: settingsMap.get('login_audit_enabled') === 'true',
            maxLoginAttempts: parseInt(settingsMap.get('max_login_attempts') || '5'),
            loginLockoutMinutes: parseInt(settingsMap.get('login_lockout_minutes') || '30'),
            sessionTimeoutMinutes: parseInt(settingsMap.get('session_timeout_minutes') || '1440'),
            requireEmailVerification: settingsMap.get('require_email_verification') === 'true',
        };

        lastFetchTime = now;
        return cachedSettings;
    } catch (err) {
        console.error('Exception fetching security settings:', err);
        return getDefaultSettings();
    }
}

/**
 * Paramètres par défaut (fallback)
 */
function getDefaultSettings(): SecuritySettings {
    return {
        twoFactorMandatoryForAdmins: true,
        twoFactorSetupDeadlineDays: 7,
        backupCodesEnabled: true,
        loginAuditEnabled: true,
        maxLoginAttempts: 5,
        loginLockoutMinutes: 30,
        sessionTimeoutMinutes: 1440,
        requireEmailVerification: true,
    };
}

/**
 * Invalider le cache (à appeler après modification des settings)
 */
export function invalidateSecuritySettingsCache() {
    cachedSettings = null;
    lastFetchTime = 0;
}
