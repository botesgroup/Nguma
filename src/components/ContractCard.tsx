import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestRefund } from "@/services/contractService"; // Changed import
import { getSettings } from "@/services/settingsService";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Download } from "lucide-react";

type ContractData = Database['public']['Tables']['contracts']['Row'];

interface ContractCardProps {
  contract: ContractData;
  formatCurrency: (amount: number) => string;
}

export const ContractCard = ({ contract, formatCurrency }: ContractCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const genericContractPdfUrl = settings?.find(s => s.key === 'generic_contract_pdf_url')?.value;
  const pdfToDownload = contract.contract_pdf_url || genericContractPdfUrl;

  const mutation = useMutation({
    mutationFn: requestRefund, // Changed mutationFn
    onSuccess: (data) => {
      toast({
        title: "Succès",
        description: `Demande de remboursement pour le contrat #${contract.id.substring(0, 8)} soumise.`, // Changed message
      });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erreur de demande de remboursement",
        description: error.message,
      });
    },
  });

  const handleRefund = () => {
    mutation.mutate(contract.id);
  };

  const progress = (contract.months_paid / contract.duration_months) * 100;
  const totalProfitPaid = Number(contract.total_profit_paid) || 0;
  const refundAmount = Math.max(0, Number(contract.amount) - totalProfitPaid);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'refunded': return 'destructive';
      case 'pending_refund': return 'outline'; // Added pending_refund status
      default: return 'outline';
    }
  };

  return (
    <Card className="shadow-elegant border-border/50 flex flex-col bg-gradient-card relative">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">Contrat #{contract.id.substring(0, 8)}</CardTitle>
          <Badge variant={getStatusVariant(contract.status)} className="capitalize">{contract.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="text-3xl font-bold">{formatCurrency(Number(contract.amount))}</div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-muted-foreground">Progression</span>
            <span className="text-sm font-medium">{contract.months_paid} / {contract.duration_months} mois</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>Début: {format(new Date(contract.start_date), "d MMMM yyyy", { locale: fr })}</p>
          <p>Fin: {format(new Date(contract.end_date), "d MMMM yyyy", { locale: fr })}</p>
        </div>
      </CardContent>
      <CardFooter className="absolute bottom-2 right-2 p-0 border-none bg-transparent flex gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-blue-500 hover:bg-blue-500/20"
          disabled={!pdfToDownload}
          onClick={() => {
            if (pdfToDownload) {
              window.open(pdfToDownload, "_blank");
              toast({
                title: "Contract Download Successful",
              });
            }
          }}
        >
          <Download className="h-5 w-5" />
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-yellow-500 hover:bg-yellow-500/20" 
              disabled={contract.status !== 'active' || contract.months_paid >= 5 || mutation.isPending} // Disable if already pending or mutation is running
            >
              <AlertTriangle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demande de Remboursement Anticipé</DialogTitle>
              <DialogDescription>
                Veuillez vérifier le calcul ci-dessous avant de soumettre votre demande.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Montant investi :</span> <span className="font-medium">{formatCurrency(Number(contract.amount))}</span></div>
              <div className="flex justify-between"><span>Profits déjà versés :</span> <span className="font-medium text-destructive">- {formatCurrency(totalProfitPaid)}</span></div>
              <hr className="my-2 border-border" />
              <div className="flex justify-between text-base"><strong>Montant qui sera remboursé :</strong> <strong className="text-primary">{formatCurrency(refundAmount)}</strong></div>
            </div>
            <DialogFooter className="flex flex-col items-center gap-4 pt-4">
              <Button 
                onClick={handleRefund} 
                disabled={mutation.isPending} 
                className="w-full sm:w-auto"
              >
                {mutation.isPending ? "Soumission en cours..." : "Soumettre la demande"}
              </Button>
              <Button variant="secondary" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Annuler</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
};