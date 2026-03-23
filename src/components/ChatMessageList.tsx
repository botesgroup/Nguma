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

interface ChatMessageListProps {
    messages: ChatMessage[];
    onSuggestionClick?: (message: string) => void;
    isTyping?: boolean;
}

// Composant pour afficher un message individuel avec son profil
function MessageItem({ 
    message, 
    isOwnMessage, 
    onSuggestionClick,
    isNextSameSender 
}: { 
    message: ChatMessage; 
    isOwnMessage: boolean;
    onSuggestionClick?: (message: string) => void;
    isNextSameSender: boolean;
}) {
    const isAdmin = message.is_admin;
    const isAi = message.sender_id === '00000000-0000-0000-0000-000000000000';
    
    // Récupérer le profil de l'expéditeur
    const { data: profile } = useQuery({
        queryKey: ['profile', message.sender_id],
        queryFn: async () => {
            if (isAi) return { first_name: 'Assistant', last_name: 'IA', avatar_url: null };
            
            const { data, error } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('id', message.sender_id)
                .single();
            
            if (error) return null;
            return data;
        },
        enabled: !!message.sender_id && !isAi
    });

    const displayName = isAi ? 'Assistant IA' : profile ? `${profile.first_name} ${profile.last_name}` : isAdmin ? 'Support Client' : 'Utilisateur';

    return (
        <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${isNextSameSender ? 'mb-1' : 'mb-4'}`}>
            {/* Avatar */}
            <Avatar className={`h-9 w-9 flex-shrink-0 shadow-sm border transition-transform hover:scale-110 ${isOwnMessage ? 'border-primary/20' : 'border-border/50'}`}>
                {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                    <AvatarFallback className={
                        isAi ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                             : isAdmin ? 'bg-primary text-primary-foreground font-bold' : 'bg-slate-200 text-slate-600 font-bold'
                    }>
                        {isAi ? '🤖' : displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                )}
            </Avatar>

            {/* Message content */}
            <div className={`flex flex-col gap-1 max-w-[85%] md:max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
                {/* Sender Name */}
                {!isOwnMessage && (
                    <span className="text-[11px] font-bold text-muted-foreground/80 px-1 mb-0.5 flex items-center gap-1.5">
                        {displayName}
                        {isAdmin && !isAi && <span className="h-1 w-1 rounded-full bg-primary"></span>}
                        {isAdmin && !isAi && <span className="text-[9px] text-primary uppercase tracking-tighter">Admin</span>}
                    </span>
                )}

                {/* Message bubble */}
                <div
                    className={`relative rounded-2xl px-4 py-2.5 shadow-elegant transition-all duration-300 group ${isOwnMessage
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : isAi
                            ? 'bg-white dark:bg-zinc-900 border border-purple-100/50 dark:border-purple-800/20 text-foreground rounded-tl-sm ring-1 ring-purple-500/5'
                            : 'bg-white dark:bg-zinc-900 text-foreground rounded-tl-sm border border-border/40 shadow-sm'
                        }`}
                >
                    <div className="text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap">
                        {formatMessage(message.message, isAi)}
                    </div>

                    {/* Fichiers attachés */}
                    <MessageAttachments messageId={message.id} />
                    
                    {/* Petit triangle de bulle */}
                    <div className={`absolute top-0 w-2 h-2 ${isOwnMessage ? '-right-1 bg-primary rotate-45' : '-left-1 bg-white dark:bg-zinc-900 border-l border-t border-border/40 rotate-[-45deg]'} ${isAi ? 'border-purple-100/50 dark:border-purple-800/20' : ''}`} />
                </div>

                {/* Timestamp */}
                <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-medium px-1 mt-0.5`}>
                    {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                    {message.read_at && isOwnMessage && (
                        <div className="flex -space-x-1 ml-1">
                            <span className="h-3 w-3 text-blue-500">✓</span>
                            <span className="h-3 w-3 text-blue-500">✓</span>
                        </div>
                    )}
                </div>
            </div>
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
    }, [messages, isTyping]);

    // Si pas de messages, afficher les catégories de suggestions
    if (messages.length === 0) {
        return onSuggestionClick ? (
            <SuggestionCategories onSuggestionClick={onSuggestionClick} />
        ) : null;
    }

    return (
        <ScrollArea className="flex-1 p-4 bg-slate-50/30 dark:bg-transparent">
            <div className="flex flex-col">
                {messages.map((message, index) => {
                    const isOwnMessage = message.sender_id === currentUser?.id;
                    const isNextSameSender = index < messages.length - 1 && messages[index+1].sender_id === message.sender_id;

                    return (
                        <MessageItem 
                            key={message.id} 
                            message={message} 
                            isOwnMessage={isOwnMessage}
                            onSuggestionClick={onSuggestionClick}
                            isNextSameSender={isNextSameSender}
                        />
                    );
                })}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Avatar className="h-9 w-9 flex-shrink-0 shadow-sm">
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">Ng</AvatarFallback>
                        </Avatar>
                        <div className="bg-white dark:bg-zinc-900 border border-border/40 rounded-2xl px-4 py-3 rounded-tl-sm shadow-sm flex items-center">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Élément pour auto-scroll */}
                <div ref={scrollRef} className="h-4" />
            </div>
        </ScrollArea>
    );
}
