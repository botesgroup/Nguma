import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInvestorsList, exportInvestorsList, activateUser, deactivateUser, InvestorFilters } from "@/services/adminService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { COUNTRIES, getCountryName, getCountryFlag } from "@/lib/countries";
import { supabase } from "@/integrations/supabase/client";
import { MoreHorizontal, FileDown, AlertTriangle, CheckCircle, Edit, Filter, X, Calendar, Phone, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { CreditUserDialog } from "@/components/admin/CreditUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

type Contract = { status: string; };
type Wallet = { total_balance: number; invested_balance: number; profit_balance: number; currency: string; };
export type Investor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  post_nom: string | null;
  email: string;
  phone: string | null;
  banned_until: string | null;
  created_at?: string;
  wallet: Wallet | null;
  contracts: Contract[] | null;
  total_invested?: number;
};

const getInvestorStatus = (contracts: Contract[] | null): "Active" | "Inactive" | "New" => {
  if (!contracts) return "New";
  const hasActiveContract = contracts.some(c => c.status === 'active');
  if (hasActiveContract) return "Active";
  if (contracts.length > 0) return "Inactive";
  return "New";
};

const PnlCell = ({ wallet }: { wallet: Wallet | null }) => {
  if (!wallet || !wallet.invested_balance || Number(wallet.invested_balance) === 0) return <div className="text-text-secondary">N/A</div>;
  const pnl = (Number(wallet.profit_balance) / Number(wallet.invested_balance)) * 100;
  const isPositive = pnl >= 0;
  return (
    <div>
      <div className={`w-full bg-opacity-20 rounded-full h-2 ${isPositive ? 'bg-primary' : 'bg-destructive'}`}><div className={`h-2 rounded-full ${isPositive ? 'bg-primary' : 'bg-destructive'}`} style={{ width: `${Math.min(Math.abs(pnl), 100)}%` }}></div></div>
      <div className={`text-xs mt-1 ${isPositive ? 'text-primary' : 'text-destructive'}`}>{isPositive ? '+' : ''}{pnl.toFixed(1)}%</div>
    </div>
  );
};

const StatusCell = ({ contracts }: { contracts: Contract[] | null }) => {
  const status = getInvestorStatus(contracts);
  const variant = status === 'Active' ? 'bg-primary/20 text-primary' : status === 'Inactive' ? 'secondary' : 'outline';
  return <Badge className={variant}>{status}</Badge>;
};

// Check if user is new (registered < 7 days ago)
const isNewUser = (createdAt?: string): boolean => {
  if (!createdAt) return false;
  const daysDiff = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= 7;
};

// Count active contracts
const countActiveContracts = (contracts: Contract[] | null): number => {
  if (!contracts) return 0;
  return contracts.filter(c => c.status === 'active').length;
};

const PAGE_SIZE = 10;

export const InvestorListTable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isExporting, setIsExporting] = useState(false);
  const [activationDialog, setActivationDialog] = useState<{ isOpen: boolean; user?: Investor; action?: 'activate' | 'deactivate' }>({ isOpen: false });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minInvested, setMinInvested] = useState("");
  const [maxInvested, setMaxInvested] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  // New state for cities filter
  const [citiesForFilter, setCitiesForFilter] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  useEffect(() => {
    const fetchCities = async () => {
      if (!country) {
        setCitiesForFilter([]);
        return;
      }
      setIsLoadingCities(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-cities', {
          body: { countryCode: country },
        });
        if (error) throw error;
        setCitiesForFilter(data || []);
      } catch (error) {
        console.error("Failed to fetch cities for filter:", error);
        setCitiesForFilter([]);
      } finally {
        setIsLoadingCities(false);
      }
    };

    fetchCities();
  }, [country]);

  // Build filters object
  const filters: InvestorFilters = {
    searchQuery: debouncedSearchQuery || undefined,
    page,
    pageSize: PAGE_SIZE,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    minInvested: minInvested ? parseFloat(minInvested) : undefined,
    maxInvested: maxInvested ? parseFloat(maxInvested) : undefined,
    country: country || undefined,
    city: city || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  };

  const hasAdvancedFilters = dateFrom || dateTo || minInvested || maxInvested || country || city;

  const { data, isLoading } = useQuery<{ data: Investor[], count: number }>({
    queryKey: ["investorsList", debouncedSearchQuery, page, statusFilter, dateFrom, dateTo, minInvested, maxInvested, country, city],
    queryFn: () => getInvestorsList(filters),
  });

  const investors = data?.data || [];
  const totalCount = data?.count || 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  const activationMutation = useMutation({
    mutationFn: (user: Investor) => {
      const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
      return isBanned ? activateUser(user.id) : deactivateUser(user.id);
    },
    onSuccess: (_, user) => {
      const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
      toast({ title: "Succès", description: `Utilisateur ${isBanned ? 'activé' : 'désactivé'} avec succès.` });
      queryClient.invalidateQueries({ queryKey: ["investorsList"] });
    },
    onError: (error) => toast({ variant: "destructive", title: "Erreur", description: error.message }),
    onSettled: () => setActivationDialog({ isOpen: false }),
  });

  const clearAdvancedFilters = () => {
    setDateFrom("");
    setDateTo("");
    setMinInvested("");
    setMaxInvested("");
    setCountry("");
    setCity("");
    setPage(1);
  };

  // Export to CSV function
  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all filtered data for export
      const allInvestors = await exportInvestorsList(filters);

      const headers = ["Nom", "Email", "Téléphone", "Balance", "Investi", "Profits", "Statut", "Date Inscription"];
      const rows = allInvestors.map(inv => [
        `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || "N/A",
        inv.email,
        inv.phone || "N/A",
        inv.total_balance || 0,
        inv.invested_balance || 0,
        inv.profit_balance || 0,
        inv.status,
        inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : "N/A"
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `investisseurs_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export réussi", description: `${allInvestors.length} investisseurs exportés.` });
    } catch (error) {
      console.error("CSV Export failed:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Échec de l'export." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="lg:col-span-2 flex flex-col rounded-lg bg-background-card border border-white/10 p-6">
        {/* Header with Search and Filters */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Investisseurs ({totalCount})</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={isExporting || investors.length === 0}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {isExporting ? "Export..." : "Exporter CSV"}
              </Button>
              <Select 
                value={statusFilter} 
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="Active">Actifs</SelectItem>
                  <SelectItem value="Inactive">Inactifs</SelectItem>
                  <SelectItem value="New">Nouveaux</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="flex-1"
            />

            <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
              <PopoverTrigger asChild>
                <Button variant={hasAdvancedFilters ? "default" : "outline"} size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filtres avancés</h4>
                    {hasAdvancedFilters && (
                      <Button variant="ghost" size="sm" onClick={clearAdvancedFilters}>
                        <X className="h-4 w-4 mr-1" /> Effacer
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> Date d'inscription
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Du</Label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Au</Label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Montant investi (USD)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Min</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={minInvested}
                          onChange={(e) => { setMinInvested(e.target.value); setPage(1); }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max</Label>
                        <Input
                          type="number"
                          placeholder="∞"
                          value={maxInvested}
                          onChange={(e) => { setMaxInvested(e.target.value); setPage(1); }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">📍 Localisation</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Pays</Label>
                        <Select value={country} onValueChange={(value) => { setCountry(value); setCity(""); setPage(1); }}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Pays" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Ville</Label>
                        <Select
                          value={city}
                          onValueChange={(value) => { setCity(value); setPage(1); }}
                          disabled={!country || isLoadingCities}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={isLoadingCities ? "Chargement..." : "Ville"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {citiesForFilter.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => setShowAdvancedFilters(false)}>
                    Appliquer les filtres
                  </Button>

                  {(minInvested || maxInvested) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMinInvested("");
                        setMaxInvested("");
                      }}
                      className="w-full mt-1"
                    >
                      Réinitialiser le montant
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Active filters display */}
          {hasAdvancedFilters && (
            <div className="flex flex-wrap gap-2">
              {dateFrom && (
                <Badge variant="secondary" className="gap-1">
                  Depuis: {dateFrom}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setDateFrom("")} />
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="gap-1">
                  Jusqu'à: {dateTo}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setDateTo("")} />
                </Badge>
              )}
              {minInvested && (
                <Badge variant="secondary" className="gap-1">
                  Min: ${minInvested}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setMinInvested("")} />
                </Badge>
              )}
              {maxInvested && (
                <Badge variant="secondary" className="gap-1">
                  Max: ${maxInvested}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setMaxInvested("")} />
                </Badge>
              )}
              {country && (
                <Badge variant="secondary" className="gap-1">
                  <span className="text-lg">{getCountryFlag(country)}</span> {getCountryName(country)}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCountry("")} />
                </Badge>
              )}
              {city && (
                <Badge variant="secondary" className="gap-1">
                  📍 {city}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCity("")} />
                </Badge>
              )}
            </div>
          )}

          {/* Aide pour les filtres restrictifs */}
          {investors && investors.length < 5 && investors.length > 0 && (
            <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded mb-2">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {investors.length} {investors.length === 1 ? 'résultat' : 'résultats'} trouvé{investors.length > 1 ? 's' : ''}.
              Vos filtres sont peut-être trop spécifiques.
              {!hasAdvancedFilters && (
                <span> Essayez d'utiliser des filtres avancés pour affiner votre recherche.</span>
              )}
            </div>
          )}

          {investors && investors.length === 0 && hasAdvancedFilters && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">
              <X className="h-4 w-4 inline mr-1" />
              Aucun résultat trouvé. Essayez d'élargir vos critères de recherche.
            </div>
          )}
        </div>

        <div className="overflow-x-auto flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Contrats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-3 w-32 mt-1" />
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : investors.length > 0 ? (
                investors.map((investor) => {
                  const isBanned = investor.banned_until && new Date(investor.banned_until) > new Date();
                  const activeContractsCount = countActiveContracts(investor.contracts);
                  return (
                    <TableRow key={investor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{`${investor.first_name || ''} ${investor.last_name || ''}`.trim() || "N/A"}</span>
                          {isBanned && <Badge variant="destructive">Banni</Badge>}
                          {isNewUser(investor.created_at) && <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white"><Sparkles className="h-3 w-3 mr-1" />Nouveau</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">{investor.email}</div>
                      </TableCell>
                      <TableCell>
                        {investor.phone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {investor.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{investor.wallet ? formatCurrency(Number(investor.wallet.total_balance), investor.wallet.currency) : 'N/A'}</TableCell>
                      <TableCell>
                        {activeContractsCount > 0 ? (
                          <Badge variant="outline" className="bg-primary/10">{activeContractsCount} actif{activeContractsCount > 1 ? 's' : ''}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">0</span>
                        )}
                      </TableCell>
                      <TableCell><StatusCell contracts={investor.contracts} /></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Dialog><DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Voir les détails</DropdownMenuItem></DialogTrigger><UserDetailDialog userId={investor.id} /></Dialog>
                            <Dialog><DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Edit className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem></DialogTrigger><EditUserDialog user={investor} /></Dialog>
                            <DropdownMenuItem onSelect={() => navigate(`/admin/user-contracts?userId=${investor.id}`)}>Voir les contrats</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <Dialog><DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Créditer l'utilisateur</DropdownMenuItem></DialogTrigger><CreditUserDialog userId={investor.id} userEmail={investor.email} /></Dialog>
                            <DropdownMenuSeparator />
                            {isBanned ? (
                              <DropdownMenuItem onSelect={() => setActivationDialog({ isOpen: true, user: investor, action: 'activate' })} className="text-green-500 focus:text-green-600"><CheckCircle className="mr-2 h-4 w-4" />Activer</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => setActivationDialog({ isOpen: true, user: investor, action: 'deactivate' })} className="text-red-500 focus:text-red-600"><AlertTriangle className="mr-2 h-4 w-4" />Désactiver</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg m-4 border border-blue-100">
                      <div className="text-6xl mb-4">👥</div>
                      <h3 className="text-2xl font-semibold mb-2 text-blue-900">
                        Aucun investisseur trouvé
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

        {/* Pagination */}
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Page {page} sur {pageCount || 1} ({totalCount} résultats)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>

      {/* Activation/Deactivation Confirmation Dialog */}
      <AlertDialog open={activationDialog.isOpen} onOpenChange={(open) => setActivationDialog({ isOpen: open }) }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va {activationDialog.action === 'activate' ? "réactiver" : "désactiver"} l'utilisateur <strong>{activationDialog.user?.email}</strong>.
              {activationDialog.action === 'deactivate' && " Il ne pourra plus se connecter."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => activationDialog.user && activationMutation.mutate(activationDialog.user)} className={activationDialog.action === 'deactivate' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};