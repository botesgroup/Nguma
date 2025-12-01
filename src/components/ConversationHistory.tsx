import { ChatConversation } from "@/services/chatService";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageCircle, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";

interface ConversationHistoryProps {
    conversations: ChatConversation[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewConversation: () => void;
}

export function ConversationHistory({
    conversations,
    activeConversationId,
    onSelectConversation,
    onNewConversation
}: ConversationHistoryProps) {

    // Grouper les conversations par date
    const groupedConversations = groupByDate(conversations);

    return (
        <div className="flex flex-col h-full border-r bg-card">
            {/* Header avec bouton nouvelle conversation */}
            <div className="p-4 border-b">
                <Button
                    onClick={onNewConversation}
                    className="w-full"
                    variant="default"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle conversation
                </Button>
            </div>

            {/* Liste des conversations */}
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {Object.entries(groupedConversations).map(([dateLabel, convs]) => (
                        <div key={dateLabel} className="mb-4">
                            {/* Label de groupe (Aujourd'hui, Hier, etc.) */}
                            <p className="text-xs font-medium text-muted-foreground px-3 py-2">
                                {dateLabel}
                            </p>

                            {/* Conversations du groupe */}
                            {convs.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelectConversation(conv.id)}
                                    className={`
                                        w-full text-left p-3 rounded-lg mb-1 
                                        hover:bg-accent transition-colors
                                        ${activeConversationId === conv.id ? 'bg-accent border-l-2 border-primary' : ''}
                                    `}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <MessageCircle className="w-4 h-4 mt-1 flex-shrink-0 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium truncate">
                                                    {conv.title || 'Conversation'}
                                                </h4>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatTime(conv.last_message_at || conv.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Badge de messages non lus */}
                                        {conv.user_unread_count > 0 && (
                                            <Badge variant="default" className="flex-shrink-0">
                                                {conv.user_unread_count}
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ))}

                    {/* Message si aucune conversation */}
                    {conversations.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">Aucune conversation</p>
                            <p className="text-xs mt-1">Cliquez sur "Nouvelle conversation" pour commencer</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Grouper les conversations par catégorie de date
function groupByDate(conversations: ChatConversation[]): Record<string, ChatConversation[]> {
    const groups: Record<string, ChatConversation[]> = {
        "Aujourd'hui": [],
        "Hier": [],
        "Cette semaine": [],
        "Plus ancien": []
    };

    conversations.forEach(conv => {
        const date = new Date(conv.last_message_at || conv.created_at);

        if (isToday(date)) {
            groups["Aujourd'hui"].push(conv);
        } else if (isYesterday(date)) {
            groups["Hier"].push(conv);
        } else if (isThisWeek(date, { weekStartsOn: 1 })) {
            groups["Cette semaine"].push(conv);
        } else {
            groups["Plus ancien"].push(conv);
        }
    });

    // Retirer les groupes vides
    return Object.fromEntries(
        Object.entries(groups).filter(([_, convs]) => convs.length > 0)
    );
}

// Formater l'heure de manière concise
function formatTime(dateString: string | null): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isToday(date)) {
        return format(date, 'HH:mm', { locale: fr });
    } else if (isYesterday(date)) {
        return 'Hier';
    } else if (isThisWeek(date, { weekStartsOn: 1 })) {
        return format(date, 'EEEE', { locale: fr });
    } else {
        return format(date, 'dd MMM', { locale: fr });
    }
}
