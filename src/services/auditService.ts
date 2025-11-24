/**
 * Audit Logging Service
 * Gestion des logs d'audit pour traçabilité des actions sensibles
 */

import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
    id: string;
    user_id?: string;
    user_email?: string;
    user_role?: 'admin' | 'investor';
    action: string;
    entity_type?: string;
    entity_id?: string;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    metadata?: Record<string, any>;
    created_at: string;
}

export interface AuditLogFilters {
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
}

/**
 * Récupère les logs d'audit avec filtres (admin seulement)
 */
export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
    try {
        const { data, error } = await supabase.rpc('get_audit_logs', {
            p_user_id: filters?.userId || null,
            p_action: filters?.action || null,
            p_entity_type: filters?.entityType || null,
            p_start_date: filters?.startDate || null,
            p_end_date: filters?.endDate || null,
            p_limit: filters?.limit || 100,
        });

        if (error) {
            console.error('Error fetching audit logs:', error);
            throw error;
        }

        return data as AuditLog[];
    } catch (err) {
        console.error('Exception fetching audit logs:', err);
        throw err;
    }
}

/**
 * Logger manuellement une action (pour actions non couvertes par triggers)
 * Utilise la fonction SQL log_audit_action
 */
export async function logAuditAction(
    action: string,
    entityType?: string,
    entityId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>
): Promise<string> {
    try {
        const { data, error } = await supabase.rpc('log_audit_action', {
            p_action: action,
            p_entity_type: entityType || null,
            p_entity_id: entityId || null,
            p_old_values: oldValues ? JSON.stringify(oldValues) : null,
            p_new_values: newValues ? JSON.stringify(newValues) : null,
            p_metadata: metadata ? JSON.stringify(metadata) : null,
        });

        if (error) {
            console.error('Error logging audit action:', error);
            throw error;
        }

        return data as string; // Retourne l'ID du log créé
    } catch (err) {
        console.error('Exception logging audit action:', err);
        throw err;
    }
}

/**
 * Formate une action pour affichage
 */
export function formatAuditAction(action: string): string {
    const actionMap: Record<string, string> = {
        'auth.login': '🔐 Connexion',
        'auth.logout': '🚪 Déconnexion',
        'auth.password_reset': '🔑 Réinitialisation mot de passe',
        'deposit.approve': '✅ Approbation dépôt',
        'deposit.reject': '❌ Rejet dépôt',
        'withdrawal.approve': '✅ Approbation retrait',
        'withdrawal.reject': '❌ Rejet retrait',
        'user.create': '👤 Création utilisateur',
        'user.update': '✏️ Modification utilisateur',
        'user.delete': '🗑️ Suppression utilisateur',
        'user.role_add': '⭐ Ajout rôle',
        'user.role_change': '🔄 Changement rôle',
        'user.role_remove': '➖ Retrait rôle',
        'user.credit': '💰 Crédit utilisateur',
        'contract.create': '📝 Création contrat',
        'contract.cancel': '🚫 Annulation contrat',
        'contract.refund': '💸 Remboursement contrat',
        'contract.complete': '✅ Complétion contrat',
        'setting.update': '⚙️ Modification paramètre',
        'transaction.approve': '✅ Approbation transaction',
        'transaction.reject': '❌ Rejet transaction',
    };

    return actionMap[action] || action;
}

/**
 * Formate une entité pour affichage
 */
export function formatEntityType(entityType?: string): string {
    const typeMap: Record<string, string> = {
        'user': '👤 Utilisateur',
        'transaction': '💳 Transaction',
        'contract': '📄 Contrat',
        'setting': '⚙️ Paramètre',
        'wallet': '💰 Portefeuille',
    };

    return entityType ? (typeMap[entityType] || entityType) : 'N/A';
}

/**
 * Exporte les logs en CSV
 */
export function exportAuditLogsToCSV(logs: AuditLog[]): string {
    const headers = ['Date', 'Utilisateur', 'Rôle', 'Action', ' Type Entité', 'ID Entité'];
    const rows = logs.map(log => [
        new Date(log.created_at).toLocaleString('fr-FR'),
        log.user_email || 'Système',
        log.user_role || 'N/A',
        formatAuditAction(log.action),
        log.entity_type || 'N/A',
        log.entity_id || 'N/A',
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

    return csv;
}

/**
 * Télécharge les logs en fichier CSV
 */
export function downloadAuditLogsCSV(logs: AuditLog[], filename: string = 'audit-logs.csv') {
    const csv = exportAuditLogsToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// LOGIN AUDIT (Phase 3: Security Improvements)
// ============================================================================

export interface LoginAttemptParams {
    email: string;
    success: boolean;
    userId?: string;
    errorMessage?: string;
}

/**
 * Logger une tentative de connexion (succès ou échec)
 * Capture automatiquement l'IP et le User-Agent
 */
export const logLoginAttempt = async ({
    email,
    success,
    userId,
    errorMessage,
}: LoginAttemptParams): Promise<void> => {
    try {
        // Récupérer l'adresse IP du client (via API tierce)
        let ipAddress = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            ipAddress = ipData.ip;
        } catch (ipError) {
            console.warn('Could not fetch IP address:', ipError);
        }

        // Récupérer le User-Agent
        const userAgent = navigator.userAgent;

        // Appeler la fonction RPC pour logger
        const { error } = await supabase.rpc('log_login_attempt', {
            p_email: email,
            p_success: success,
            p_user_id: userId || null,
            p_ip_address: ipAddress,
            p_user_agent: userAgent,
            p_error_message: errorMessage || null,
        });

        if (error) {
            console.error('Failed to log login attempt:', error);
        }
    } catch (err) {
        // Ne pas faire échouer la connexion si le logging échoue
        console.error('Exception while logging login attempt:', err);
    }
};

/**
 * Récupérer les tentatives de connexion échouées récentes pour un email
 * Utile pour le rate limiting complémentaire
 */
export const getRecentFailedLogins = async (
    email: string,
    minutes: number = 30
): Promise<{ count: number; lastAttempt: Date | null }> => {
    try {
        const { data, error } = await supabase.rpc('get_recent_failed_logins', {
            p_email: email,
            p_minutes: minutes,
        });

        if (error) {
            console.error('Failed to get recent failed logins:', error);
            return { count: 0, lastAttempt: null };
        }

        if (data && data.length > 0) {
            return {
                count: parseInt(data[0].attempt_count) || 0,
                lastAttempt: data[0].last_attempt ? new Date(data[0].last_attempt) : null,
            };
        }

        return { count: 0, lastAttempt: null };
    } catch (err) {
        console.error('Exception while getting recent failed logins:', err);
        return { count: 0, lastAttempt: null };
    }
};

