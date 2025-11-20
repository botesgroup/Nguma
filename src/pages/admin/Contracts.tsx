import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminGetAllContracts } from "@/services/adminService";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, FileText, CheckCircle, TrendingUp, DollarSign } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { EditContractDialog } from "@/components/admin/EditContractDialog";

type ContractData = Database['public']['Tables']['contracts']['Row'] & {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

const PAGE_SIZE = 15;

const AdminContractsPage = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog
  const [selectedContract, setSelectedContract] = useState<ContractData | null>(null); // State for selected contract

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ["allContracts", debouncedSearchQuery, statusFilter, page],
    queryFn: () => adminGetAllContracts(debouncedSearchQuery, statusFilter, page, PAGE_SIZE),
    placeholderData: { data: [], count: 0 },
  });

  const contracts = paginatedData?.data as ContractData[] || [];
  const totalCount = paginatedData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Calculate stats
  const activeContracts = contracts.filter(c => c.status === 'active');
  const totalValue = contracts.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalProfits = contracts.reduce((sum, c) => sum + Number(c.total_profit_paid || 0), 0);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'refunded': return 'destructive';
      case 'pending_refund': return 'outline'; // Added pending_refund status
      case 'cancelled': return 'destructive'; // Added cancelled status
      default: return 'outline';
    }
  };

  const handleEditClick = (contract: ContractData) => {
    setSelectedContract(contract);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gestion des Contrats</h1>
        <p className="text-muted-foreground">Consultez et filtrez tous les contrats de la plateforme.</p>
        {!isLoading && totalCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <span className="text-sm text-muted-foreground">Contrats trouvés:</span>
            <span className="text-base font-bold text-blue-700">{totalCount}</span>
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
                <div className="text-sm text-muted-foreground">Total Contrats</div>
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {totalCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sur la plateforme
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Contrats Actifs</div>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                {activeContracts.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                En cours de paiement
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Valeur Totale</div>
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(totalValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tous contrats confondus
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Profits Générés</div>
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700">
                {formatCurrency(totalProfits)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Versés aux investisseurs
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Rechercher par nom, email, ID contrat..."
          className="max-w-sm"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
        />
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
            <SelectItem value="refunded">Remboursé</SelectItem>
            <SelectItem value="pending_refund">Demande Remboursement</SelectItem> {/* Added pending_refund */}
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contracts Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>ID Contrat</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date de début</TableHead>
              <TableHead>Date de fin</TableHead>
              <TableHead>Mois Payés</TableHead>
              <TableHead className="text-center">Actions</TableHead> {/* Added Actions column */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : contracts.length > 0 ? (
              contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <div className="font-medium">{`${contract.first_name || ''} ${contract.last_name || ''}`.trim()}</div>
                    <div className="text-sm text-muted-foreground">{contract.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{contract.id.substring(0, 8)}</TableCell>
                  <TableCell>{formatCurrency(Number(contract.amount), contract.currency)}</TableCell>
                  <TableCell><Badge variant={getStatusVariant(contract.status)} className="capitalize">{contract.status}</Badge></TableCell>
                  <TableCell>{format(new Date(contract.start_date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                  <TableCell>{format(new Date(contract.end_date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                  <TableCell>{contract.months_paid} / {contract.duration_months}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Ouvrir le menu</span><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEditClick(contract)}>
                          <Edit className="mr-2 h-4 w-4" /> Modifier
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg m-4 border border-slate-200">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-2xl font-semibold mb-2 text-slate-900">
                      Aucun contrat trouvé
                    </h3>
                    <p className="text-muted-foreground">
                      Essayez de modifier vos filtres de recherche.
                    </p>
                  </div>
                </TableCell>
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
                disabled={page <= 1} />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm font-medium p-2">
                Page {page} sur {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {selectedContract && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <EditContractDialog
            contract={selectedContract}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />
        </Dialog>
      )}
    </div>
  );
};

export default AdminContractsPage;
