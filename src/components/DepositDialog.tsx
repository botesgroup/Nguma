import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestDeposit } from "@/services/walletService";
import { saveTransactionMetadata, PaymentMethod } from "@/services/paymentMethodsService";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import { DynamicPaymentMethodSelector } from "@/components/DynamicPaymentMethodSelector";
import { DynamicPaymentForm } from "@/components/DynamicPaymentForm";

type Step = "select_method" | "enter_details";

export const DepositDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select_method");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { amount: number; formData: Record<string, any> }) => {
      if (!selectedMethod) throw new Error("Aucune méthode sélectionnée");

      // Extraire les données pour requestDeposit
      // Les champs admin ne sont pas envoyés, seulement les champs utilisateur
      const userFields = selectedMethod.fields?.filter(f => f.is_user_input) || [];

      // Trouver le champ de référence (transaction_id, mtcn, pin_number, etc.)
      const referenceField = userFields.find(f =>
        f.field_key.includes('transaction') ||
        f.field_key.includes('mtcn') ||
        f.field_key.includes('reference') ||
        f.field_key.includes('pin')
      );

      // Trouver le champ de téléphone
      const phoneField = userFields.find(f =>
        f.field_key.includes('phone') ||
        f.field_key.includes('sender_number')
      );

      // Trouver le champ de preuve
      const proofField = userFields.find(f =>
        f.field_type === 'file'
      );

      const reference = referenceField ? data.formData[referenceField.field_key] : undefined;
      const phone = phoneField ? data.formData[phoneField.field_key] : undefined;
      const proofUrl = proofField ? data.formData[proofField.field_key] : undefined;

      // Créer la transaction
      const result = await requestDeposit(
        data.amount,
        selectedMethod.code,
        reference,
        phone,
        proofUrl
      );

      // Sauvegarder toutes les métadonnées
      if (result && typeof result === 'object' && 'transaction_id' in result) {
        await saveTransactionMetadata(
          (result as any).transaction_id,
          data.formData
        );
      }

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

    // Valider le montant minimum si défini
    if (selectedMethod?.min_amount && amountValue < selectedMethod.min_amount) {
      toast({
        variant: "destructive",
        title: "Montant trop faible",
        description: `Le montant minimum pour ${selectedMethod.name} est de ${selectedMethod.min_amount} USD.`
      });
      return;
    }

    // Valider le montant maximum si défini
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
      formData
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
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) reset(); }}>
      <DialogTrigger asChild>
        <Button>Déposer</Button>
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
            {descriptionText()}
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};