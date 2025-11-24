
import { useQuery } from "@tanstack/react-query";
import { getContracts } from "@/services/contractService";
import { getWallet } from "@/services/walletService";
import { ContractCard } from "@/components/ContractCard";
import { NewContractDialog } from "@/components/NewContractDialog";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, DollarSign, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContractsRealtime } from "@/hooks/useRealtimeSync";

const ContractsPage = () => {
  // Get current user ID for Realtime filtering
  const { data: { user } = {} } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => supabase.auth.getUser(),
  });

  // Enable Realtime synchronization for contracts
  useUserContractsRealtime(user?.id);
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: getContracts,
  });

  // Fetch wallet data for currency formatting. Uses cache if already available.
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: getWallet });

  const localFormatCurrency = (amount: number) => {
    return formatCurrency(amount, wallet?.currency || 'USD');
  };

  // Calculate summary stats
  const activeContracts = contracts?.filter(c => c.status === 'active') || [];
  const totalInvested = activeContracts.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalProfits = contracts?.reduce((sum, c) => sum + Number(c.total_profit_paid || 0), 0) || 0;
  const avgROI = totalInvested > 0 ? ((totalProfits / totalInvested) * 100) : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mes Contrats</h1>
          <p className="text-muted-foreground">
            Gérez et suivez tous vos contrats d'investissement.
          </p>
        </div>
        <NewContractDialog />
      </div>

      {/* Summary Stats - 3 Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : contracts && contracts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Investi</div>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {localFormatCurrency(totalInvested)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeContracts.length} contrat{activeContracts.length > 1 ? 's' : ''} actif{activeContracts.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Profits Totaux</div>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                +{localFormatCurrency(totalProfits)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cumulés depuis le début
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">ROI Moyen</div>
                <Award className="h-4 w-4 text-violet-600" />
              </div>
              <div className="text-2xl font-bold text-violet-700">
                +{avgROI.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Return on Investment
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Contracts Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[350px]" />)}
        </div>
      ) : contracts && contracts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} formatCurrency={localFormatCurrency} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-dashed border-blue-200">
          <div className="text-6xl mb-4 animate-bounce">💼</div>
          <h3 className="text-2xl font-semibold mb-2 text-blue-900">
            Aucun contrat pour le moment
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Créez votre premier contrat d'investissement et commencez à générer des profits de 15% mensuels
          </p>
          <NewContractDialog />
        </div>
      )}
    </div>
  );
};

export default ContractsPage;
