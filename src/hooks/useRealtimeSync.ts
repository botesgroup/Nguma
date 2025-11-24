import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook personnalisé pour synchroniser les données en temps réel avec Supabase
 * @param table - Nom de la table Supabase à écouter
 * @param filter - Filtre optionnel (ex: "user_id=eq.123")
 * @param queriesToInvalidate - Liste des queryKeys React Query à invalider
 * @param enabled - Active/désactive le listener (par défaut: true)
 */
export function useRealtimeSync(
    table: string,
    filter: string | undefined,
    queriesToInvalidate: string[],
    enabled: boolean = true
) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!enabled || !table || queriesToInvalidate.length === 0) {
            return;
        }

        const channelName = `realtime-${table}${filter ? `-${filter}` : ''}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                    ...(filter && { filter }),
                },
                (payload) => {
                    console.log(`🔄 Realtime update on ${table}:`, payload);

                    // Invalider toutes les queries spécifiées
                    queriesToInvalidate.forEach((queryKey) => {
                        queryClient.invalidateQueries({ queryKey: [queryKey] });
                    });
                }
            )
            .on('system', { event: 'join' }, () => {
                console.log(`✅ Realtime connected: ${channelName}`);
            })
            .on('system', { event: 'leave' }, () => {
                console.warn(`⚠️ Realtime disconnected: ${channelName}`);
            })
            .subscribe();

        // Cleanup lors du démontage du composant
        return () => {
            console.log(`🔌 Unsubscribing from ${channelName}`);
            supabase.removeChannel(channel);
        };
    }, [table, filter, queriesToInvalidate, enabled, queryClient]);
}

/**
 * Hook spécifique pour synchroniser les transactions d'un utilisateur
 */
export function useUserTransactionsRealtime(userId: string | undefined) {
    useRealtimeSync(
        'transactions',
        userId ? `user_id=eq.${userId}` : undefined,
        ['recentTransactions', 'wallets'],
        !!userId
    );
}

/**
 * Hook spécifique pour synchroniser les contrats d'un utilisateur
 */
export function useUserContractsRealtime(userId: string | undefined) {
    useRealtimeSync(
        'contracts',
        userId ? `user_id=eq.${userId}` : undefined,
        ['contracts'],
        !!userId
    );
}

/**
 * Hook spécifique pour synchroniser les profits d'un utilisateur
 */
export function useUserProfitsRealtime(userId: string | undefined) {
    useRealtimeSync(
        'profits',
        userId ? `user_id=eq.${userId}` : undefined,
        ['profits'],
        !!userId
    );
}

/**
 * Hook spécifique pour synchroniser les notifications d'un utilisateur
 */
export function useUserNotificationsRealtime(userId: string | undefined) {
    useRealtimeSync(
        'notifications',
        userId ? `user_id=eq.${userId}` : undefined,
        ['notifications'],
        !!userId
    );
}

/**
 * Hook pour synchroniser les dépôts en attente (Admin)
 */
export function usePendingDepositsRealtime() {
    useRealtimeSync(
        'transactions',
        `status=eq.pending&type=eq.deposit`,
        ['pendingDeposits', 'adminStats'],
        true
    );
}

/**
 * Hook pour synchroniser les retraits en attente (Admin)
 */
export function usePendingWithdrawalsRealtime() {
    useRealtimeSync(
        'transactions',
        `status=eq.pending&type=eq.withdrawal`,
        ['pendingWithdrawals', 'adminStats'],
        true
    );
}

/**
 * Hook pour synchroniser les remboursements en attente (Admin)
 */
export function usePendingRefundsRealtime() {
    useRealtimeSync(
        'contracts',
        `status=eq.refund_requested`,
        ['pendingRefunds', 'adminStats'],
        true
    );
}
