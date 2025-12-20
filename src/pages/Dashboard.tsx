import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/services/walletService";
import { getContracts } from "@/services/contractService";
import { getRecentTransactions } from "@/services/transactionService";
import { getProfits } from "@/services/profitService";
import { getSettings } from "@/services/settingsService";
import { WalletCard } from "@/components/WalletCard";
import { TransactionTable } from "@/components/TransactionTable";
import { ContractCard } from "@/components/ContractCard";
import { ProfitChart } from "@/components/ProfitChart";
import { NewContractDialog } from "@/components/NewContractDialog";
import { DepositDialog } from "@/components/DepositDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { ReinvestDialog } from "@/components/ReinvestDialog";
import { UpcomingPayments } from "@/components/UpcomingPayments";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  useUserTransactionsRealtime,
  useUserContractsRealtime,
  useUserProfitsRealtime,
} from "@/hooks/useRealtimeSync";
// Removed: import { isDepositEnabled, getDepositPeriodStatus } from "@/services/depositPeriodService";
// Removed: import { useDepositStatus } from "@/hooks/useDepositStatus";

const Dashboard = () => {
  // Get current user ID for Realtime filtering
  const { data: userResponse } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => supabase.auth.getUser(),
  });
  const user = userResponse?.data?.user;

  // Enable Realtime synchronization for this user
  useUserTransactionsRealtime(user?.id);
  useUserContractsRealtime(user?.id);
  useUserProfitsRealtime(user?.id);

  const { data: wallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

  // Removed: const { depositStatus, isLoading: isLoadingDepositStatus, error } = useDepositStatus();

  const { data: contracts, isLoading: isLoadingContracts } = useQuery({
    queryKey: ["contracts"],
    queryFn: getContracts,
  });

  const { data: recentTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: getRecentTransactions,
  });

  const { data: profits, isLoading: isLoadingProfits } = useQuery({
    queryKey: ["profits"],
    queryFn: getProfits,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const activeContracts = contracts?.filter(c => c.status === 'active') || [];
  const totalInvested = activeContracts.reduce((sum, c) => sum + Number(c.amount), 0);

  // ROI = (Total Profit / Total Invested) * 100
  // This shows the percentage return on the invested capital
  const roi = Number(wallet?.invested_balance || 0) > 0
    ? ((Number(wallet?.profit_balance || 0) / Number(wallet?.invested_balance || 0)) * 100)
    : 0;

  // Calculate latest profit and next payment
  const latestProfit = profits?.[0]?.amount || 0;
  const nextPayment = activeContracts.length > 0 ? activeContracts[0] : null;
  const nextPaymentDays = nextPayment ? differenceInDays(new Date(nextPayment.end_date), new Date()) : 0;

  // Get monthly profit rate from settings (default to 0.10 = 10%)
  const monthlyRateSetting = settings?.find(s => s.key === 'monthly_profit_rate');
  const monthlyRatePercent = monthlyRateSetting?.value
    ? (parseFloat(monthlyRateSetting.value) * 100).toFixed(0)
    : '10';

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de vos investissements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DepositDialog />
          <NewContractDialog />
          <ReinvestDialog wallet={wallet} />
          <WithdrawDialog wallet={wallet} />
        </div>
      </div>

      {/* Removed: Indicateur de l'état des dépôts */}
      {/* {!isLoadingDepositStatus && depositStatus && (
        <div className={`p-4 rounded-lg border ${
          depositStatus.isActive
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {depositStatus.isActive ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {depositStatus.isActive
                    ? '✅ Dépôts activés'
                    : '❌ Dépôts désactivés'}
                </span>
                {depositStatus.timeUntilNext && (
                  <span className="text-sm font-semibold bg-secondary px-2 py-1 rounded whitespace-nowrap">
                    {depositStatus.timeUntilNext}
                  </span>
                )}
              </div>
              <p className="text-sm opacity-80 mt-1">
                {depositStatus.message}
              </p>
            </div>
          </div>
        </div>
      )} */}

      {/* Wallet Cards with Loading State */}
      {isLoadingWallet || isLoadingContracts ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-lg" />
          ))}
        </div>
      ) : (
        <WalletCard wallet={wallet} contracts={contracts} />
      )}



      {/* Contracts Section with Enhanced Empty State */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">Mes Contrats</h2>
        </div>
        {isLoadingContracts ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[280px] rounded-lg" />
            ))}
          </div>
        ) : activeContracts.length > 0 ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {activeContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} formatCurrency={formatCurrency} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border-2 border-dashed border-slate-700">
            <div className="text-5xl sm:text-6xl mb-4 animate-bounce">📊</div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-white">
              Commencez votre premier investissement
            </h3>
            <p className="text-sm sm:text-base text-slate-300 mb-6 max-w-md mx-auto px-4">
              Créez un contrat pour commencer à générer des profits mensuels de {monthlyRatePercent}%
            </p>
            <NewContractDialog />
          </div>
        )}
      </div>


    </div>
  );
};

export default Dashboard;