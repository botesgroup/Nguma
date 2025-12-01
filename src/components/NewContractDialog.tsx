
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Shield, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContract } from "@/services/contractService";
import { getWallet } from "@/services/walletService";
import { getSettings } from "@/services/settingsService";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const NewContractDialog = () => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isInsured, setIsInsured] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (wallet) {
      setAmount(String(wallet.total_balance || 0));
    }
  }, [wallet]);

  // Récupérer les paramètres d'assurance
  const insuranceEnabled = settings?.find(s => s.key === 'insurance_enabled')?.value === 'true';
  const insuranceFeePercent = parseFloat(settings?.find(s => s.key === 'insurance_fee_percent')?.value || '0');
  const insuranceFeeFixed = parseFloat(settings?.find(s => s.key === 'insurance_fee_fixed')?.value || '0');
  const insuranceApplyBoth = settings?.find(s => s.key === 'insurance_apply_both')?.value === 'true';

  // Calculer les frais d'assurance
  const calculateInsuranceFee = (amt: number): number => {
    if (!isInsured || !insuranceEnabled) return 0;

    if (insuranceApplyBoth) {
      return (amt * insuranceFeePercent / 100) + insuranceFeeFixed;
    } else {
      if (insuranceFeePercent > 0) {
        return amt * insuranceFeePercent / 100;
      } else {
        return insuranceFeeFixed;
      }
    }
  };

  const amountValue = parseFloat(amount) || 0;
  const insuranceFee = calculateInsuranceFee(amountValue);
  const netAmount = amountValue - insuranceFee;

  const contractSchema = z.object({
    amount: z.coerce.number().positive("Le montant doit être positif.")
      .max(Number(wallet?.total_balance) || 0, { message: "Le montant ne peut pas dépasser votre solde total." }),
  });

  const mutation = useMutation({
    mutationFn: ({ amount, isInsured }: { amount: number; isInsured: boolean }) =>
      createContract(amount, isInsured),
    onSuccess: (data) => {
      const response = data as { success: boolean; insurance_fee?: number; net_amount?: number };

      toast({
        title: "Succès",
        description: isInsured
          ? `Votre contrat assuré a été créé avec succès. Montant du contrat: ${response.net_amount?.toFixed(2)} USD (Frais d'assurance: ${response.insurance_fee?.toFixed(2)} USD)`
          : "Votre nouveau contrat a été créé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setOpen(false);
      setAmount("");
      setIsTermsAccepted(false);
      setIsInsured(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de créer le contrat.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTermsAccepted) {
      toast({ variant: "destructive", title: "Erreur", description: "Vous devez accepter les termes du contrat." });
      return;
    }
    try {
      const validatedData = contractSchema.parse({ amount });
      mutation.mutate({ amount: validatedData.amount, isInsured });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Erreur de validation", description: error.errors[0].message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nouveau Contrat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Nguma Logo" className="h-20 object-contain" />
          </div>
          <DialogHeader>
            <DialogTitle>Créer un nouveau contrat</DialogTitle>
            <DialogDescription>
              Veuillez lire et accepter les termes du contrat avant d'investir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="amount">Montant à investir (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Entrez le montant"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Solde disponible: {wallet?.total_balance?.toFixed(2) || 0} USD
              </p>
            </div>

            {insuranceEnabled && (
              <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="insurance"
                    checked={isInsured}
                    onCheckedChange={(checked) => setIsInsured(checked as boolean)}
                  />
                  <label
                    htmlFor="insurance"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4 text-green-600" />
                    Assurer ce contrat
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            L'assurance garantit un remboursement intégral de votre investissement
                            en cas de demande anticipée, quelle que soit la durée écoulée.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </label>
                </div>

                {isInsured && amountValue > 0 && (
                  <div className="space-y-2 text-sm pl-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Montant saisi:</span>
                      <span className="font-medium">{amountValue.toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frais d'assurance:</span>
                      <span className="font-medium text-orange-600">
                        -{insuranceFee.toFixed(2)} USD
                        {insuranceFeePercent > 0 && ` (${insuranceFeePercent}%)`}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">Montant du contrat:</span>
                      <span className="font-semibold text-green-600">{netAmount.toFixed(2)} USD</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={isTermsAccepted}
                onCheckedChange={(checked) => setIsTermsAccepted(checked as boolean)}
              />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                J'ai lu et j'accepte les <a href="/terms" className="text-primary hover:underline">termes et conditions du contrat</a>
              </label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={!isTermsAccepted || mutation.isPending}>
              {mutation.isPending ? "Création en cours..." : "Créer le contrat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
