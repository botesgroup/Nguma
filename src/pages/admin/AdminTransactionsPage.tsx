import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getAdminTransactionHistory } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Search, Eye, Filter, ArrowLeft, ArrowRight } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, endOfDay, startOfDay } from "date-fns";

const AdminTransactionsPage = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [datePreset, setDatePreset] = useState("all");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const [proofModalOpen, setProofModalOpen] = useState(false);
    const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["adminTransactionHistory", searchQuery, typeFilter, statusFilter, page, dateFrom, dateTo],
        queryFn: () => getAdminTransactionHistory(searchQuery, typeFilter, statusFilter, page, pageSize, dateFrom, dateTo),
    });

    const transactions = data?.data || [];
    const totalCount = data?.count || 0;
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

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'deposit': return 'bg-blue-100 text-blue-800';
            case 'withdrawal': return 'bg-red-100 text-red-800';
            case 'profit': return 'bg-green-100 text-green-800';
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
        <div className="p-8 space-y-8 neon-grid-bg min-h-screen">
            <div>
                <h1 className="text-4xl font-black tracking-tight text-text-primary mb-2">Historique des Transactions</h1>
                <p className="text-muted-foreground">Consultez l'historique complet des dépôts, retraits et profits.</p>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border">
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher par email, nom ou ID..."
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    className="pl-8"
                                />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les types</SelectItem>
                                        <SelectItem value="deposit">Dépôts</SelectItem>
                                        <SelectItem value="withdrawal">Retraits</SelectItem>
                                        <SelectItem value="profit">Profits</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                    <SelectTrigger className="w-[150px]">
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
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-center justify-end">
                            <Select value={datePreset} onValueChange={handlePresetChange}>
                                <SelectTrigger className="w-[180px]">
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
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Du:</span>
                                        <Input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                                            className="w-[150px]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Au:</span>
                                        <Input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                                            className="w-[150px]"
                                        />
                                    </div>
                                </>
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
                                                        {tx.type === 'deposit' ? 'Dépôt' : tx.type === 'withdrawal' ? 'Retrait' : tx.type}
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
                                                            onClick={() => { setSelectedProofUrl(tx.proof_url); setProofModalOpen(true); }}
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
                    <div className="flex justify-center items-center p-4">
                        {selectedProofUrl && (
                            <img
                                src={selectedProofUrl}
                                alt="Preuve de paiement"
                                className="max-w-full h-auto rounded-md shadow-sm object-contain"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminTransactionsPage;
