import { PendingRefunds } from "@/components/admin/PendingRefunds";
import { useQuery } from "@tanstack/react-query";
import { getPendingRefunds } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Hash, DollarSign, TrendingUp, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

type PendingRefund = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  start_date: string;
  months_paid: number;
  duration_months: number;
  total_profit_paid: number;
  email: string;
  full_name: string;
};

const PendingRefundsPage = () => {
  const { data: refunds, isLoading } = useQuery<PendingRefund[]>({
    queryKey: ["pendingRefunds"],
    queryFn: getPendingRefunds,
  });

  // Calculate stats
  const allRefunds = refunds || [];
  const totalRefundAmount = allRefunds.reduce((sum, r) => {
    const refundAmount = Math.max(0, Number(r.amount) - Number(r.total_profit_paid));
    return sum + refundAmount;
  }, 0);
  const avgRefundAmount = allRefunds.length > 0 ? totalRefundAmount / allRefunds.length : 0;
  const oldestRefund = allRefunds.length > 0
    ? Math.max(...allRefunds.map(r => differenceInDays(new Date(), new Date(r.start_date))))
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Demandes de Remboursement en Attente</h1>
        <p className="text-muted-foreground">
          Approuvez ou rejetez les demandes de remboursement des contrats
        </p>
        {!isLoading && refunds.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
            <span className="text-sm text-muted-foreground"> Contrats à rembourser:</span>
            <span className="text-base font-bold text-amber-700">{refunds.length}</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Nombre Remboursements</div>
                <Hash className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700">
                {allRefunds.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                En attente de validation
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total à Rembourser</div>
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(totalRefundAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Après déduction profits
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Montant Moyen</div>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(avgRefundAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Par remboursement
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Plus Ancien Contrat</div>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {oldestRefund}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                jour{oldestRefund > 1 ? 's' : ''} depuis création
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <PendingRefunds />
    </div>
  );
};

export default PendingRefundsPage;
