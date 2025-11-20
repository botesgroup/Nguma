
import { InvestorListTable } from "@/components/admin/InvestorListTable";
import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardStats, getUserGrowthSummary } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, UserCheck } from "lucide-react";

const UsersPage = () => {
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["adminStats"],
    queryFn: getAdminDashboardStats,
  });

  const { data: growth, isLoading: isLoadingGrowth } = useQuery({
    queryKey: ["userGrowth"],
    queryFn: getUserGrowthSummary,
  });

  // Calculate stats
  const totalInvestors = stats?.total_investors || 0;
  const activeInvestors = stats?.active_investors || 0; // Assuming this field exists or we use a proxy

  // Calculate new users this month
  const currentMonth = new Date().toLocaleString('default', { month: 'short', year: 'numeric' });
  const newUsersThisMonth = growth?.find(g => g.month_year === currentMonth)?.new_users_count || 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Investisseurs</h1>
        <p className="text-muted-foreground">
          Affichez et gérez les comptes des investisseurs de la plateforme.
        </p>
      </div>

      {/* Stats Cards */}
      {(isLoadingStats || isLoadingGrowth) ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Investisseurs</div>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {totalInvestors}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Inscrits sur la plateforme
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Nouveaux (Ce mois)</div>
                <UserPlus className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                +{newUsersThisMonth}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Croissance mensuelle
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Investisseurs Actifs</div>
                <UserCheck className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {activeInvestors}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avec contrats en cours
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <InvestorListTable />
    </div>
  );
};

export default UsersPage;
