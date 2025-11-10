import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { creditUser } from "@/services/adminService";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface CreditUserDialogProps {
  userId: string;
  userEmail: string;
}

export const CreditUserDialog = ({ userId, userEmail }: CreditUserDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: creditUser,
    onSuccess: () => {
      toast({ title: "Succès", description: `L'utilisateur ${userEmail} a été crédité.` });
      queryClient.invalidateQueries({ queryKey: ["investorsList"] });
      queryClient.invalidateQueries({ queryKey: ["userDetails", userId] });
      // No need to manually close dialog, DialogClose will handle it
      setAmount("");
      setReason("");
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleSubmit = () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez entrer un montant valide et positif." });
      return;
    }
    if (!reason) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez fournir une raison pour le crédit." });
      return;
    }
    mutation.mutate({ userId, amount: numericAmount, reason });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Créditer l'utilisateur</DialogTitle>
        <DialogDescription>
          Ajoutez manuellement des fonds au portefeuille de {userEmail}. Ce montant sera ajouté au solde principal.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Montant (USD)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex: 100.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Raison</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex: Bonus de bienvenue, correction..."
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Annuler</Button>
        </DialogClose>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "En cours..." : "Créditer l'utilisateur"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};