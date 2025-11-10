import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreditUserDialog } from "./CreditUserDialog";

type ActionType = "approve" | "reject";
interface DialogState {
  isOpen: boolean;
  action?: ActionType;
  transactionId?: string;
}
type SelectedUser = { id: string; email: string; };

export const PendingWithdrawals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false });
  const [rejectionReason, setRejectionReason] = useState("");
  const [isCreditUserOpen, setIsCreditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["pendingWithdrawals"],
    queryFn: getPendingWithdrawals,
  });

  const approveMutation = useMutation({
    mutationFn: approveWithdrawal,
    onSuccess: () => {
      toast({ title: "Succès", description: "Retrait approuvé." });
      queryClient.invalidateQueries({ queryKey: ['pendingWithdrawals', 'notifications', 'wallets', 'recentTransactions', 'adminStats'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => closeDialog(),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => rejectWithdrawal(transactionId, reason),
    onSuccess: () => {
      toast({ title: "Succès", description: "Retrait rejeté." });
      queryClient.invalidateQueries({ queryKey: ['pendingWithdrawals', 'notifications', 'adminStats'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => closeDialog(),
  });

  const openDialog = (action: ActionType, transactionId: string) => setDialogState({ isOpen: true, action, transactionId });
  const closeDialog = () => { setDialogState({ isOpen: false }); setRejectionReason(""); };

  const handleConfirm = () => {
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

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copié!", description: "Le numéro de téléphone a été copié dans le presse-papiers." });
    });
  };

  const isActionPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Retraits en Attente</CardTitle>
          <CardDescription>Approuvez ou rejetez les demandes de retrait des utilisateurs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Numéro de Téléphone</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center">Chargement...</TableCell></TableRow>
                ) : withdrawals && withdrawals.length > 0 ? (
                  withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{format(new Date(w.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{w.profile?.full_name || "Nom non défini"}</div>
                        <div className="text-sm text-muted-foreground">{w.profile?.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{w.profile?.phone || "N/A"}</span>
                          {w.profile?.phone && (<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(w.profile?.phone || "")}><Copy className="h-3 w-3" /></Button>)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(w.amount), w.currency)}</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Ouvrir le menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDialog("approve", w.id)}>Approuver</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("reject", w.id)}>Rejeter</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setSelectedUser({ id: w.user_id, email: w.profile?.email || 'N/A' }); setIsCreditUserOpen(true); }}>
                              Créditer l'utilisateur
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun retrait en attente.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>{dialogState.action === "approve" ? "Cette action approuvera la demande de retrait. L'utilisateur en sera notifié et son solde sera ajusté." : "Cette action rejettera la demande de retrait. L'utilisateur en sera notifié."}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialogState.action === "reject" && (<div className="grid gap-2 py-4"><Label htmlFor="reason">Raison du rejet</Label><Input id="reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ex: Informations de paiement invalides" /></div>)}
          <AlertDialogFooter><AlertDialogCancel onClick={closeDialog} disabled={isActionPending}>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleConfirm} disabled={isActionPending}>{isActionPending ? "En cours..." : "Confirmer"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedUser && (
        <CreditUserDialog 
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          open={isCreditUserOpen}
          onOpenChange={setIsCreditUserOpen}
        />
      )}
    </>
  );
};