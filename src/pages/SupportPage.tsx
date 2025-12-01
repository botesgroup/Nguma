import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatMessageInput } from "@/components/ChatMessageInput";
import { getUserConversation, getMessages, sendMessage, markConversationAsRead, subscribeToMessages } from "@/services/chatService";
import type { ChatMessage } from "@/services/chatService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle } from "lucide-react";

export default function SupportPage() {
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const { toast } = useToast();
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Initialiser la conversation et charger les messages
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                const convId = await getUserConversation();
                setConversationId(convId);

                // Charger les messages existants
                const msgs = await getMessages(convId);
                setMessages(msgs);

                // Marquer comme lu
                await markConversationAsRead(convId);

                // S'abonner aux nouveaux messages (Realtime)
                unsubscribeRef.current = subscribeToMessages(convId, (newMessage) => {
                    setMessages(prev => [...prev, newMessage]);
                    // Marquer automatiquement comme lu
                    markConversationAsRead(convId).catch(console.error);
                });
            } catch (error) {
                console.error('Error initializing chat:', error);
                toast({
                    title: "Erreur",
                    description: "Impossible de charger le chat. Veuillez réessayer.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        init();

        // Nettoyer la souscription lors du démontage
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [toast]);

    const handleSendMessage = async (message: string) => {
        if (!conversationId || !message.trim()) return;

        try {
            setSending(true);
            await sendMessage(conversationId, message);
            // Le message sera ajouté via la souscription Realtime
        } catch (error) {
            console.error('Error sending message:', error);
            toast({
                title: "Erreur",
                description: "Impossible d'envoyer le message. Veuillez réessayer.",
                variant: "destructive"
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <MessageCircle className="h-8 w-8" />
                    Support
                </h1>
                <p className="text-muted-foreground mt-2">
                    Contactez notre équipe de support. Nous sommes là pour vous aider.
                </p>
            </div>

            <Card className="h-[calc(100vh-250px)] flex flex-col">
                <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        Conversation
                    </CardTitle>
                    <CardDescription>
                        Envoyez un message à notre équipe et recevez une réponse rapidement
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            <ChatMessageList messages={messages} />
                            <ChatMessageInput
                                onSend={handleSendMessage}
                                disabled={sending}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
