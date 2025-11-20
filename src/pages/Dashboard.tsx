import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/services/walletService";
import { getContracts } from "@/services/contractService";
import { getRecentTransactions } from "@/services/transactionService";
import { getProfits } from "@/services/profitService";
import { WalletCard } from "@/components/WalletCard";
import { TransactionTable } from "@/components/TransactionTable";
import { ContractCard } from "@/components/ContractCard";
import { ProfitChart } from "@/components/ProfitChart";
import { NewContractDialog } from "@/components/NewContractDialog";
import { DepositDialog } from "@/components/DepositDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { UpcomingPayments } from "@/components/UpcomingPayments";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { differenceInDays } from "date-fns";

const Dashboard = () => {
  const { data: wallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  });

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

  const activeContracts = contracts?.filter(c => c.status === 'active') || [];
  const totalInvested = activeContracts.reduce((sum, c) => sum + Number(c.amount), 0);
  const roi = totalInvested > 0 ? ((Number(wallet?.profit_balance || 0) / totalInvested) * 100) : 0;

  // Calculate quick stats
  const latestProfit = profits?.[0]?.amount || 0;
  const nextPaymentDays = activeContracts.length > 0
    ? Math.min(...activeContracts.map(c => {
      const monthsPaid = c.months_paid || 0;
      const startDate = new Date(c.start_date);
      const nextPaymentDate = new Date(startDate);
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + monthsPaid + 1);
      return differenceInDays(nextPaymentDate, new Date());
    }))
    : null;

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
          <WithdrawDialog wallet={wallet} />
        </div>
      </div>

      {/* Quick Stats Row */}
      {!isLoadingWallet && !isLoadingContracts && activeContracts.length > 0 && (
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <span className="text-xs sm:text-sm text-muted-foreground">ROI Moyen:</span>
            <span className="text-sm sm:text-base font-bold text-blue-700">+{roi.toFixed(1)}%</span>
          </div>
          {latestProfit > 0 && (
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <span className="text-xs sm:text-sm text-muted-foreground">Dernier Profit:</span>
              <span className="text-sm sm:text-base font-bold text-green-700">{formatCurrency(latestProfit)}</span>
            </div>
          )}
          {nextPaymentDays !== null && nextPaymentDays >= 0 && (
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <span className="text-xs sm:text-sm text-muted-foreground">Prochain Paiement:</span>
              <span className="text-sm sm:text-base font-bold text-purple-700">{nextPaymentDays === 0 ? "Aujourd'hui" : `Dans ${nextPaymentDays}j`}</span>
            </div>
          )}
        </div>
      )}

      {/* Encouragement Message - Dynamic based on performance */}
      {!isLoadingWallet && roi > 20 && (
        <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">Excellente performance ! 🎉</AlertTitle>
          <AlertDescription className="text-green-800">
            Votre ROI de {roi.toFixed(1)}% dépasse l'objectif de 20%. Continuez comme ça !
          </AlertDescription>
        </Alert>
      )}

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

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Profit Chart with Loading */}
        {isLoadingProfits ? (
          <Skeleton className="h-[350px] sm:h-[400px] rounded-lg" />
        ) : (
          <ProfitChart profits={profits} />
        )}

        {/* Upcoming Payments */}
        <UpcomingPayments />
      </div>

      {/* Contracts Section with Enhanced Empty State */}
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">Mes Contrats</h2>
          <NewContractDialog />
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
          <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border-2 border-dashed border-violet-200">
            <div className="text-5xl sm:text-6xl mb-4 animate-bounce">📊</div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-violet-900">
              Commencez votre premier investissement
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md mx-auto px-4">
              Créez un contrat pour commencer à générer des profits mensuels de 15%
            </p>
            <NewContractDialog />
          </div>
        )}
      </div>

      {/* Transactions with Loading */}
      {isLoadingTransactions ? (
        <Skeleton className="h-[300px] rounded-lg" />
      ) : (
        <TransactionTable recentTransactions={recentTransactions} formatCurrency={formatCurrency} />
      )}
    </div>
  );
};

export default Dashboard;