import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPaymentBatches, getPaymentBatchItems, generateWithdrawalBatch, processPaymentBatch, PaymentBatch, PaymentBatchItem } from "@/services/accountingService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Plus, CheckCircle, FileText, ChevronDown, ChevronRight } from "lucide-react";

const PaymentSchedulerPage = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(null);
    const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
    const [proofUrl, setProofUrl] = useState('');
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

    const { data: batches, isLoading: isLoadingBatches } = useQuery({
        queryKey: ["paymentBatches"],
        queryFn: getPaymentBatches,
    });

    const generateMutation = useMutation({
        mutationFn: generateWithdrawalBatch,
        onSuccess: (newBatchId) => {
            if (newBatchId) {
                toast({
                    title: "Lot généré",
                    description: "Un nouveau lot de paiements a été créé avec succès.",
                });
                queryClient.invalidateQueries({ queryKey: ["paymentBatches"] });
            } else {
                toast({
                    title: "Aucun paiement",
                    description: "Aucun retrait en attente à traiter.",
                    variant: "default",
                });
            }
        },
        onError: (error) => {
            toast({
                title: "Erreur",
                description: "Impossible de générer le lot : " + error.message,
                variant: "destructive",
            });
        },
    });

    const processMutation = useMutation({
        mutationFn: ({ batchId, proof }: { batchId: string, proof?: string }) =>
            processPaymentBatch(batchId, proof),
        onSuccess: () => {
            toast({
                title: "Lot traité",
                description: "Le lot a été marqué comme payé et les transactions mises à jour.",
            });
            setIsProcessDialogOpen(false);
            setSelectedBatch(null);
            queryClient.invalidateQueries({ queryKey: ["paymentBatches"] });
            queryClient.invalidateQueries({ queryKey: ["paymentBatchItems"] });
        },
        onError: (error) => {
            toast({
                title: "Erreur",
                description: "Erreur lors du traitement : " + error.message,
                variant: "destructive",
            });
        },
    });

    const handleGenerate = () => {
        generateMutation.mutate();
    };

    const handleProcess = () => {
        if (selectedBatch) {
            processMutation.mutate({ batchId: selectedBatch.id, proof: proofUrl });
        }
    };

    const toggleExpand = (batchId: string) => {
        if (expandedBatchId === batchId) {
            setExpandedBatchId(null);
        } else {
            setExpandedBatchId(batchId);
        }
    };

    return (
        <div className="p-8 space-y-8 neon-grid-bg min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-text-primary mb-2">Planificateur de Paiements</h1>
                    <p className="text-muted-foreground">Gérez les cycles de paiement hebdomadaires.</p>
                </div>
                <Button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                >
                    {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Générer Lot de Paiement
                </Button>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border">
                <CardHeader>
                    <CardTitle>Historique des Lots</CardTitle>
                    <CardDescription>Liste des lots de paiements générés et leur statut.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingBatches ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : batches && batches.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Numéro de Lot</TableHead>
                                    <TableHead>Date Création</TableHead>
                                    <TableHead>Montant Total</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {batches.map((batch) => (
                                    <React.Fragment key={batch.id}>
                                        <TableRow className={expandedBatchId === batch.id ? "bg-muted/50" : ""}>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => toggleExpand(batch.id)}>
                                                    {expandedBatchId === batch.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="font-medium">{batch.batch_number}</TableCell>
                                            <TableCell>{new Date(batch.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-bold">{formatCurrency(batch.total_amount)}</TableCell>
                                            <TableCell>
                                                <Badge variant={batch.status === 'paid' ? 'default' : 'secondary'} className={batch.status === 'paid' ? 'bg-green-500 hover:bg-green-600' : ''}>
                                                    {batch.status === 'paid' ? 'Payé' : 'En Attente'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {batch.status !== 'paid' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedBatch(batch);
                                                            setIsProcessDialogOpen(true);
                                                        }}
                                                    >
                                                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                                        Marquer Payé
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        {expandedBatchId === batch.id && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="p-0">
                                                    <BatchDetails batchId={batch.id} />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Aucun lot de paiement trouvé. Cliquez sur "Générer" pour commencer.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmer le Paiement</DialogTitle>
                        <DialogDescription>
                            Vous êtes sur le point de marquer le lot <strong>{selectedBatch?.batch_number}</strong> comme payé.
                            Cela mettra à jour toutes les transactions incluses et enverra les notifications aux utilisateurs.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="proof">Preuve de Paiement (Optionnel)</Label>
                            <Input
                                id="proof"
                                placeholder="URL de la preuve (ex: lien vers bordereau)"
                                value={proofUrl}
                                onChange={(e) => setProofUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Si vous avez effectué un virement groupé, vous pouvez coller le lien ici.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleProcess} disabled={processMutation.isPending}>
                            {processMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmer le Paiement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const BatchDetails = ({ batchId }: { batchId: string }) => {
    const { data: items, isLoading } = useQuery({
        queryKey: ["paymentBatchItems", batchId],
        queryFn: () => getPaymentBatchItems(batchId),
    });

    if (isLoading) return <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /> Chargement des détails...</div>;

    return (
        <div className="bg-muted/30 p-4 rounded-b-lg border-t border-border">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Détails des transactions
            </h4>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-xs">Utilisateur</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs text-right">Montant</TableHead>
                        <TableHead className="text-xs">Statut</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items?.map((item) => (
                        <TableRow key={item.id} className="border-0 hover:bg-transparent">
                            <TableCell className="py-1 text-sm">{item.user_name || 'Inconnu'}</TableCell>
                            <TableCell className="py-1 text-sm text-muted-foreground">{item.user_email}</TableCell>
                            <TableCell className="py-1 text-sm text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                            <TableCell className="py-1 text-sm">
                                <Badge variant="outline" className="text-xs">{item.status}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default PaymentSchedulerPage;
