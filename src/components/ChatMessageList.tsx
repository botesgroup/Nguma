import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage } from "@/services/chatService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { SuggestionCategories } from "./SuggestionCategories";
import { FilePreview } from "./FilePreview";
import { getMessageAttachments } from "@/services/fileUploadService";

interface ChatMessageListProps {
    messages: ChatMessage[];
    onSuggestionClick?: (message: string) => void;
    isTyping?: boolean;
}

// Fonction utilitaire pour formater le texte (gras et sauts de ligne)
function formatMessage(text: string, isAi: boolean) {
    return text.split('\\n').map((line, i) => (
        <span key={i} className="block min-h-[1.2em]">
            {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className={isAi ? "font-bold text-purple-600 dark:text-purple-400" : "font-bold"}>{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </span>
    ));
}

// Composant pour afficher les fichiers attachés à un message
function MessageAttachments({ messageId }: { messageId: string }) {
    const { data: attachments, isLoading } = useQuery({
        queryKey: ['message-attachments', messageId],
        queryFn: () => getMessageAttachments(messageId)
    });

    if (isLoading || !attachments || attachments.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 space-y-2">
            {attachments.map((attachment) => (
                <FilePreview key={attachment.id} attachment={attachment} />
            ))}
        </div>
    );
}

export function ChatMessageList({ messages, onSuggestionClick, isTyping = false }: ChatMessageListProps) {
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
                            <Avatar className={`h-8 w-8 flex-shrink-0 shadow-sm border ${isOwnMessage ? 'border-primary/20' : 'border-border/50'}`}>
                                <AvatarFallback className={
                                    message.sender_id === '00000000-0000-0000-0000-000000000000'
                                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                                        : isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                }>
                                    {message.sender_id === '00000000-0000-0000-0000-000000000000' ? '🤖' : isAdmin ? 'A' : 'U'}
                                </AvatarFallback>
                            </Avatar>

                            {/* Message bubble */}
                            <div className={`flex flex-col gap-1 max-w-[80%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                                {/* Badge IA si message généré par l'IA */}
                                {message.sender_id === '00000000-0000-0000-0000-000000000000' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-semibold px-2 py-0.5 rounded-full mb-0.5">
                                        🤖 Réponse automatisée
                                    </span>
                                )}
                                <div
                                    className={`rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 ${isOwnMessage
                                        ? 'bg-gradient-to-tr from-primary to-primary/90 text-primary-foreground rounded-tr-sm shadow-primary/20'
                                        : message.sender_id === '00000000-0000-0000-0000-000000000000'
                                            ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border border-purple-100/50 dark:border-purple-800/30 text-zinc-800 dark:text-zinc-100 rounded-tl-sm'
                                            : 'bg-muted text-foreground rounded-tl-sm border border-border/50'
                                        }`}
                                >
                                    <div className="text-[15px] leading-relaxed break-words">
                                        {formatMessage(message.message, message.sender_id === '00000000-0000-0000-0000-000000000000')}
                                    </div>

                                    {/* Fichiers attachés */}
                                    <MessageAttachments messageId={message.id} />
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

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground">A</AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-2xl px-4 py-3 rounded-tl-sm">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Élément pour auto-scroll */}
                <div ref={scrollRef} />
            </div>
        </ScrollArea>
    );
}
