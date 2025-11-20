
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserContracts, getUserDetails } from "@/services/adminService";
import { ContractCard } from "@/components/ContractCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, DollarSign, TrendingUp, FileText, Plus } from "lucide-react";

const AdminUserContractsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get("userId");

  const { data: userDetails, isLoading: isLoadingUser } = useQuery({
    queryKey: ["userDetailsForContractsPage", userId],
    queryFn: () => getUserDetails(userId!),
    enabled: !!userId,
  });

  const { data: contracts, isLoading: isLoadingContracts } = useQuery({
    queryKey: ["userContractsAdmin", userId],
    queryFn: () => getUserContracts(userId!),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Aucun utilisateur sélectionné.</p>
        <Button onClick={() => navigate("/admin")} className="mt-4">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  const isLoading = isLoadingUser || isLoadingContracts;
  const userName = userDetails?.profile?.full_name || userDetails?.profile?.email || `Utilisateur ${userId?.substring(0, 8)}`;
  const userEmail = userDetails?.profile?.email;

  // Calculate stats
  const userContracts = contracts || [];
  const totalInvested = userContracts.reduce((sum, c) => sum + Number(c.invested_amount), 0);
  const totalProfits = userContracts.reduce((sum, c) => sum + Number(c.total_profit_paid || 0), 0);
  const activeContractsCount = userContracts.filter(c => c.status === 'active').length;

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isLoading ? (
          <Skeleton className="h-12 w-1/2" />
        ) : (
          <div>
            <h1 className="text-3xl font-bold">Contrats de {userName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <span>{userEmail}</span>
              <span>•</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {userId}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Skeleton className="h-[100px] rounded-lg" />
          <Skeleton className="h-[100px] rounded-lg" />
          <Skeleton className="h-[100px] rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Investi</div>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(totalInvested)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Profits Générés</div>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(totalProfits)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Contrats Actifs</div>
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {activeContractsCount} <span className="text-sm font-normal text-muted-foreground">/ {userContracts.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : userContracts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userContracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              formatCurrency={(amount) => formatCurrency(amount, 'USD')}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-2xl font-semibold mb-2 text-gray-900">
            Aucun contrat actif
          </h3>
          <p className="text-muted-foreground mb-6">
            Cet utilisateur n'a pas encore d'investissement.
          </p>
          {/* Note: Add functionality to create contract if needed here */}
        </div>
      )}
    </div>
  );
};

export default AdminUserContractsPage;
