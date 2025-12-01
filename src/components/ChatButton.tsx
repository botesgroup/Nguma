import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChatWindow } from "./ChatWindow";
import { getUnreadCount } from "@/services/chatService";
import { useQuery } from "@tanstack/react-query";

export function ChatButton() {
    const [isOpen, setIsOpen] = useState(false);

    // Récupérer le nombre de messages non lus
    const { data: unreadCount = 0 } = useQuery({
        queryKey: ['chatUnreadCount'],
        queryFn: getUnreadCount,
        refetchInterval: 10000, // Rafraîchir toutes les 10 secondes
    });

    return (
        <>
            {/* Bouton flottant */}
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    size="lg"
                    className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all relative"
                >
                    {isOpen ? (
                        <X className="h-6 w-6" />
                    ) : (
                        <>
                            <MessageCircle className="h-6 w-6" />
                            {unreadCount > 0 && (
                                <Badge
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-1 text-xs"
                                >
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Badge>
                            )}
                        </>
                    )}
                </Button>
            </div>

            {/* Fenêtre de chat */}
            {isOpen && (
                <ChatWindow onClose={() => setIsOpen(false)} />
            )}
        </>
    );
}
