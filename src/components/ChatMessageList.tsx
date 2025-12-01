import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage } from "@/services/chatService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { SuggestionCategories } from "./SuggestionCategories";

interface ChatMessageListProps {
    messages: ChatMessage[];
    onSuggestionClick?: (message: string) => void;
}

// Fonction utilitaire pour formater le texte (gras et sauts de ligne)
function formatMessage(text: string, isAi: boolean) {
    return text.split('\\n').map((line, i) => (
        <span key={i} className="block min-h-[1.2em]">
            {line.split(/(\\*\\*.*?\\*\\*)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className={isAi ? "font-bold text-purple-600 dark:text-purple-400" : "font-bold"}>{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </span>
    ));
}

export function ChatMessageList({ messages, onSuggestionClick }: ChatMessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Récupérer l'utilisateur courant
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        }
    });

    // Auto-scroll vers le bas quand de nouveaux messages arrivent
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Si pas de messages, afficher les catégories de suggestions
    if (messages.length === 0) {
        return onSuggestionClick ? (
            <SuggestionCategories onSuggestionClick={onSuggestionClick} />
        ) : null;
    }

    return (
        <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
                {messages.map((message) => {
                    const isOwnMessage = message.sender_id === currentUser?.id;
                    const isAdmin = message.is_admin;

                    return (
                        <div
                            key={message.id}
                            className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                            {/* Avatar */}
                            <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className={
                                    message.sender_id === '00000000-0000-0000-0000-000000000000'
                                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                                        : isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                }>
                                    {message.sender_id === '00000000-0000-0000-0000-000000000000' ? '🤖' : isAdmin ? 'A' : 'U'}
                                </AvatarFallback>
                            </Avatar>

                            {/* Message bubble */}
                            <div className={`flex flex-col gap-1 max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                                {/* Badge IA si message généré par l'IA */}
                                {message.sender_id === '00000000-0000-0000-0000-000000000000' && (
                                    <span className="text-xs text-purple-500 dark:text-purple-400 font-medium px-1 mb-1">🤖 Réponse automatique</span>
                                )}
                                <div
                                    className={`rounded-2xl px-4 py-2 shadow-sm ${isOwnMessage
                                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                        : message.sender_id === '00000000-0000-0000-0000-000000000000'
                                            ? 'bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 text-zinc-800 dark:text-zinc-100 rounded-tl-sm shadow-sm'
                                            : 'bg-muted text-foreground rounded-tl-sm'
                                        }`}
                                >
                                    <div className="text-sm break-words">
                                        {formatMessage(message.message, message.sender_id === '00000000-0000-0000-0000-000000000000')}
                                    </div>
                                </div>

                                {/* Timestamp */}
                                <span className="text-xs text-muted-foreground px-1">
                                    {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                                    {message.read_at && isOwnMessage && (
                                        <span className="ml-1">✓✓</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Élément pour auto-scroll */}
                <div ref={scrollRef} />
            </div>
        </ScrollArea>
    );
}
