import { supabase } from "@/integrations/supabase/client";

/**
 * Appelle l'Edge Function chat-ai pour obtenir une réponse automatique
 * @param conversationId ID de la conversation
 * @param message Le message de l'utilisateur
 * @returns La réponse de l'IA ou null si escalade vers admin
 */
export const callChatAI = async (conversationId: string, message: string): Promise<{
    shouldEscalate: boolean;
    reply?: string;
    confidence?: number;
}> => {
    try {
        const { data, error } = await supabase.functions.invoke('chat-ai', {
            body: { conversationId, message }
        });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error calling chat AI:', error);
        // En cas d'erreur, on laisse l'admin répondre
        return { shouldEscalate: true };
    }
};
