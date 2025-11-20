import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingRefunds, approveRefund, rejectRefund } from "@/services/adminService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ActionType = "approve" | "reject";
interface DialogState {
  isOpen: boolean;
  action?: ActionType;
  contractId?: string;
}
type PendingRefund = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  start_date: string;
  months_paid: number;
  duration_months: number;
  total_profit_paid: number;
  email: string;
  full_name: string;
};

export const PendingRefunds = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false });
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // For bulk actions, if implemented later

  const { data: refunds, isLoading } = useQuery<PendingRefund[]>({
    queryKey: ["pendingRefunds"],
    queryFn: getPendingRefunds,
  });

  const approveMutation = useMutation({
    mutationFn: approveRefund,
    onSuccess: () => {
      toast({ title: "Succès", description: "Remboursement approuvé." });
      queryClient.invalidateQueries({ queryKey: ['pendingRefunds', 'contracts', 'wallets', 'notifications'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => closeDialog(),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ contractId, reason }: { contractId: string; reason: string }) => rejectRefund(contractId, reason),
    onSuccess: () => {
      toast({ title: "Succès", description: "Remboursement rejeté." });
      queryClient.invalidateQueries({ queryKey: ['pendingRefunds', 'contracts', 'notifications'] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => closeDialog(),
  });

  const openDialog = (action: ActionType, contractId: string) => setDialogState({ isOpen: true, action, contractId });
  const closeDialog = () => {
    setDialogState({ isOpen: false });
    setRejectionReason(""); // Clear reason on close
  };

  const handleConfirmSingleAction = () => {
    if (!dialogState.contractId || !dialogState.action) return;
    if (dialogState.action === "approve") {
      approveMutation.mutate(dialogState.contractId);
    } else if (dialogState.action === "reject") {
      if (!rejectionReason.trim()) {
        toast({ variant: "destructive", title: "Erreur", description: "La raison du rejet est obligatoire." });
        return;
      }
      rejectMutation.mutate({ contractId: dialogState.contractId, reason: rejectionReason });
    }
  };

  const isActionPending = approveMutation.isPending || rejectMutation.isPending;
  const allRefunds = refunds || [];
  const numSelected = selectedIds.length; // Keep for future bulk actions

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Remboursements en Attente</CardTitle>
          <CardDescription>Approuvez ou rejetez les demandes de remboursement des utilisateurs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Checkbox column for future bulk actions */}
                  <TableHead className="w-[50px]"><Checkbox checked={numSelected > 0 && numSelected === allRefunds.length} onCheckedChange={() => { }} aria-label="Select all" disabled /></TableHead>
                  <TableHead>Contrat ID</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Montant Investi</TableHead>
                  <TableHead>Profits Payés</TableHead>
                  <TableHead>Mois Payés</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center">Chargement...</TableCell></TableRow>
                ) : allRefunds.length > 0 ? (
                  allRefunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell><Checkbox checked={false} disabled /></TableCell> {/* Disabled for now */}
                      <TableCell className="font-mono text-xs">{refund.id.substring(0, 8)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{refund.full_name || "Nom non défini"}</div>
                        <div className="text-sm text-muted-foreground">{refund.email}</div>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(refund.amount), refund.currency)}</TableCell>
                      <TableCell>{formatCurrency(Number(refund.total_profit_paid), refund.currency)}</TableCell>
                      <TableCell>{refund.months_paid} / {refund.duration_months}</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Ouvrir le menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDialog("approve", refund.id)}>Approuver</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("reject", refund.id)}>Rejeter</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <div className="text-center py-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg m-4">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-2xl font-semibold mb-2 text-amber-900">
                          Tous les remboursements traités !
                        </h3>
                        <p className="text-muted-foreground">
                          Aucun remboursement en attente de validation
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
          <div className="text-sm text-muted-foreground">{numSelected} sur {allRefunds.length} ligne(s) sélectionnée(s).</div>
          <div className="flex gap-2">
            {/* Bulk actions disabled for now */}
            <Button variant="outline" size="sm" disabled>Approuver la sélection</Button>
            <Button variant="destructive" size="sm" disabled>Rejeter la sélection</Button>
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.action === "approve"
                ? "Cette action approuvera le remboursement et créditera le portefeuille de l'utilisateur. Cette action est irréversible."
                : "Cette action rejettera la demande de remboursement. L'utilisateur en sera notifié."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialogState.action === "reject" && (
            <div className="grid gap-2 py-4">
              <Label htmlFor="reason">Raison du rejet</Label>
              <Input
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Conditions de remboursement non remplies"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog} disabled={isActionPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSingleAction} disabled={isActionPending}>
              {isActionPending ? "En cours..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
