import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatMessageInput } from "@/components/ChatMessageInput";
import {
    getAdminConversations,
    getMessages,
    sendMessage,
    markConversationAsRead,
    closeConversation,
    subscribeToMessages,
    subscribeToConversations
} from "@/services/chatService";
import type { AdminConversation, ChatMessage } from "@/services/chatService";
import { uploadChatFile } from "@/services/fileUploadService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, CheckCircle, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";

export default function AdminSupportPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [conversations, setConversations] = useState<AdminConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | undefined>('open');
    const { toast } = useToast();
    const unsubscribeMessagesRef = useRef<(() => void) | null>(null);
    const unsubscribeConversationsRef = useRef<(() => void) | null>(null);

    // Charger les conversations
    const loadConversations = async () => {
        try {
            const convs = await getAdminConversations(statusFilter);
            setConversations(convs);

            // Si une conversation est passée en paramètre URL, la sélectionner
            const convIdFromUrl = searchParams.get('conversation');
            if (convIdFromUrl && convs.some(c => c.id === convIdFromUrl)) {
                setSelectedConversation(convIdFromUrl);
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

    // Initialiser
    useEffect(() => {
        loadConversations();

        // S'abonner aux changements de conversations (Realtime)
        unsubscribeConversationsRef.current = subscribeToConversations(() => {
            loadConversations();
        });

        return () => {
            if (unsubscribeConversationsRef.current) {
                unsubscribeConversationsRef.current();
            }
        };
    }, [statusFilter]);

    // Charger les messages quand une conversation est sélectionnée
    useEffect(() => {
        if (!selectedConversation) return;

        const loadMessages = async () => {
            try {
                setLoadingMessages(true);
                const msgs = await getMessages(selectedConversation);
                setMessages(msgs);

                // Marquer comme lu
                await markConversationAsRead(selectedConversation);

                // S'abonner aux nouveaux messages
                if (unsubscribeMessagesRef.current) {
                    unsubscribeMessagesRef.current();
                }

                unsubscribeMessagesRef.current = subscribeToMessages(selectedConversation, (newMessage) => {
                    setMessages(prev => [...prev, newMessage]);
                    markConversationAsRead(selectedConversation).catch(console.error);
                });
            } catch (error) {
                console.error('Error loading messages:', error);
                toast({
                    title: "Erreur",
                    description: "Impossible de charger les messages.",
                    variant: "destructive"
                });
            } finally {
                setLoadingMessages(false);
            }
        };

        loadMessages();

        return () => {
            if (unsubscribeMessagesRef.current) {
                unsubscribeMessagesRef.current();
            }
        };
    }, [selectedConversation, toast]);

    const handleSendMessage = async (message: string, files?: File[]) => {
        if (!selectedConversation || (!message.trim() && (!files || files.length === 0))) return;

        try {
            setSending(true);

            // Envoyer le message
            const messageId = await sendMessage(selectedConversation, message);

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
        } catch (error) {
            console.error('Error sending message:', error);
            toast({
                title: "Erreur",
                description: "Impossible d'envoyer le message.",
                variant: "destructive"
            });
        } finally {
            setSending(false);
        }
    };

    const handleCloseConversation = async () => {
        if (!selectedConversation) return;

        try {
            await closeConversation(selectedConversation);
            toast({
                title: "Conversation fermée",
                description: "La conversation a été fermée avec succès."
            });
            loadConversations();
            setSelectedConversation(null);
        } catch (error) {
            console.error('Error closing conversation:', error);
            toast({
                title: "Erreur",
                description: "Impossible de fermer la conversation.",
                variant: "destructive"
            });
        }
    };

    const selectedConvData = conversations.find(c => c.id === selectedConversation);

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <MessageCircle className="h-8 w-8" />
                    Support Chat
                </h1>
                <p className="text-muted-foreground mt-2">
                    Gérez les conversations de support avec les utilisateurs
                </p>
            </div>

            <div className="grid grid-cols-12 gap-6 h-[calc(100vh-220px)]">
                {/* Liste des conversations */}
                <Card className="col-span-4 flex flex-col">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg">Conversations</CardTitle>
                        <CardDescription>
                            {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>

                    <div className="p-4 border-b">
                        <Tabs value={statusFilter || 'all'} onValueChange={(v) => {
                            setStatusFilter(v === 'all' ? undefined : v as 'open' | 'closed');
                            setSelectedConversation(null);
                        }}>
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="all">Toutes</TabsTrigger>
                                <TabsTrigger value="open">Ouvertes</TabsTrigger>
                                <TabsTrigger value="closed">Fermées</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <CardContent className="flex-1 p-0 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-center p-6">
                                <div className="text-muted-foreground">
                                    <p className="font-medium">Aucune conversation</p>
                                    <p className="text-sm mt-1">Les conversations apparaîtront ici</p>
                                </div>
                            </div>
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-2">
                                    {conversations.map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => setSelectedConversation(conv.id)}
                                            className={`w-full p-3 rounded-lg mb-2 text-left transition-colors ${selectedConversation === conv.id
                                                ? 'bg-primary/10 border-2 border-primary'
                                                : 'hover:bg-muted border-2 border-transparent'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-sm">{conv.user_full_name}</span>
                                                {conv.admin_unread_count > 0 && (
                                                    <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-1">
                                                        {conv.admin_unread_count}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-1">{conv.user_email}</p>
                                            {conv.last_message_preview && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {conv.last_message_preview}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <Badge variant={conv.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                                                    {conv.status === 'open' ? 'Ouvert' : 'Fermé'}
                                                </Badge>
                                                {conv.last_message_at && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(conv.last_message_at), {
                                                            addSuffix: true,
                                                            locale: fr
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>

                {/* Zone de conversation */}
                <Card className="col-span-8 flex flex-col">
                    {selectedConversation && selectedConvData ? (
                        <>
                            <CardHeader className="border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{selectedConvData.user_full_name}</CardTitle>
                                        <CardDescription>{selectedConvData.user_email}</CardDescription>
                                    </div>
                                    {selectedConvData.status === 'open' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCloseConversation}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Fermer
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                                {loadingMessages ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <>
                                        <ChatMessageList messages={messages} />
                                        {selectedConvData.status === 'open' && (
                                            <ChatMessageInput
                                                onSend={handleSendMessage}
                                                disabled={sending}
                                            />
                                        )}
                                        {selectedConvData.status === 'closed' && (
                                            <div className="border-t p-4 text-center text-muted-foreground">
                                                <XCircle className="h-6 w-6 mx-auto mb-2" />
                                                <p className="text-sm">Cette conversation est fermée</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-center">
                            <div className="text-muted-foreground">
                                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">Sélectionnez une conversation</p>
                                <p className="text-sm mt-1">Choisissez une conversation pour voir les messages</p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
