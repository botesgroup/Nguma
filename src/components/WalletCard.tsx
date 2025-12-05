
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, FileText, DollarSign } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

// Define the types for the props based on our database schema
type WalletData = Database['public']['Tables']['wallets']['Row'];
type ContractData = Database['public']['Tables']['contracts']['Row'];

interface WalletCardProps {
  wallet: WalletData | undefined;
  contracts: ContractData[] | undefined;
}

/**
 * WalletCard Component - Enhanced Visual Design
 * 
 * Displays 4 statistic cards with improved styling:
 * - Total Balance
 * - Invested Amount
 * - Available Profits
 * - Active Contracts
 */
export const WalletCard = ({ wallet, contracts }: WalletCardProps) => {
  // Helper function to format numbers into currency strings
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: wallet?.currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const activeContracts = contracts?.filter(c => c.status === "active").length || 0;
  const totalProfit = Number(wallet?.profit_balance || 0);
  const totalInvested = contracts
    ?.filter(c => c.status === "active")
    .reduce((sum, contract) => sum + Number(contract.amount), 0) || 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 shadow-elegant hover:shadow-xl transition-all hover:scale-[1.02] duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Montant Déposé</CardTitle>
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">
            {formatCurrency(Number(wallet?.total_balance || 0))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total des dépôts effectués
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 shadow-elegant hover:shadow-xl transition-all hover:scale-[1.02] duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Investis</CardTitle>
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <DollarSign className="h-4 w-4 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-700">
            {formatCurrency(totalInvested)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Montant total investi
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 shadow-elegant hover:shadow-xl transition-all hover:scale-[1.02] duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profits</CardTitle>
          <div className="p-2 bg-green-500/20 rounded-lg">
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700">
            +{formatCurrency(totalProfit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Profits disponibles
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 shadow-elegant hover:shadow-xl transition-all hover:scale-[1.02] duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contrats Actifs</CardTitle>
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700">{activeContracts}</div>
          <p className="text-xs text-muted-foreground mt-1">
            En cours
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
