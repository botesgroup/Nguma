
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInvestorsList, activateUser, deactivateUser } from "@/services/adminService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { MoreHorizontal, FileDown, AlertTriangle, CheckCircle, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { CreditUserDialog } from "@/components/admin/CreditUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  wallet: Wallet | null;
  contracts: Contract[] | null;
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

  const { data, isLoading } = useQuery<{ data: Investor[], count: number }>({ 
    queryKey: ["investorsList", debouncedSearchQuery, page],
    queryFn: () => getInvestorsList(debouncedSearchQuery, page, PAGE_SIZE),
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

  const handleExport = async () => { /* ... existing export logic ... */ };

  const filteredInvestors = investors.filter(investor => {
    if (statusFilter === 'all') return true;
    return getInvestorStatus(investor.contracts) === statusFilter;
  });

  return (
    <>
      <div className="lg:col-span-2 flex flex-col rounded-lg bg-background-card border border-white/10 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Investors</h3>
          {/* ... header content ... */}
        </div>
        <div className="overflow-x-auto flex-grow">
          <Table>
            {/* Table Header */}
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>PNL %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Chargement...</TableCell></TableRow>
              ) : filteredInvestors.length > 0 ? (
                filteredInvestors.map((investor) => {
                  const isBanned = investor.banned_until && new Date(investor.banned_until) > new Date();
                  return (
                    <TableRow key={investor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{`${investor.first_name || ''} ${investor.last_name || ''}`.trim() || "N/A"}</span>
                          {isBanned && <Badge variant="destructive">Banni</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">{investor.email}</div>
                      </TableCell>
                      <TableCell>{investor.wallet ? formatCurrency(Number(investor.wallet.total_balance), investor.wallet.currency) : 'N/A'}</TableCell>
                      <TableCell><PnlCell wallet={investor.wallet} /></TableCell>
                      <TableCell><StatusCell contracts={investor.contracts} /></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Dialog><DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Voir les détails</DropdownMenuItem></DialogTrigger><UserDetailDialog userId={investor.id} /></Dialog>
                            <Dialog><DialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Edit className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem></DialogTrigger><EditUserDialog user={investor} /></Dialog>
                            <DropdownMenuItem onSelect={() => navigate(`/admin/contracts?userId=${investor.id}`)}>Voir les contrats</DropdownMenuItem>
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
                <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun investisseur trouvé.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-end space-x-2 py-4">
          {/* ... pagination content ... */}
        </div>
      </div>

      {/* Activation/Deactivation Confirmation Dialog */}
      <AlertDialog open={activationDialog.isOpen} onOpenChange={(open) => setActivationDialog({ isOpen: open })}>
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
