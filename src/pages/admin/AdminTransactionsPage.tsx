import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getAdminTransactionHistory, getTransactionKPIs } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Search, Eye, Filter, ArrowLeft, ArrowRight, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, RotateCcw, XCircle } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, endOfDay, startOfDay } from "date-fns";

const AdminTransactionsPage = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [datePreset, setDatePreset] = useState("all");
    const [kpiPeriod, setKpiPeriod] = useState<"week" | "month" | "custom">("month");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const [proofModalOpen, setProofModalOpen] = useState(false);
    const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["adminTransactionHistory", searchQuery, typeFilter, statusFilter, page, dateFrom, dateTo],
        queryFn: () => getAdminTransactionHistory(searchQuery, typeFilter, statusFilter, page, pageSize, dateFrom, dateTo),
    });

    const { data: kpis, isLoading: isLoadingKPIs } = useQuery({
        queryKey: ["adminTransactionKPIs", dateFrom, dateTo],
        queryFn: () => getTransactionKPIs(dateFrom, dateTo),
    });

    const transactions = (data as any)?.data || [];
    const totalCount = (data as any)?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1);
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

    const resetFilters = () => {
        setSearchQuery("");
        setTypeFilter("all");
        setStatusFilter("all");
        setDatePreset("all");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'deposit': return 'bg-blue-100 text-blue-800';
            case 'withdrawal': return 'bg-red-100 text-red-800';
            case 'profit': return 'bg-green-100 text-green-800';
            case 'investment': return 'bg-purple-100 text-purple-800';
            case 'assurance': return 'bg-orange-100 text-orange-800';
            case 'refund': return 'bg-yellow-100 text-yellow-800';
            case 'admin_credit': return 'bg-indigo-100 text-indigo-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">Historique des Transactions</h1>
                <p className="text-muted-foreground">Consultez l'historique complet des dépôts, retraits et profits.</p>
            </div>

            {/* KPI Period Selector */}
            <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-medium">Période des KPIs:</label>
                <Select value={kpiPeriod} onValueChange={(v: "week" | "month" | "custom") => setKpiPeriod(v)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="week">Cette semaine</SelectItem>
                        <SelectItem value="month">Ce mois</SelectItem>
                        <SelectItem value="custom">Personnalisée</SelectItem>
                    </SelectContent>
                </Select>
                {kpiPeriod === "custom" && (
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-[150px]"
                            placeholder="Date début"
                        />
                        <span>-</span>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-[150px]"
                            placeholder="Date fin"
                        />
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4 text-blue-500" />
                            Total Dépôts (Période)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingKPIs ? "..." : formatCurrency(kpis?.[kpiPeriod]?.deposits || 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ArrowUpCircle className="h-4 w-4 text-rose-500" />
                            Total Retraits (Période)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingKPIs ? "..." : formatCurrency(kpis?.[kpiPeriod]?.withdrawals || 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ArrowLeftRight className="h-4 w-4 text-purple-500" />
                            Total Transferts (Période)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingKPIs ? "..." : formatCurrency(kpis?.[kpiPeriod]?.transfers || 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les types</SelectItem>
                                    <SelectItem value="deposit">Dépôts</SelectItem>
                                    <SelectItem value="withdrawal">Retraits</SelectItem>
                                    <SelectItem value="profit">Profits</SelectItem>
                                    <SelectItem value="investment">Investissements</SelectItem>
                                    <SelectItem value="refund">Remboursements</SelectItem>
                                    <SelectItem value="admin_credit">Crédits Admin</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="Statut" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les statuts</SelectItem>
                                    <SelectItem value="completed">Validé</SelectItem>
                                    <SelectItem value="pending">En attente</SelectItem>
                                    <SelectItem value="rejected">Rejeté</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
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
                                    <span>-</span>
                                    <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[130px]" />
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : transactions.length > 0 ? (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Utilisateur</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Montant</TableHead>
                                            <TableHead>Méthode</TableHead>
                                            <TableHead>Statut</TableHead>
                                            <TableHead className="text-right">Preuve</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map((tx: any) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{tx.user_full_name || 'Inconnu'}</div>
                                                    <div className="text-xs text-muted-foreground">{tx.user_email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={getTypeColor(tx.type)}>
                                                        {tx.type === 'deposit' ? 'Dépôt' :
                                                            tx.type === 'withdrawal' ? 'Retrait' :
                                                                tx.type === 'profit' ? 'Profit' :
                                                                    tx.type === 'investment' ? 'Investissement' :
                                                                        tx.type === 'assurance' ? 'Assurance' :
                                                                            tx.type === 'refund' ? 'Remboursement' :
                                                                                tx.type === 'admin_credit' ? 'Crédit Admin' :
                                                                                    tx.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-bold">
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                                <TableCell className="capitalize">
                                                    {tx.method?.replace(/_/g, ' ') || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={getStatusColor(tx.status)}>
                                                        {tx.status === 'completed' ? 'Validé' : tx.status === 'rejected' ? 'Rejeté' : 'En attente'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {tx.proof_url && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { 
                                                                let fullUrl = tx.proof_url;
                                                                if (fullUrl && !fullUrl.startsWith('http')) {
                                                                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                                                                    // Utiliser le type de transaction pour déterminer le bucket probable
                                                                    const bucket = tx.type === 'withdrawal' ? 'withdrawal-proofs' : 'payment_proofs';
                                                                    
                                                                    // Vérifier si le proof_url contient déjà le bucket (ex: "payment_proofs/image.jpg")
                                                                    if (fullUrl.startsWith(bucket + '/')) {
                                                                        fullUrl = `${supabaseUrl}/storage/v1/object/public/${fullUrl}`;
                                                                    } else {
                                                                        fullUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${fullUrl}`;
                                                                    }
                                                                }
                                                                setSelectedProofUrl(fullUrl); 
                                                                setProofModalOpen(true); 
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4 text-blue-500" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-4">
                                <div className="text-sm text-muted-foreground">
                                    Page {page} sur {totalPages} ({totalCount} résultats)
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                    >
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Aucune transaction trouvée pour ces critères.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Preuve de Paiement</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center items-center p-4 min-h-[70vh]">
                        {selectedProofUrl &&
                            (() => {
                                try {
                                    const isPdf = new URL(selectedProofUrl).pathname.toLowerCase().endsWith('.pdf');
                                    if (isPdf) {
                                        return (
                                            <iframe
                                                src={selectedProofUrl}
                                                className="w-full h-[70vh] border-0"
                                                title="Preuve de paiement PDF"
                                            />
                                        );
                                    }
                                } catch (e) {
                                    console.error("Invalid proof URL", e);
                                }
                                // Fallback to image for non-PDFs or invalid URLs
                                return (
                                    <img
                                        src={selectedProofUrl}
                                        alt="Preuve de paiement"
                                        className="max-w-full h-auto rounded-md shadow-sm object-contain"
                                    />
                                );
                            })()}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const SkeletonLoader = () => (
    <div className="space-y-3">
        <div className="h-6 bg-muted/20 animate-pulse rounded"></div>
        <div className="h-6 bg-muted/20 animate-pulse rounded"></div>
        <div className="h-8 bg-muted/20 animate-pulse rounded border-t border-muted/10 pt-2"></div>
    </div>
);

export default AdminTransactionsPage;
