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

import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Download, Clock, Sparkles, TrendingUp, Shield } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ContractData = Database['public']['Tables']['contracts']['Row'];

interface ContractCardProps {
  contract: ContractData;
  formatCurrency: (amount: number) => string;
}

export const ContractCard = ({ contract, formatCurrency }: ContractCardProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: requestRefund, // Changed mutationFn
    onSuccess: (data) => {
      toast({
        title: "Succès",
        description: `Demande de remboursement soumise. Veuillez consulter vos emails (et spams) pour la confirmation.`,
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

  // Calculate smart badges
  const contractAge = Math.floor((new Date().getTime() - new Date(contract.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const isNew = contractAge < 30;
  const roiPercent = (totalProfitPaid / Number(contract.amount)) * 100;
  const isProfitable = roiPercent > 10;
  const monthsRemaining = contract.duration_months - (contract.months_paid || 0);
  const isEndingSoon = monthsRemaining <= 2 && monthsRemaining > 0 && contract.status === 'active';

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
    <Card className="shadow-elegant border-border/50 flex flex-col bg-gradient-card relative overflow-hidden">
      {/* Status indicator - animated dot */}
      {contract.status === 'active' && (
        <div className="absolute top-3 left-3 z-10">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        </div>
      )}

      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">Contrat #{contract.id.substring(0, 8)}</CardTitle>
            {/* Smart Status Badges */}
            <div className="flex flex-wrap gap-1 mt-2">
              {isNew && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Nouveau
                </Badge>
              )}
              {isProfitable && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Rentable
                </Badge>
              )}
              {isEndingSoon && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Bientôt terminé
                </Badge>
              )}
              {totalProfitPaid > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  ROI: +{((totalProfitPaid / Number(contract.amount)) * 100).toFixed(1)}%
                </Badge>
              )}
              {contract.is_insured && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Assuré
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Ce contrat bénéficie d'une assurance garantissant un remboursement intégral</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
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

        {/* Profits versés */}
        {totalProfitPaid > 0 && (
          <div className="flex justify-between items-center text-sm bg-green-50 p-2 rounded-lg">
            <span className="text-muted-foreground">Profits versés</span>
            <span className="font-semibold text-green-600">
              +{formatCurrency(totalProfitPaid)}
            </span>
          </div>
        )}

        {/* Frais d'assurance payés */}
        {contract.is_insured && Number(contract.insurance_fee_paid) > 0 && (
          <div className="flex justify-between items-center text-sm bg-indigo-50 p-2 rounded-lg">
            <span className="text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Frais d'assurance
            </span>
            <span className="font-semibold text-indigo-600">
              {formatCurrency(Number(contract.insurance_fee_paid))}
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>Début: {format(new Date(contract.start_date), "d MMMM yyyy", { locale: fr })}</p>
          <p>Fin: {format(new Date(contract.end_date), "d MMMM yyyy", { locale: fr })}</p>
        </div>
      </CardContent>
      <CardFooter className="absolute bottom-2 right-2 p-0 border-none bg-transparent flex gap-2">
        {contract.is_insured && ( // Only render if contract is insured
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-yellow-500 hover:bg-yellow-500/20"
                disabled={contract.status !== 'active' || contract.months_paid >= 5 || mutation.isPending || !contract.is_insured} // Disable if not active, too many months paid, mutation is running, or not insured
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
                {contract.is_insured && (
                  <div className="bg-indigo-50 p-2 rounded-lg mb-2">
                    <div className="flex items-center gap-2 text-indigo-700 font-medium">
                      <Shield className="h-4 w-4" />
                      Contrat assuré - Remboursement intégral garanti
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-base">
                  <strong>Montant qui sera remboursé :</strong>
                  <strong className="text-primary">
                    {contract.is_insured ? formatCurrency(Number(contract.amount)) : formatCurrency(refundAmount)}
                  </strong>
                </div>
              </div>
              <DialogFooter className="flex flex-col items-center gap-4 pt-4">
                <Button variant="secondary" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardFooter>
    </Card>
  );
};