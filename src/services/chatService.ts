import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type ChatAttachment = Database['public']['Tables']['chat_attachments']['Row'];
export type ChatAnalytics = Database['public']['Tables']['chat_analytics']['Row'];

export interface AdminConversation {
    id: string;
    user_id: string;
    user_email: string;
    user_full_name: string;
    subject: string;
    status: string;
    last_message_at: string | null;
    admin_unread_count: number;
    created_at: string;
    last_message_preview: string | null;
}

export interface SearchResult {
    id: string;
    conversation_id: string;
    sender_id: string;
    message: string;
    is_admin: boolean;
    created_at: string;
    rank: number;
}

/**
 * Récupère ou crée la conversation de l'utilisateur courant
 */
export const getUserConversation = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('get_or_create_user_conversation');

    if (error) throw new Error(error.message);
    return data as string;
};

/**
 * Récupère TOUTES les conversations de l'utilisateur (historique)
 */
export const getUserConversations = async (): Promise<ChatConversation[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);
    return data || [];
};

/**
 * Crée une nouvelle conversation pour l'utilisateur
 * La nouvelle conversation devient automatiquement active et l'ancienne est désactivée
 */
export const createNewConversation = async (title?: string): Promise<string> => {
    const { data, error } = await supabase.rpc('create_new_conversation', {
        p_title: title || null
    });

    if (error) throw new Error(error.message);
    return data as string;
};

/**
 * Met à jour le titre d'une conversation (génération automatique depuis le 1er message)
 */
export const updateConversationTitle = async (conversationId: string): Promise<void> => {
    // Récupérer le premier message de la conversation
    const { data: messages } = await supabase
        .from('chat_messages')
        .select('message')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(1);

    if (!messages || messages.length === 0) return;

    // Générer un titre court (6 premiers mots)
    const firstMessage = messages[0].message;
    const words = firstMessage.split(' ').slice(0, 6).join(' ');
    const title = words.length < firstMessage.length ? words + '...' : words;

    // Mettre à jour
    const { error } = await supabase
        .from('chat_conversations')
        .update({ title })
        .eq('id', conversationId);

    if (error) throw new Error(error.message);
};

/**
 * Récupère toutes les conversations pour les admins
 */
export const getAdminConversations = async (status?: 'open' | 'closed'): Promise<AdminConversation[]> => {
    // 1. Get conversations
    let query = supabase
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data: conversations, error } = await query;

    if (error) throw new Error(error.message);
    if (!conversations) return [];

    // 2. Enrich with user details and last message
    const enrichedConversations: AdminConversation[] = await Promise.all(conversations.map(async (conv) => {
        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', conv.user_id)
            .single();

        // Get last message
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('message')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

        const lastMessage = messages && messages.length > 0 ? messages[0].message : null;
        const fullName = profile
            ? (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.email)
            : 'Utilisateur inconnu';

        return {
            id: conv.id,
            user_id: conv.user_id,
            user_email: profile?.email || 'Email inconnu',
            user_full_name: fullName || 'Inconnu',
            subject: conv.subject || 'Support',
            status: conv.status || 'open',
            last_message_at: conv.last_message_at,
            admin_unread_count: conv.admin_unread_count || 0,
            created_at: conv.created_at || new Date().toISOString(),
            last_message_preview: lastMessage
        };
    }));

    return enrichedConversations;
};

/**
 * Récupère les messages d'une conversation
 */
export const getMessages = async (conversationId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
};

/**
 * Envoie un message dans une conversation
 */
export const sendMessage = async (conversationId: string, message: string): Promise<string> => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
        throw new Error('Le message ne peut pas être vide');
    }

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 2. Check if user is admin
    const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');

    const isAdmin = roles && roles.length > 0;

    // 3. Insert message
    const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            message: trimmedMessage,
            is_admin: isAdmin
        })
        .select()
        .single();

    if (messageError) throw new Error(messageError.message);

    // 4. Update conversation
    // First get current counts to increment them safely
    const { data: conversation } = await supabase
        .from('chat_conversations')
        .select('user_unread_count, admin_unread_count, user_id')
        .eq('id', conversationId)
        .single();

    if (conversation) {
        const updates: any = {
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'open'
        };

        if (isAdmin) {
            updates.user_unread_count = (conversation.user_unread_count || 0) + 1;
        } else {
            updates.admin_unread_count = (conversation.admin_unread_count || 0) + 1;
        }

        await supabase
            .from('chat_conversations')
            .update(updates)
            .eq('id', conversationId);

        // 5. Create Notification
        if (isAdmin) {
            // Get user info to send email
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('id', conversation.user_id)
                .single();

            // Notify User (In app)
            await supabase.from('notifications').insert({
                user_id: conversation.user_id,
                type: 'support',
                priority: 'high',
                message: "Nouveau message de support de l'administration",
                link_to: '/support'
            });

            // Notify User (Email)
            if (userProfile && userProfile.email) {
                const userName = userProfile.first_name && userProfile.last_name 
                    ? `${userProfile.first_name} ${userProfile.last_name}` 
                    : userProfile.email;
                    
                await supabase.from('notifications_queue').insert({
                    recipient_email: userProfile.email,
                    template_id: 'chat_new_message_user',
                    notification_params: {
                        name: userName,
                        conversationId: conversationId,
                        message: trimmedMessage
                    }
                });
            }
        } else {
            // Notify Admins
            // Get sender name
            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', user.id)
                .single();

            const senderName = profile
                ? (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.email)
                : user.email;

            // Get all admin IDs
            const { data: admins } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'admin');

            if (admins && admins.length > 0) {
                // In app notifications
                const notifications = admins.map(admin => ({
                    user_id: admin.user_id,
                    type: 'support',
                    priority: 'medium',
                    message: `Nouveau message de support de ${senderName}`,
                    link_to: `/admin/support?conversation=${conversationId}`
                }));

                await supabase.from('notifications').insert(notifications);

                // Fetch admins emails
                const adminIds = admins.map(a => a.user_id);
                const { data: adminProfiles } = await supabase
                    .from('profiles')
                    .select('email')
                    .in('id', adminIds);

                // Email notifications
                if (adminProfiles && adminProfiles.length > 0) {
                    const emailQueues = adminProfiles
                        .filter(p => p.email)
                        .map(p => ({
                            recipient_email: p.email,
                            template_id: 'chat_new_message_admin',
                            notification_params: {
                                name: senderName,
                                email: profile?.email || user.email,
                                conversationId: conversationId,
                                message: trimmedMessage
                            }
                        }));
                    if (emailQueues.length > 0) {
                        await supabase.from('notifications_queue').insert(emailQueues);
                    }
                }
            }
        }
    }

    return messageData.id;
};

/**
 * Marque une conversation comme lue
 */
export const markConversationAsRead = async (conversationId: string): Promise<void> => {
    const { error } = await supabase.rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId
    });

    if (error) throw new Error(error.message);
};

/**
 * Ferme une conversation (admin seulement)
 */
export const closeConversation = async (conversationId: string): Promise<void> => {
    const { error } = await supabase.rpc('close_conversation', {
        p_conversation_id: conversationId
    });

    if (error) throw new Error(error.message);
};

/**
 * Récupère les détails d'une conversation
 */
export const getConversationDetails = async (conversationId: string): Promise<ChatConversation | null> => {
    const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (error) {
        console.error('Error fetching conversation:', error.message);
        return null;
    }

    return data;
};

/**
 * Souscrit aux nouveaux messages d'une conversation (Realtime)
 */
export const subscribeToMessages = (
    conversationId: string,
    callback: (message: ChatMessage) => void
) => {
    const channel = supabase
        .channel(`chat_messages:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                callback(payload.new as ChatMessage);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Souscrit aux changements de conversations (Realtime) - Pour admin
 */
export const subscribeToConversations = (
    callback: (conversation: ChatConversation) => void
) => {
    const channel = supabase
        .channel('chat_conversations')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'chat_conversations'
            },
            (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    callback(payload.new as ChatConversation);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Récupère le nombre de messages non lus pour l'utilisateur
 */
export const getUnreadCount = async (): Promise<number> => {
    try {
        const conversationId = await getUserConversation();
        const details = await getConversationDetails(conversationId);
        return details?.user_unread_count || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};

/**
 * Récupère le nombre total de messages non lus pour tous les admins
 */
export const getAdminUnreadCount = async (): Promise<number> => {
    const { data, error } = await supabase
        .from('chat_conversations')
        .select('admin_unread_count')
        .eq('status', 'open');

    if (error) {
        console.error('Error getting admin unread count:', error.message);
        return 0;
    }

    return (data || []).reduce((sum, conv) => sum + (conv.admin_unread_count || 0), 0);
};

/**
 * Bascule vers une conversation existante (la rend active)
 * @param conversationId ID de la conversation
 */
export const switchToConversation = async (conversationId: string): Promise<void> => {
    const { error } = await supabase.rpc('switch_to_conversation', {
        p_conversation_id: conversationId
    });

    if (error) throw new Error(error.message);
};

/**
 * Recherche dans les messages de l'utilisateur (full-text)
 * @param query Texte à rechercher
 * @param limit Nombre maximum de résultats
 * @returns Résultats de recherche triés par pertinence
 */
export const searchMessages = async (query: string, limit: number = 50): Promise<SearchResult[]> => {
    if (!query.trim()) return [];

    const { data, error } = await supabase.rpc('search_chat_messages', {
        p_query: query.trim(),
        p_limit: limit
    });

    if (error) {
        console.error('Error searching messages:', error);
        throw new Error(error.message);
    }

    return data as SearchResult[] || [];
};

/**
 * Enregistre les métriques analytics pour une conversation
 * @param conversationId ID de la conversation
 * @param analytics Données analytics
 */
export const trackAnalytics = async (
    conversationId: string,
    analytics: Partial<Omit<ChatAnalytics, 'id' | 'conversation_id' | 'created_at'>>
): Promise<void> => {
    const { error } = await supabase
        .from('chat_analytics')
        .upsert({
            conversation_id: conversationId,
            ...analytics
        }, {
            onConflict: 'conversation_id'
        });

    if (error) {
        console.error('Error tracking analytics:', error);
        // Ne pas throw l'erreur pour ne pas bloquer le flux principal
    }
};

/**
 * Récupère les analytics d'une conversation
 * @param conversationId ID de la conversation
 * @returns Données analytics ou null
 */
export const getConversationAnalytics = async (conversationId: string): Promise<ChatAnalytics | null> => {
    const { data, error } = await supabase
        .from('chat_analytics')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

    if (error) {
        console.error('Error fetching analytics:', error);
        return null;
    }

    return data;
};

