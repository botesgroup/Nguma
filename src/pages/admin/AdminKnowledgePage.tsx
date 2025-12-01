import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trash2, Plus, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KnowledgeDoc {
    id: string;
    title: string;
    content: string;
    category: string | null;
    is_active: boolean;
    created_at: string;
}

const AdminKnowledgePage = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [newDoc, setNewDoc] = useState({ title: "", content: "", category: "" });
    const [isAdding, setIsAdding] = useState(false);

    // Fetch knowledge base documents
    const { data: documents, isLoading } = useQuery({
        queryKey: ["knowledge_base"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("knowledge_base")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as KnowledgeDoc[];
        },
    });

    // Add document mutation
    const addDocMutation = useMutation({
        mutationFn: async (doc: { title: string; content: string; category: string }) => {
            // 1. Insert document
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from("knowledge_base")
                .insert({
                    title: doc.title,
                    content: doc.content,
                    category: doc.category || null,
                    created_by: user?.id,
                    updated_by: user?.id,
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Generate embedding
            const { data: functionUrl } = await supabase.functions.invoke("generate-embedding", {
                body: { id: data.id, content: doc.content },
            });

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
            toast({ title: "✓ Document ajouté avec succès" });
            setNewDoc({ title: "", content: "", category: "" });
            setIsAdding(false);
        },
        onError: (error: any) => {
            toast({
                title: "Erreur",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Delete document mutation
    const deleteDocMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
            toast({ title: "✓ Document supprimé" });
        },
        onError: (error: any) => {
            toast({
                title: "Erreur",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleAddDocument = () => {
        if (!newDoc.title.trim() || !newDoc.content.trim()) {
            toast({
                title: "Erreur",
                description: "Le titre et le contenu sont obligatoires",
                variant: "destructive",
            });
            return;
        }

        addDocMutation.mutate(newDoc);
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                    <BookOpen className="h-8 w-8" />
                    Base de Connaissances (IA)
                </h1>
                <p className="text-muted-foreground">
                    Gérez les documents utilisés par l'IA pour répondre aux questions des utilisateurs
                </p>
            </div>

            {/* Add Document Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Ajouter un Document</CardTitle>
                    <CardDescription>
                        L'IA utilisera ce contenu pour répondre aux questions similaires
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!isAdding ? (
                        <Button onClick={() => setIsAdding(true)} className="w-full">
                            <Plus className="mr-2 h-4 w-4" />
                            Nouveau Document
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="title">Titre</Label>
                                <Input
                                    id="title"
                                    placeholder="Ex: Comment investir ?"
                                    value={newDoc.title}
                                    onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="category">Catégorie (optionnel)</Label>
                                <Input
                                    id="category"
                                    placeholder="Ex: Investissement, Retrait, etc."
                                    value={newDoc.category}
                                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="content">Contenu</Label>
                                <Textarea
                                    id="content"
                                    placeholder="Réponse complète et détaillée..."
                                    rows={6}
                                    value={newDoc.content}
                                    onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={handleAddDocument}
                                    disabled={addDocMutation.isPending}
                                    className="flex-1"
                                >
                                    {addDocMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Enregistrer
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsAdding(false);
                                        setNewDoc({ title: "", content: "", category: "" });
                                    }}
                                    disabled={addDocMutation.isPending}
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Documents List */}
            <div className="grid gap-4">
                <h2 className="text-xl font-semibold">
                    Documents ({documents?.length || 0})
                </h2>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : documents && documents.length > 0 ? (
                    documents.map((doc) => (
                        <Card key={doc.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{doc.title}</CardTitle>
                                        <div className="flex gap-2 mt-2">
                                            {doc.category && (
                                                <Badge variant="secondary">{doc.category}</Badge>
                                            )}
                                            <Badge variant={doc.is_active ? "default" : "destructive"}>
                                                {doc.is_active ? "Actif" : "Inactif"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteDocMutation.mutate(doc.id)}
                                        disabled={deleteDocMutation.isPending}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {doc.content}
                                </p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="text-center py-8 text-muted-foreground">
                            Aucun document. Ajoutez-en un pour commencer !
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default AdminKnowledgePage;
