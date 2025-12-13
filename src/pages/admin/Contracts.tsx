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
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, FileText, CheckCircle, TrendingUp, DollarSign, LayoutGrid, List, FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { EditContractDialog } from "@/components/admin/EditContractDialog";
import { AdminContractCard } from "@/components/admin/AdminContractCard";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

type ContractData = Database['public']['Tables']['contracts']['Row'] & {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

const PAGE_SIZE = 15;

const AdminContractsPage = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid'); // Default to Grid as per user request
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog
  const [selectedContract, setSelectedContract] = useState<ContractData | null>(null); // State for selected contract

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ["allContracts", debouncedSearchQuery, statusFilter, page, dateFrom, dateTo],
    queryFn: () => adminGetAllContracts(debouncedSearchQuery, statusFilter, page, PAGE_SIZE, dateFrom, dateTo),
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

  const handlePresetChange = (value: string) => {
    setDatePreset(value);
    const today = new Date();

    switch (value) {
      case "today":
        setDateFrom(format(startOfDay(today), "yyyy-MM-dd"));
        setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
        break;
      case "week":
        setDateFrom(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
        break;
      case "month":
        setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
        setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
        break;
      case "custom":
        setDateFrom("");
        setDateTo("");
        break;
      case "all":
        setDateFrom("");
        setDateTo("");
        break;
    }
    setPage(1);
  };

  // Export to CSV function
  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all contracts for current filters (using a large page size of 1000 or a dedicated export endpoint)
      // Since we don't have a dedicated export endpoint yet, we'll fetch page 1 with a huge size or assume the admin service can handle it.
      // For now, we will use the existing service with a large page limit.
      const { data: allContracts } = await adminGetAllContracts(debouncedSearchQuery, statusFilter, 1, 10000, dateFrom, dateTo);

      const headers = ["ID Contrat", "Client", "Email", "Montant", "Devise", "Statut", "Mois Payés", "Durée", "Profits Versés", "Date Début", "Date Fin"];
      const rows = allContracts.map(c => [
        c.id,
        `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        c.email,
        c.amount,
        c.currency,
        c.status,
        c.months_paid,
        c.duration_months,
        c.total_profit_paid,
        c.start_date,
        c.end_date
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contrats_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export réussi", description: `${allContracts.length} contrats exportés.` });
    } catch (error) {
      console.error("CSV Export failed:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Échec de l'export." });
    } finally {
      setIsExporting(false);
    }
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

      {/* Control Bar: Filters, View Toggle, Export */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">

        {/* Left: Search & Filter */}
        <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
          <Input
            placeholder="Rechercher par nom, email, ID..."
            className="w-full md:w-[250px]"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
              <SelectItem value="refunded">Remboursé</SelectItem>
              <SelectItem value="pending_refund">Demande Remb.</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Center/Right: Date Filters */}
        <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-center">
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout l'historique</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-[130px]" />
              <span className="text-muted-foreground">-</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[130px]" />
            </div>
          )}
        </div>

        {/* Right: Actions (Export, View) */}
        <div className="flex gap-2 w-full xl:w-auto justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            title={viewMode === 'list' ? "Vue Grille" : "Vue Liste"}
          >
            {viewMode === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={isExporting || totalCount === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? "Export..." : "CSV"}
          </Button>
        </div>
      </div>


      {/* Content Area */}
      {viewMode === 'list' ? (
        <div className="border border-border/50 rounded-lg bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/60">
                <TableHead>Utilisateur</TableHead>
                <TableHead>ID Contrat</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Progression</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
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
                    <TableCell className="font-mono text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded inline-block">
                      {contract.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(Number(contract.amount), contract.currency)}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(contract.status)} className="capitalize">{contract.status}</Badge></TableCell>
                    <TableCell>
                      <div className="w-[100px]">
                        <div className="text-xs text-muted-foreground mb-1">{contract.months_paid}/{contract.duration_months} mois</div>
                        <Progress value={(contract.months_paid / contract.duration_months) * 100} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>Du: {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: fr })}</div>
                      <div>Au: {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: fr })}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-secondary"><MoreHorizontal className="h-4 w-4" /></Button>
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
                  <TableCell colSpan={7} className="h-24 text-center">
                    Aucun résultat trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div >
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-[250px] rounded-lg" />)
          ) : contracts.length > 0 ? (
            contracts.map(contract => (
              <AdminContractCard
                key={contract.id}
                contract={contract}
                onEdit={handleEditClick}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <div className="text-muted-foreground">Aucun contrat trouvé pour ces critères.</div>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {page > 1 ? (
                <PaginationPrevious onClick={() => setPage(prev => Math.max(1, prev - 1))} className="cursor-pointer" />
              ) : (
                <Button variant="ghost" size="default" disabled className="gap-1 pl-2.5 text-muted-foreground">
                  <ChevronLeft className="h-4 w-4" />
                  <span>Précédent</span>
                </Button>
              )}
            </PaginationItem>

            <PaginationItem>
              <span className="text-sm font-medium p-2 text-muted-foreground">
                Page <span className="text-foreground">{page}</span> sur <span className="text-foreground">{totalPages}</span>
              </span>
            </PaginationItem>

            <PaginationItem>
              {page < totalPages ? (
                <PaginationNext onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} className="cursor-pointer" />
              ) : (
                <Button variant="ghost" size="default" disabled className="gap-1 pr-2.5 text-muted-foreground">
                  <span>Suivant</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {
        selectedContract && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <EditContractDialog
              contract={selectedContract}
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
            />
          </Dialog>
        )
      }
    </div >
  );
};

export default AdminContractsPage;
