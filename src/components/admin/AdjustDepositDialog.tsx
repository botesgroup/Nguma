
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAdjustDepositAmount } from "@/services/adminService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

interface AdjustDepositDialogProps {
  transactionId: string;
  currentAmount: number;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AdjustDepositDialog = ({ transactionId, currentAmount, userEmail, open, onOpenChange }: AdjustDepositDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newAmount, setNewAmount] = useState(currentAmount.toString());

  const mutation = useMutation({
    mutationFn: adminAdjustDepositAmount,
    onSuccess: () => {
      toast({ title: "Succès", description: `Le montant du dépôt pour ${userEmail} a été ajusté.` });
      queryClient.invalidateQueries({ queryKey: ["pendingDeposits"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleSubmit = () => {
    const numericAmount = parseFloat(newAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez entrer un montant valide et positif." });
      return;
    }
    mutation.mutate({ transactionId, newAmount: numericAmount });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuster le montant du dépôt</DialogTitle>
          <DialogDescription>
            Modifiez le montant du dépôt pour {userEmail}.
            Le montant actuel est de {formatCurrency(currentAmount)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-amount">Nouveau Montant (USD)</Label>
            <Input
              id="new-amount"
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="ex: 100.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : "Enregistrer le nouveau montant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
