import { useState, useEffect, useRef } from "react";
import { X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatMessageList } from "./ChatMessageList";
import { ChatMessageInput } from "./ChatMessageInput";
import { ConversationHistory } from "./ConversationHistory";
import {
    getUserConversations,
    createNewConversation,
    getMessages,
    sendMessage,
    markConversationAsRead,
    subscribeToMessages,
    updateConversationTitle
} from "@/services/chatService";
import type { ChatMessage, ChatConversation } from "@/services/chatService";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ChatWindowProps {
    onClose: () => void;
}

export function ChatWindow({ onClose }: ChatWindowProps) {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [humanRequested, setHumanRequested] = useState(false); // Tracker si l'utilisateur a demandé un humain
    const { toast } = useToast();
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Charger toutes les conversations au démarrage
    useEffect(() => {
        loadConversations();
    }, []);

    // Charger les messages quand la conversation active change
    useEffect(() => {
        if (activeConversationId) {
            loadMessages(activeConversationId);
        }
    }, [activeConversationId]);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const convs = await getUserConversations();
            setConversations(convs);

            // Si aucune conversation, en créer une
            if (convs.length === 0) {
                const newId = await createNewConversation();
                setActiveConversationId(newId);
                setConversations([...convs, await getConversationById(newId)]);
            } else {
                // Sélectionner la plus récente
                setActiveConversationId(convs[0].id);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            toast({
                title: "Erreur",
                description: "Impossible de charger les conversations.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            // Nettoyer l'ancienne souscription
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }

            // Charger les messages
            const msgs = await getMessages(conversationId);
            setMessages(msgs);

            // Reset humanRequested pour la nouvelle conversation
            setHumanRequested(false);

            // Marquer comme lu
            await markConversationAsRead(conversationId);

            // S'abonner aux nouveaux messages
            unsubscribeRef.current = subscribeToMessages(conversationId, (newMessage) => {
                setMessages(prev => [...prev, newMessage]);
                markConversationAsRead(conversationId).catch(console.error);

                // Mettre à jour la conversation dans la liste
                setConversations(prev =>
                    prev.map(c =>
                        c.id === conversationId
                            ? { ...c, last_message_at: newMessage.created_at, user_unread_count: 0 }
                            : c
                    )
                );
            });
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    const getConversationById = async (id: string): Promise<ChatConversation> => {
        const convs = await getUserConversations();
        return convs.find(c => c.id === id)!;
    };

    const handleSelectConversation = (id: string) => {
        setActiveConversationId(id);
        // Sur mobile, cacher l'historique quand on sélectionne une conversation
        if (window.innerWidth < 768) {
            setShowHistory(false);
        }
    };

    const handleNewConversation = async () => {
        try {
            const newId = await createNewConversation();
            const newConv = await getConversationById(newId);
            setConversations(prev => [newConv, ...prev]);
            setActiveConversationId(newId);
            setMessages([]);

            // Sur mobile, passer à la vue chat
            if (window.innerWidth < 768) {
                setShowHistory(false);
            }
        } catch (error) {
            console.error('Error creating conversation:', error);
            toast({
                title: "Erreur",
                description: "Impossible de créer une nouvelle conversation.",
                variant: "destructive"
            });
        }
    };

    const handleSendMessage = async (message: string) => {
        if (!activeConversationId || !message.trim()) return;

        try {
            setSending(true);

            // Détecter si l'utilisateur demande à parler à un humain
            const humanKeywords = ['parler à un conseiller', 'conseiller humain', 'agent humain', 'parler à un humain'];
            if (humanKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
                setHumanRequested(true);
            }

            // Vérifier si c'est le premier message de la conversation (pour générer le titre)
            const isFirstMessage = messages.length === 0;

            // Envoyer le message
            await sendMessage(activeConversationId, message);

            // Générer le titre automatiquement au premier message
            if (isFirstMessage) {
                setTimeout(async () => {
                    await updateConversationTitle(activeConversationId);
                    // Recharger les conversations pour mettre à jour le titre
                    const convs = await getUserConversations();
                    setConversations(convs);
                }, 500);
            }

            // Appeler l'IA après un court délai
            setTimeout(async () => {
                try {
                    const { callChatAI } = await import('@/services/aiChatService');
                    await callChatAI(activeConversationId, message);
                } catch (aiError) {
                    console.error('AI response error:', aiError);
                }
            }, 500);

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

    // Nettoyer la souscription au démontage
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    return (
        <Card className="fixed bottom-4 right-4 w-full md:w-[800px] h-[650px] shadow-2xl flex flex-col z-50 overflow-hidden">
            <CardHeader className="flex-row items-center justify-between p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                    {/* Bouton Menu (mobile uniquement) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-lg">Support Chat</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex overflow-hidden min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {/* Historique (sidebar sur desktop, plein écran sur mobile) */}
                        <div className={`
                            ${showHistory ? 'flex' : 'hidden'} 
                            md:flex md:w-72 flex-shrink-0 h-full
                        `}>
                            <ConversationHistory
                                conversations={conversations}
                                activeConversationId={activeConversationId}
                                onSelectConversation={handleSelectConversation}
                                onNewConversation={handleNewConversation}
                            />
                        </div>

                        {/* Zone de chat */}
                        <div className={`
                            ${!showHistory ? 'flex' : 'hidden'} 
                            md:flex flex-1 flex-col min-w-0 h-full
                        `}>
                            <ChatMessageList
                                messages={messages}
                                onSuggestionClick={handleSendMessage}
                            />
                            <ChatMessageInput
                                onSend={handleSendMessage}
                                disabled={sending}
                                aiOnlyMode={!humanRequested && !messages.some(msg => msg.is_admin)}
                            />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
