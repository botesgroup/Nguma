
import { PendingDeposits } from "@/components/admin/PendingDeposits";
import { useQuery } from "@tanstack/react-query";
import { getPendingDeposits } from "@/services/adminService";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Hash, DollarSign, TrendingUp, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

interface PendingDeposit {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  method: string;
  payment_reference?: string;
  payment_phone_number?: string;
  proof_url?: string;
  profile?: {
    full_name?: string;
    email?: string;
  };
}

const PendingDepositsPage = () => {
  const { data: deposits, isLoading } = useQuery({
    queryKey: ["pendingDeposits"],
    queryFn: async () => {
      const data = await getPendingDeposits();
      return data as unknown as PendingDeposit[];
    },
  });

  // Calculate stats
  const allDeposits = deposits || [];
  const totalAmount = allDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const avgAmount = allDeposits.length > 0 ? totalAmount / allDeposits.length : 0;
  const oldestDeposit = allDeposits.length > 0
    ? Math.max(...allDeposits.map(d => differenceInDays(new Date(), new Date(d.created_at))))
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Demandes de Dépôt en Attente</h1>
        <p className="text-muted-foreground">
          Approuvez ou rejetez les demandes de dépôt des investisseurs
        </p>
        {!isLoading && deposits.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
            <span className="text-sm text-muted-foreground">Demandes en attente:</span>
            <span className="text-base font-bold text-amber-700">{deposits.length}</span>
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
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Nombre Dépôts</div>
                <Hash className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {allDeposits.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                En attente de validation
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total à Approuver</div>
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme totale
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Montant Moyen</div>
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700">
                {formatCurrency(avgAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Par dépôt
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
                {oldestDeposit}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                jour{oldestDeposit > 1 ? 's' : ''} d'attente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <PendingDeposits />
    </div>
  );
};

export default PendingDepositsPage;
