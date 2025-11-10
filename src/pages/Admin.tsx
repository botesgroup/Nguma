
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminDashboardStats } from "@/services/adminService";
import { formatCurrency } from "@/lib/utils";
import { AdminProfitChart } from "@/components/admin/AdminProfitChart";
import { CashFlowChart } from "@/components/admin/CashFlowChart";
import { UserGrowthChart } from "@/components/admin/UserGrowthChart";
import { InvestorListTable } from "@/components/admin/InvestorListTable";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const StatCard = ({ title, value, glowing = false, glowingColor = 'green' }: { title: string, value: string, glowing?: boolean, glowingColor?: 'green' | 'red' }) => {
  const glowClass = glowing ? (glowingColor === 'green' ? 'glowing-border-green' : 'glowing-border-red') : '';
  const valueColor = glowing ? (glowingColor === 'green' ? 'text-primary' : 'text-destructive') : 'text-text-primary';

  return (
    <div className={`flex min-w-[158px] flex-1 flex-col gap-2 rounded-lg p-6 bg-background-card border border-white/10 hover:border-primary/50 transition-all duration-300 ${glowClass}`}>
      <p className="text-text-secondary text-base font-medium leading-normal">{title}</p>
      <p className={`tracking-light text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
    </div>
  );
};

const AdminPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: getAdminDashboardStats,
  });

  useEffect(() => {
    const channel = supabase.channel('admin-dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          // When a change occurs in transactions (like approve/reject), invalidate stats to refetch
          queryClient.invalidateQueries({ queryKey: ['adminStats'] });
          queryClient.invalidateQueries({ queryKey: ['cashFlowSummary'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'auth', table: 'users' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['userGrowthSummary'] });
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  return (
    <div className="p-8 neon-grid-bg">
      {/* PageHeading */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-4">
        <p className="text-text-primary text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Tableau de Bord Administrateur</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 py-4">
        <StatCard title="Investisseurs" value={isLoading ? '...' : stats?.total_investors?.toLocaleString() || '0'} />
        <StatCard title="Fonds Sous Gestion" value={isLoading ? '...' : formatCurrency(stats?.funds_under_management || 0)} />
        <StatCard title="Profit Total" value={isLoading ? '...' : formatCurrency(stats?.total_profit || 0)} glowing={true} glowingColor="green" />
        <div className="cursor-pointer" onClick={() => navigate('/admin/deposits')}>
          <StatCard title="Dépôts en Attente" value={isLoading ? '...' : formatCurrency(stats?.pending_deposits || 0)} glowing={true} glowingColor="red" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/admin/withdrawals')}>
          <StatCard title="Retraits en Attente" value={isLoading ? '...' : formatCurrency(stats?.pending_withdrawals || 0)} glowing={true} glowingColor="red" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-6">
        <div className="lg:col-span-1">
          <AdminProfitChart />
        </div>
        <div className="lg:col-span-1">
          <CashFlowChart />
        </div>
        <div className="lg:col-span-1">
          <UserGrowthChart />
        </div>
      </div>

      {/* Investor Table */}
      <div className="py-6">
        <InvestorListTable />
      </div>
    </div>
  );
};

export default AdminPage;
