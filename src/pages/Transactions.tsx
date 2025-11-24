import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllTransactions } from "@/services/transactionService";
import { getWallet } from "@/services/walletService";
import { supabase } from "@/integrations/supabase/client";
import { useUserTransactionsRealtime } from "@/hooks/useRealtimeSync";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const TransactionsPage = () => {
  // Get current user ID for Realtime filtering
  const { data: { user } = {} } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => supabase.auth.getUser(),
  });

  // Enable Realtime synchronization for transactions
  useUserTransactionsRealtime(user?.id);

  const [transactionType, setTransactionType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Default page size

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: getWallet });

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ["allTransactions", transactionType, searchQuery, page, pageSize],
    queryFn: () => getAllTransactions({ type: transactionType, search: searchQuery, page, pageSize }),
    placeholderData: { transactions: [], count: 0 },
  });

  // Fetch all transactions for stats (without pagination)
  const { data: allTransactionsData } = useQuery({
    queryKey: ["allTransactionsStats", transactionType, searchQuery],
    queryFn: () => getAllTransactions({ type: transactionType, search: searchQuery }),
    placeholderData: { transactions: [], count: 0 },
  });

  const transactions = paginatedData?.transactions;
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Calculate stats
  const allTx = allTransactionsData?.transactions || [];
  const totalDeposits = allTx
    .filter(tx => tx.type === 'deposit')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalWithdrawals = allTx
    .filter(tx => tx.type === 'withdrawal')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const netBalance = totalDeposits - totalWithdrawals;

  const localFormatCurrency = (amount: number) => {
    return formatCurrency(amount, wallet?.currency || 'USD');
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'failed':
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const exportToCsv = async () => {
    const allFilteredTransactionsResult = await getAllTransactions({ type: transactionType, search: searchQuery });
    const allTransactions = allFilteredTransactionsResult.transactions;

    if (!allTransactions || allTransactions.length === 0) {
      alert("Aucune transaction à exporter.");
      return;
    }

    const headers = ["Date", "Type", "Description", "Statut", "Montant", "Devise"].join(",");
    const csvContent = allTransactions.map(tx => {
      const date = format(new Date(tx.created_at), "dd/MM/yyyy HH:mm");
      const amount = `${tx.type === 'withdrawal' || tx.type === 'investment' ? "-" : "+"}${Number(tx.amount).toFixed(2)}`;
      return [date, tx.type, `"${tx.description?.replace(/"/g, '""') || ''}"`, tx.status, amount, tx.currency].join(",");
    }).join("\n");

    const fullCsv = `${headers}\n${csvContent}`;
    const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Historique des Transactions</h1>
        <p className="text-muted-foreground">Consultez et filtrez toutes vos transactions.</p>
      </div>

      {/* Summary Stats - 3 Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Dépôts</div>
                <ArrowDownCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                +{localFormatCurrency(totalDeposits)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme des dépôts filtrés
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Total Retraits</div>
                <ArrowUpCircle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-700">
                -{localFormatCurrency(totalWithdrawals)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somme des retraits filtrés
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Solde Net</div>
                <Wallet className="h-4 w-4 text-blue-600" />
              </div>
              <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {netBalance >= 0 ? '+' : ''}{localFormatCurrency(netBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Dépôts - Retraits
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Rechercher par description..."
          className="max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select value={transactionType} onValueChange={setTransactionType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="deposit">Dépôt</SelectItem>
            <SelectItem value="withdrawal">Retrait</SelectItem>
            <SelectItem value="investment">Investissement</SelectItem>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="refund">Remboursement</SelectItem>
            <SelectItem value="admin_credit">Crédit Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportToCsv}>Exporter en CSV</Button>
      </div>

      {/* Transactions Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(pageSize)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : transactions && transactions.length > 0 ? (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="capitalize">{tx.type}</TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell><Badge variant={getStatusVariant(tx.status)} className="capitalize">{tx.status}</Badge></TableCell>
                  <TableCell className={`text-right font-medium ${tx.type === 'deposit' || tx.type === 'profit' ? 'text-profit' : tx.type === 'withdrawal' ? 'text-loss' : ''
                    }`}>
                    {tx.type === 'withdrawal' || tx.type === 'investment' ? "-" : "+"}
                    {localFormatCurrency(Number(tx.amount))}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Aucune transaction trouvée.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage(prev => Math.max(1, prev - 1))}
                isActive={page > 1} />
            </PaginationItem>
            <PaginationItem>
              {/* Display current page / total pages */}
              <span className="text-sm font-medium leading-none flex h-9 w-9 items-center justify-center">
                {page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                isActive={page < totalPages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default TransactionsPage;