
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingDeposits, approveDeposit, rejectDeposit, approveDepositsInBulk, rejectDepositsInBulk } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdjustDepositDialog } from "./AdjustDepositDialog";
import { usePendingDepositsRealtime } from "@/hooks/useRealtimeSync";

type ActionType = "approve" | "reject";

interface DialogState {
  isOpen: boolean;
  action?: ActionType;
  transactionId?: string;
}

type SelectedDeposit = { id: string; amount: number; userEmail: string; };

interface PendingDeposit {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  method: string;
  payment_reference?: string;
  payment_phone_number?: string;
  proof_url?: string;
  profile?: {
    full_name?: string;
    email?: string;
  };
}

export const PendingDeposits = () => {
  // Enable Realtime synchronization for pending deposits
  usePendingDepositsRealtime();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false });
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRejectDialogOpen, setIsBulkRejectDialogOpen] = useState(false);
  const [isAdjustDepositOpen, setIsAdjustDepositOpen] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<SelectedDeposit | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  const { data: deposits, isLoading } = useQuery({
    queryKey: ["pendingDeposits"],
    queryFn: async () => {
      const data = await getPendingDeposits();
      return data as unknown as PendingDeposit[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveDeposit,
    onSuccess: () => {
      toast({ title: "Succès", description: "Dépôt approuvé." });
      queryClient.invalidateQueries({ queryKey: ['pendingDeposits', 'notifications', 'wallets', 'recentTransactions', 'adminStats'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => closeDialog(),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => rejectDeposit(transactionId, reason),
    onSuccess: () => {
      toast({ title: "Succès", description: "Dépôt rejeté." });
      queryClient.invalidateQueries({ queryKey: ['pendingDeposits', 'notifications', 'adminStats'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => closeDialog(),
  });

  const approveBulkMutation = useMutation({
    mutationFn: approveDepositsInBulk,
    onSuccess: (data) => {
      toast({ title: "Succès", description: `${data.approved_count} dépôt(s) approuvé(s).` });
      queryClient.invalidateQueries({ queryKey: ['pendingDeposits', 'notifications', 'wallets', 'recentTransactions', 'adminStats'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => setSelectedIds([]),
  });

  const rejectBulkMutation = useMutation({
    mutationFn: ({ transactionIds, reason }: { transactionIds: string[]; reason: string }) => rejectDepositsInBulk(transactionIds, reason),
    onSuccess: (data) => {
      toast({ title: "Succès", description: `${data.rejected_count} dépôt(s) rejeté(s).` });
      queryClient.invalidateQueries({ queryKey: ['pendingDeposits', 'notifications', 'adminStats'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => {
      setSelectedIds([]);
      setIsBulkRejectDialogOpen(false);
      setRejectionReason("");
    },
  });

  const openDialog = (action: ActionType, transactionId: string) => setDialogState({ isOpen: true, action, transactionId });
  const closeDialog = () => setDialogState({ isOpen: false });

  const handleConfirmSingleAction = () => {
    if (!dialogState.transactionId || !dialogState.action) return;
    if (dialogState.action === "approve") {
      approveMutation.mutate(dialogState.transactionId);
    } else if (dialogState.action === "reject") {
      if (!rejectionReason.trim()) {
        toast({ variant: "destructive", title: "Erreur", description: "La raison du rejet est obligatoire." });
        return;
      }
      rejectMutation.mutate({ transactionId: dialogState.transactionId, reason: rejectionReason });
    }
  };

  const handleConfirmBulkReject = () => {
    if (!rejectionReason.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "La raison du rejet est obligatoire." });
      return;
    }
    rejectBulkMutation.mutate({ transactionIds: selectedIds, reason: rejectionReason });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(deposits?.map(d => d.id) || []);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copié!", description: "La preuve de paiement a été copiée dans le presse-papiers." });
    });
  };

  const isActionPending = approveMutation.isPending || rejectMutation.isPending || approveBulkMutation.isPending || rejectBulkMutation.isPending;
  const numSelected = selectedIds.length;
  const allDeposits = deposits || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Dépôts en Attente</CardTitle>
          <CardDescription>Approuvez, rejetez ou ajustez les dépôts pour créditer les comptes des utilisateurs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"><Checkbox checked={numSelected > 0 && numSelected === allDeposits.length} onCheckedChange={handleSelectAll} aria-label="Select all" /></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Preuve</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center">Chargement...</TableCell></TableRow>
                ) : allDeposits.length > 0 ? (
                  allDeposits.map((deposit) => (
                    <TableRow key={deposit.id} data-state={selectedIds.includes(deposit.id) && "selected"}>
                      <TableCell><Checkbox checked={selectedIds.includes(deposit.id)} onCheckedChange={(checked) => handleSelectRow(deposit.id, !!checked)} aria-label="Select row" /></TableCell>
                      <TableCell>{format(new Date(deposit.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{deposit.profile?.full_name || "Nom non défini"}</div>
                        <div className="text-sm text-muted-foreground">{deposit.profile?.email}</div>
                      </TableCell>
                      <TableCell className="capitalize">{deposit.method?.replace(/_/g, ' ')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{deposit.payment_reference || deposit.payment_phone_number || "N/A"}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(deposit.payment_reference || deposit.payment_phone_number || "")}><Copy className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {deposit.proof_url ? (
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedProofUrl(deposit.proof_url); setProofModalOpen(true); }}>
                            Voir l'image
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucune</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(deposit.amount), deposit.currency)}</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Ouvrir le menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDialog("approve", deposit.id)}>Approuver</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("reject", deposit.id)}>Rejeter</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setSelectedDeposit({ id: deposit.id, amount: Number(deposit.amount), userEmail: deposit.profile?.email || 'N/A' }); setIsAdjustDepositOpen(true); }}>
                              Ajuster le montant
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <div className="text-center py-16 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg m-4">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-2xl font-semibold mb-2 text-green-900">
                          Tous les dépôts traités !
                        </h3>
                        <p className="text-muted-foreground">
                          Aucun dépôt en attente de validation
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground">{numSelected} sur {allDeposits.length} ligne(s) sélectionnée(s).</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => approveBulkMutation.mutate(selectedIds)} disabled={numSelected === 0 || isActionPending}>Approuver la sélection</Button>
            <Button variant="destructive" size="sm" onClick={() => setIsBulkRejectDialogOpen(true)} disabled={numSelected === 0 || isActionPending}>Rejeter la sélection</Button>
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>{dialogState.action === "approve" ? "Cette action créditera le portefeuille de l'utilisateur. Cette action est irréversible." : "Cette action rejettera la demande de dépôt. L'utilisateur en sera notifié."}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialogState.action === "reject" && (<div className="grid gap-2 py-4"><Label htmlFor="reason">Raison du rejet</Label><Input id="reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ex: Preuve de paiement invalide" /></div>)}
          <AlertDialogFooter><AlertDialogCancel onClick={closeDialog} disabled={isActionPending}>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleConfirmSingleAction} disabled={isActionPending}>{isActionPending ? "En cours..." : "Confirmer"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkRejectDialogOpen} onOpenChange={setIsBulkRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Rejeter {numSelected} dépôt(s) ?</AlertDialogTitle><AlertDialogDescription>Cette action rejettera toutes les demandes de dépôt sélectionnées. Les utilisateurs en seront notifiés.</AlertDialogDescription></AlertDialogHeader>
          <div className="grid gap-2 py-4"><Label htmlFor="bulk-reason">Raison commune du rejet</Label><Input id="bulk-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ex: Preuve de paiement invalide" /></div>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setIsBulkRejectDialogOpen(false)} disabled={isActionPending}>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleConfirmBulkReject} disabled={isActionPending}>{isActionPending ? "En cours..." : "Confirmer le rejet en masse"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedDeposit && (
        <AdjustDepositDialog
          transactionId={selectedDeposit.id}
          currentAmount={selectedDeposit.amount}
          userEmail={selectedDeposit.userEmail}
          open={isAdjustDepositOpen}
          onOpenChange={setIsAdjustDepositOpen}
        />
      )}

      <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preuve de Paiement</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedProofUrl && (
              <img
                src={selectedProofUrl}
                alt="Preuve de paiement"
                className="max-w-full h-auto rounded-md shadow-sm object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
