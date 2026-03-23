import { useState, useEffect, useRef } from "react";
import { X, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatMessageList } from "./ChatMessageList";
import { ChatMessageInput } from "./ChatMessageInput";
import { ConversationHistory } from "./ConversationHistory";
import { ConversationSelector } from "./ConversationSelector";
import {
    getUserConversations,
    createNewConversation,
    getMessages,
    sendMessage,
    markConversationAsRead,
    subscribeToMessages,
    updateConversationTitle,
    switchToConversation
} from "@/services/chatService";
import type { ChatMessage, ChatConversation } from "@/services/chatService";
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

import { getSettingByKey } from "@/services/settingsService";
import { MessageCircle } from "lucide-react";

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
    const [humanRequested, setHumanRequested] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState<string>('');
    const { toast } = useToast();
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Charger toutes les conversations au démarrage
    useEffect(() => {
        loadConversations();
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const setting = await getSettingByKey('whatsapp_number');
            if (setting?.value) {
                setWhatsappNumber(setting.value);
            }
        } catch (error) {
            console.error('Error loading WhatsApp setting:', error);
        }
    };

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

    const handleSelectConversation = async (id: string) => {
        try {
            // Utiliser la fonction RPC pour basculer vers cette conversation
            await switchToConversation(id);
            setActiveConversationId(id);
            // Sur mobile, cacher l'historique quand on sélectionne une conversation
            if (window.innerWidth < 768) {
                setShowHistory(false);
            }
        } catch (error) {
            console.error('Error switching conversation:', error);
            toast({
                title: "Erreur",
                description: "Impossible de basculer vers cette conversation.",
                variant: "destructive"
            });
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

    const handleSendMessage = async (message: string, files?: File[]) => {
        if (!activeConversationId || (!message.trim() && (!files || files.length === 0))) return;

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
            const messageId = await sendMessage(activeConversationId, message);

            // Upload des fichiers si présents
            if (files && files.length > 0) {
                for (const file of files) {
                    try {
                        await uploadChatFile(file, messageId);
                    } catch (fileError) {
                        console.error('File upload error:', fileError);
                        toast({
                            title: "Avertissement",
                            description: `Impossible d'uploader ${file.name}`,
                            variant: "destructive"
                        });
                    }
                }
            }

            // Générer le titre automatiquement au premier message
            if (isFirstMessage) {
                setTimeout(async () => {
                    await updateConversationTitle(activeConversationId);
                    // Recharger les conversations pour mettre à jour le titre
                    const convs = await getUserConversations();
                    setConversations(convs);
                }, 500);
            }

            // AI moderator has been disabled per user request
            /*
            if (message.trim()) {
                setIsTyping(true);
                setTimeout(async () => {
                    try {
                        const { callChatAI } = await import('@/services/aiChatService');
                        await callChatAI(activeConversationId, message);
                    } catch (aiError) {
                        console.error('AI response error:', aiError);
                    } finally {
                        setIsTyping(false);
                    }
                }, 500);
            }
            */

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
        <Card className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 w-full md:w-[450px] lg:w-[900px] h-full md:h-[600px] lg:h-[750px] md:max-h-[90vh] shadow-premium flex flex-col z-50 overflow-hidden md:rounded-2xl border-0 md:border animate-slide-up transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 border-b flex-shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden hover:bg-primary/10 transition-colors"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col truncate">
                        <CardTitle className="text-base md:text-lg font-bold tracking-tight">Nguma Support</CardTitle>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">En ligne</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 md:gap-2">
                    {whatsappNumber && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full h-8 w-8 md:h-10 md:w-10 transition-all duration-300"
                            onClick={() => window.open(`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`, '_blank')}
                            title="Contacter sur WhatsApp"
                        >
                            <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
                        </Button>
                    )}
                    <div className="hidden lg:block w-64 mr-2">
                        <ConversationSelector
                            conversations={conversations}
                            currentConversationId={activeConversationId}
                            onSelect={handleSelectConversation}
                            onNew={handleNewConversation}
                            loading={loading}
                        />
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onClose}
                        className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full h-8 w-8 md:h-10 md:w-10"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex overflow-hidden min-h-0 relative bg-slate-50/50 dark:bg-zinc-950/50">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
                        <p className="text-sm text-muted-foreground font-medium animate-pulse">Initialisation du support...</p>
                    </div>
                ) : (
                    <>
                        {/* Historique (sidebar sur desktop, plein écran sur mobile) */}
                        <div className={`
                            ${showHistory ? 'flex' : 'hidden'} 
                            md:flex md:w-64 lg:w-72 flex-shrink-0 h-full border-r bg-background/40 backdrop-blur-sm
                            transition-all duration-300 ease-in-out
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
                            md:flex flex-1 flex-col min-w-0 h-full bg-transparent
                        `}>
                            <div className="flex-1 overflow-hidden relative">
                                <ChatMessageList
                                    messages={messages}
                                    onSuggestionClick={handleSendMessage}
                                    isTyping={isTyping}
                                />
                            </div>
                            <div className="p-2 md:p-4 bg-background/60 backdrop-blur-md border-t">
                                <ChatMessageInput
                                    onSend={handleSendMessage}
                                    disabled={sending}
                                    aiOnlyMode={!humanRequested && !messages.some(msg => msg.is_admin)}
                                />
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
