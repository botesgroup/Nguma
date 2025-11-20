
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, DollarSign, CircleDot } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TransactionData = Database['public']['Tables']['transactions']['Row'];

interface TransactionTableProps {
  recentTransactions: TransactionData[] | undefined;
  formatCurrency: (amount: number) => string;
}

/**
 * TransactionTable Component - Enhanced with Icons
 * 
 * Displays a list of recent transactions with type-specific icons
 */
export const TransactionTable = ({ recentTransactions, formatCurrency }: TransactionTableProps) => {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="h-5 w-5 text-green-600" />;
      case 'withdrawal':
        return <ArrowUpCircle className="h-5 w-5 text-red-600" />;
      case 'profit':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'investment':
        return <DollarSign className="h-5 w-5 text-blue-600" />;
      default:
        return <CircleDot className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      'deposit': 'Dépôt',
      'withdrawal': 'Retrait',
      'profit': 'Profit',
      'investment': 'Investissement',
      'refund': 'Remboursement',
      'admin_credit': 'Crédit Admin'
    };
    return labels[type] || type;
  };

  return (
    <Card className="shadow-elegant border-border/50">
      <CardHeader>
        <CardTitle>Dernières Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTransactions && recentTransactions.length > 0 ? (
            recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getTransactionIcon(transaction.type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{getTransactionLabel(transaction.type)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(transaction.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>

                {/* Amount */}
                <div
                  className={`text-lg font-semibold ${transaction.type === "profit" || transaction.type === "deposit"
                    ? "text-profit"
                    : transaction.type === "withdrawal"
                      ? "text-loss"
                      : ""
                    }`}
                >
                  {transaction.type === "withdrawal" ? "-" : "+"}
                  {formatCurrency(Number(transaction.amount))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-dashed border-purple-200">
              <div className="text-6xl mb-4">💳</div>
              <h3 className="text-2xl font-semibold mb-2 text-purple-900">
                Aucune transaction récente
              </h3>
              <p className="text-muted-foreground">
                Vos transactions apparaîtront ici
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
