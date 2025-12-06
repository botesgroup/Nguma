
import { useState } from "react";
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
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/settingsService";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowLeft } from "lucide-react";
import { DynamicPaymentMethodSelector } from "@/components/DynamicPaymentMethodSelector";
import { PaymentMethod } from "@/services/paymentMethodsService";

type WalletData = Database['public']['Tables']['wallets']['Row'];
type Step = "select_method" | "enter_details" | "verify_otp";

interface WithdrawDialogProps {
  wallet: WalletData | undefined;
}

export const WithdrawDialog = ({ wallet }: WithdrawDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select_method");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // MFA State
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // Load withdrawal settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const minWithdrawal = Number(settings?.find(s => s.key === 'min_withdrawal_amount')?.value || 10);
  const profitBalance = Number(wallet?.profit_balance || 0);
  const maxWithdrawalSetting = Number(settings?.find(s => s.key === 'max_withdrawal_amount')?.value || 10000);
  const maxWithdrawal = profitBalance > 0 ? Math.min(profitBalance, maxWithdrawalSetting) : maxWithdrawalSetting;
  const feePercent = Number(settings?.find(s => s.key === 'withdrawal_fee_percent')?.value || 0);
  const feeFixed = Number(settings?.find(s => s.key === 'withdrawal_fee_fixed')?.value || 0);

  // Calculate total fee
  const calculateFee = (amt: number) => {
    return (amt * feePercent / 100) + feeFixed;
  };

  // Check if user has sufficient balance
  const hasSufficientBalance = profitBalance >= minWithdrawal;

  // Step 1: Request OTP
  const requestOTPMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMethod) throw new Error("Aucune méthode sélectionnée");

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Montant invalide");
      }

      if (amountNum < minWithdrawal) {
        throw new Error(`Le montant minimum est de ${minWithdrawal} USD.`);
      }

      if (amountNum > maxWithdrawal) {
        throw new Error(`Le montant maximum est de ${maxWithdrawal.toFixed(2)} USD.`);
      }

      if (amountNum > profitBalance) {
        throw new Error(`Solde insuffisant. Disponible : ${profitBalance.toFixed(2)} USD.`);
      }

      // Passer l'objet paymentDetails directement (pas JSON.stringify)
      const { requestWithdrawalOTP } = await import("@/services/withdrawalMFAService");
      return requestWithdrawalOTP(amountNum, selectedMethod.code, paymentDetails);
    },
    onSuccess: (data) => {
      setVerificationId(data.verification_id);
      setStep("verify_otp");
      toast({
        title: "Code envoyé",
        description: "Un code de vérification a été envoyé à votre email (et vos spams)."
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    },
  });

  // Step 2: Verify OTP and process withdrawal
  const verifyOTPMutation = useMutation({
    mutationFn: async () => {
      if (!verificationId || !otpCode) throw new Error("Code de vérification manquant.");
      const { verifyAndWithdraw } = await import("@/services/withdrawalMFAService");
      return verifyAndWithdraw(verificationId, otpCode);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Votre demande de retrait a été soumise. Pensez à vérifier vos spams pour l'email de confirmation."
      });
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message
      });
    },
  });

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep("enter_details");
  };

  const handleDetailsSubmit = (formData: Record<string, any>) => {
    setPaymentDetails(formData);
    requestOTPMutation.mutate();
  };

  const handleOTPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOTPMutation.mutate();
  };

  const reset = () => {
    setStep("select_method");
    setSelectedMethod(null);
    setAmount("");
    setPaymentDetails({});
    setOtpCode("");
    setVerificationId(null);
  };

  const handleBack = () => {
    if (step === "verify_otp") {
      setStep("enter_details");
      setOtpCode("");
    } else if (step === "enter_details") {
      setStep("select_method");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary">Retirer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {step !== 'select_method' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 h-auto p-1"
              onClick={handleBack}
              disabled={requestOTPMutation.isPending || verifyOTPMutation.isPending}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <DialogTitle>Effectuer un retrait</DialogTitle>
          <DialogDescription>
            {step === 'select_method' && "Choisissez une méthode de retrait parmi les options disponibles."}
            {step === 'enter_details' && "Entrez le montant et les détails du retrait."}
            {step === 'verify_otp' && `Un code de vérification a été envoyé à votre email. Veuillez le saisir ci-dessous pour confirmer votre retrait de ${amount} USD.`}
          </DialogDescription>
        </DialogHeader>

        {/* Solde disponible - Toujours visible */}
        {step !== 'verify_otp' && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 my-4">
            <p className="text-sm text-gray-600 mb-1">Profits disponibles</p>
            <p className="text-3xl font-bold text-purple-700">{profitBalance.toFixed(2)} USD</p>
          </div>
        )}

        {!hasSufficientBalance && step !== 'verify_otp' && (
          <Alert className="bg-yellow-50 border-yellow-200 mb-4">
            <Info className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Solde insuffisant</strong><br />
              Votre solde de profits est inférieur au montant minimum de retrait ({minWithdrawal} USD).
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Sélection de la méthode */}
        {step === 'select_method' && (
          <div className="py-4">
            <DynamicPaymentMethodSelector
              type="withdrawal"
              onSelect={handleMethodSelect}
            />
          </div>
        )}

        {/* Step 2: Saisie des détails + montant */}
        {step === 'enter_details' && selectedMethod && (
          <div className="py-4 space-y-4">
            {/* Méthode sélectionnée */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="text-sm">
                <span className="text-muted-foreground">Méthode: </span>
                <span className="font-semibold">{selectedMethod.name}</span>
              </div>
            </div>

            {/* Champ montant */}
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Montant à retirer (USD)
                {minWithdrawal > 0 && (
                  <span className="text-muted-foreground ml-2">
                    (Min: {minWithdrawal} USD)
                  </span>
                )}
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min: ${minWithdrawal} USD`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
                disabled={requestOTPMutation.isPending || !hasSufficientBalance}
              />
            </div>

            {/* Résumé des frais */}
            {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Montant demandé :</span>
                      <span className="font-medium">{parseFloat(amount).toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Frais de retrait ({feePercent}% + {feeFixed} USD) :</span>
                      <span className="font-medium text-red-600">- {calculateFee(parseFloat(amount)).toFixed(2)} USD</span>
                    </div>
                    <div className="border-t border-blue-300 pt-1 mt-1"></div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Vous recevrez :</span>
                      <span className="font-bold text-green-700 text-lg">{(parseFloat(amount) - calculateFee(parseFloat(amount))).toFixed(2)} USD</span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Formulaire dynamique pour les champs de paiement */}
            <div className="space-y-4">
              {selectedMethod.fields
                ?.filter(f => f.is_user_input)
                // Pour les RETRAITS : afficher UNIQUEMENT les champs de réception (recipient_*)
                // Exclure tous les champs de dépôt (sender_*, transaction_*, proof_*)
                .filter(f => {
                  // Exclure tous les champs de type 'file'
                  if (f.field_type === 'file') return false;

                  // Garder UNIQUEMENT les champs qui commencent par 'recipient_'
                  return f.field_key.startsWith('recipient_');
                })
                .map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label htmlFor={field.field_key} className="text-sm font-medium">
                      {field.field_label}
                      {field.is_required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      id={field.field_key}
                      type={field.field_type}
                      placeholder={field.field_placeholder || ''}
                      required={field.is_required}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setPaymentDetails(prev => ({ ...prev, [field.field_key]: e.target.value }))}
                      value={paymentDetails[field.field_key] || ''}
                      disabled={requestOTPMutation.isPending}
                    />
                    {field.help_text && (
                      <p className="text-xs text-muted-foreground">{field.help_text}</p>
                    )}
                  </div>
                ))}

              <Button
                type="button"
                onClick={() => handleDetailsSubmit(paymentDetails)}
                disabled={requestOTPMutation.isPending || !amount || parseFloat(amount) <= 0 || !hasSufficientBalance}
                className="w-full"
              >
                {requestOTPMutation.isPending ? "Envoi en cours..." : "Recevoir le code de vérification"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Vérification OTP */}
        {step === 'verify_otp' && (
          <form onSubmit={handleOTPSubmit}>
            <Alert className="bg-yellow-50 border-yellow-200 my-4">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Le code expire dans 10 minutes. Vérifiez votre boîte de réception et vos spams.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="otpCode" className="text-right text-sm font-medium">Code OTP</label>
                <input
                  id="otpCode"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  required
                  disabled={verifyOTPMutation.isPending}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <Button type="submit" disabled={verifyOTPMutation.isPending || otpCode.length !== 6} className="w-full">
                {verifyOTPMutation.isPending ? "Vérification..." : "Confirmer le retrait"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
