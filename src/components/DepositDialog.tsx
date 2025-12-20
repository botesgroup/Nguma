import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; // Import useQuery
import { requestDeposit } from "@/services/walletService";
import { PaymentMethod } from "@/services/paymentMethodsService";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { DynamicPaymentMethodSelector } from "@/components/DynamicPaymentMethodSelector";
import { DynamicPaymentForm } from "@/components/DynamicPaymentForm";
import { isDepositEnabled } from "@/services/depositPeriodService"; // Only isDepositEnabled
import { Link } from "react-router-dom"; // Import Link for navigation
import { Checkbox } from "@/components/ui/checkbox"; // For the new opt-in checkbox
import { subscribeToNotification } from "@/services/notificationPreferencesService"; // To be implemented

type Step = "select_method" | "enter_details";

export const DepositDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select_method");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [wantsEmailNotification, setWantsEmailNotification] = useState(false); // New state for opt-in

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use useQuery for deposit enabled status to leverage caching and automatic refetching
  const { data: depositEnabled, isLoading: checkingStatus } = useQuery({
    queryKey: ['depositEnabledStatus'],
    queryFn: isDepositEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      // Assuming a notification type 'deposit_availability_reminder' exists
      // TODO: Get user ID from auth.uid() or similar
      await subscribeToNotification('deposit_availability_reminder', true);
    },
    onSuccess: () => {
      toast({
        title: "✅ Abonnement confirmé",
        description: "Vous serez informé par e-mail dès que les dépôts seront disponibles.",
      });
      setWantsEmailNotification(false); // Reset checkbox
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "❌ Erreur",
        description: `Impossible de s'abonner aux notifications: ${error.message}`,
      });
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: { amount: number; proofUrl: string }) => {
      if (!selectedMethod) throw new Error("Aucune méthode sélectionnée");

      const result = await requestDeposit(
        data.amount,
        selectedMethod.code,
        undefined, // plus de référence
        undefined, // plus de téléphone
        data.proofUrl
      );

      return result;
    },
    onSuccess: () => {
      toast({
        title: "✅ Demande de dépôt reçue",
        description: "Votre demande est en attente. Veuillez consulter vos emails (et spams) pour la confirmation.",
      });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "❌ Erreur",
        description: error.message
      });
    },
  });

  const reset = () => {
    setStep("select_method");
    setSelectedMethod(null);
    setAmount("");
    setWantsEmailNotification(false); // Reset new state
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep("enter_details");
  };

  const handleFormSubmit = (formData: Record<string, any>) => {
    const amountValue = parseFloat(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        variant: "destructive",
        title: "Montant invalide",
        description: "Veuillez entrer un montant valide."
      });
      return;
    }

    // Valider le montant minimum si défini (kept as per payment method config)
    if (selectedMethod?.min_amount && amountValue < selectedMethod.min_amount) {
      toast({
        variant: "destructive",
        title: "Montant trop faible",
        description: `Le montant minimum pour ${selectedMethod.name} est de ${selectedMethod.min_amount} USD.`
      });
      return;
    }

    // Valider le montant maximum si défini (kept as per payment method config)
    if (selectedMethod?.max_amount && amountValue > selectedMethod.max_amount) {
      toast({
        variant: "destructive",
        title: "Montant trop élevé",
        description: `Le montant maximum pour ${selectedMethod.name} est de ${selectedMethod.max_amount} USD.`
      });
      return;
    }

    mutation.mutate({
      amount: amountValue,
      proofUrl: formData.proof_url
    });
  };

  const descriptionText = () => {
    if (step === 'select_method') {
      return "Choisissez une méthode de dépôt parmi les options disponibles.";
    }
    if (selectedMethod) {
      const minText = selectedMethod.min_amount ? ` Minimum: ${selectedMethod.min_amount} USD.` : "";
      const maxText = selectedMethod.max_amount ? ` Maximum: ${selectedMethod.max_amount} USD.` : "";
      return `Entrez le montant et les détails du dépôt.${minText}${maxText}`;
    }
    return "Entrez les détails du dépôt.";
  };

  const calculateFees = (amount: number, method: PaymentMethod) => {
    let fees = 0;
    if (method.fee_type === 'fixed') {
      fees = method.fee_fixed || 0;
    } else if (method.fee_type === 'percentage') {
      fees = amount * ((method.fee_percentage || 0) / 100);
    } else if (method.fee_type === 'combined') {
      fees = (method.fee_fixed || 0) + (amount * ((method.fee_percentage || 0) / 100));
    }
    return fees;
  };

  const fees = selectedMethod && amount ? calculateFees(parseFloat(amount) || 0, selectedMethod) : 0;
  const totalAmount = (parseFloat(amount) || 0) + fees;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        reset();
      }
    }}>
      <DialogTrigger asChild>
        {/* Button is always enabled, only checking status for loading text */}
        <Button disabled={checkingStatus}>
          {checkingStatus ? "Vérification..." : "Déposer"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {step === 'enter_details' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 h-auto p-1"
              onClick={() => setStep("select_method")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <DialogTitle>Effectuer un dépôt</DialogTitle>
          <DialogDescription>
            {checkingStatus ? "Vérification de l'état des dépôts..." :
              depositEnabled ? descriptionText() :
              "Les dépôts sont actuellement désactivés. Veuillez réessayer plus tard."}
          </DialogDescription>
        </DialogHeader>

        {checkingStatus ? (
          <div className="py-4 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : depositEnabled ? (
          <>
            {step === 'select_method' ? (
              <div className="py-4">
                <DynamicPaymentMethodSelector
                  type="deposit"
                  onSelect={handleMethodSelect}
                />
              </div>
            ) : selectedMethod && (
              <div className="py-4 space-y-4">
                {/* Affichage de la méthode sélectionnée */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Méthode: </span>
                    <span className="font-semibold">{selectedMethod.name}</span>
                  </div>
                </div>

                {/* Champ montant */}
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-sm font-medium">
                    Montant à déposer (USD)
                    {selectedMethod.min_amount && (
                      <span className="text-muted-foreground ml-2">
                        (Min: {selectedMethod.min_amount} USD)
                      </span>
                    )}
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Entrez le montant"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    disabled={mutation.isPending}
                  />
                </div>

                {/* Résumé des frais */}
                {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
                  <div className="bg-muted/30 p-3 rounded-lg space-y-2 text-sm border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Montant demandé:</span>
                      <span>{parseFloat(amount).toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Frais
                        {selectedMethod.fee_type === 'percentage' && ` (${selectedMethod.fee_percentage}%)`}
                        {selectedMethod.fee_type === 'fixed' && ` (Fixe)`}
                        {selectedMethod.fee_type === 'combined' && ` (${selectedMethod.fee_percentage}% + ${selectedMethod.fee_fixed} USD)`}
                        :
                      </span>
                      <span className="text-orange-600 font-medium">
                        + {fees.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total à payer:</span>
                      <span className="text-primary">{totalAmount.toFixed(2)} USD</span>
                    </div>
                  </div>
                )}

                {/* Formulaire dynamique */}
                <DynamicPaymentForm
                  method={selectedMethod}
                  amount={parseFloat(amount) || 0}
                  onSubmit={handleFormSubmit}
                  isSubmitting={mutation.isPending}
                />
              </div>
            )}
          </>
        ) : (
          <div className="py-4 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">Dépôts actuellement désactivés</h3>
            <p className="text-muted-foreground mb-2 text-center">
              Le dépôt est temporairement suspendu et sera bientôt disponible.
            </p>
            <div className="flex items-center space-x-2 mt-4">
                <Checkbox
                    id="deposit-notification"
                    checked={wantsEmailNotification}
                    onCheckedChange={(checked: boolean) => setWantsEmailNotification(checked)}
                />
                <label
                    htmlFor="deposit-notification"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Être informé par e-mail
                </label>
                <Button
                    variant="link"
                    size="sm"
                    onClick={() => subscribeMutation.mutate()}
                    disabled={!wantsEmailNotification || subscribeMutation.isPending}
                >
                    {subscribeMutation.isPending ? "Abonnement..." : "S'abonner"}
                </Button>
            </div>
            <p className="text-sm mt-4">
                Vous pouvez également gérer vos <Link to="/settings/notifications" className="text-primary hover:underline">préférences de notification ici</Link>.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};