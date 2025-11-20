
import { PendingWithdrawals } from "@/components/admin/PendingWithdrawals";
import { useQuery } from "@tanstack/react-query";
import { getPendingWithdrawals } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Hash, DollarSign, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

const PendingWithdrawalsPage = () => {
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["pendingWithdrawals"],
    queryFn: getPendingWithdrawals,
  });

  // Calculate stats
  const allWithdrawals = withdrawals || [];
  const totalAmount = allWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
  const oldestWithdrawal = allWithdrawals.length > 0
    ? Math.max(...allWithdrawals.map(w => differenceInDays(new Date(), new Date(w.created_at))))
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Demandes de Retrait en Attente</h1>
        <p className="text-muted-foreground">
          Approuvez ou rejetez les demandes de retrait des investisseurs
        </p>
        {!isLoading && withdrawals.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-200">
            <span className="text-sm text-muted-foreground">Demandes en attente:</span>
            <span className="text-base font-bold text-red-700">{withdrawals.length}</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Nombre Retraits</div>
                <Hash className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-700">
                {allWithdrawals.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                En attente de validation
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total à Approuver</div>
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700">
                {formatCurrency(totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme totale
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Plus Ancien</div>
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {oldestWithdrawal}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                jour{oldestWithdrawal > 1 ? 's' : ''} d'attente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <PendingWithdrawals />
    </div>
  );
};

export default PendingWithdrawalsPage;
