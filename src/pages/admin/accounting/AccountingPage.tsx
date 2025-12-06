import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { getAccountingStats, getUpcomingProfits } from "@/services/accountingService";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Wallet, TrendingUp, TrendingDown, Landmark, ArrowRight, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AccountingPage = () => {
    const navigate = useNavigate();

    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ["accountingStats"],
        queryFn: getAccountingStats,
    });

    const { data: upcomingProfits, isLoading: isLoadingProfits } = useQuery({
        queryKey: ["upcomingProfits"],
        queryFn: () => getUpcomingProfits(), // Default to next 7 days
    });

    const totalUpcoming = upcomingProfits?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

    return (
        <div className="p-8 space-y-8 neon-grid-bg min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-text-primary mb-2">Comptabilité & Trésorerie</h1>
                    <p className="text-muted-foreground">Vue d'ensemble des comptes et des flux financiers.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/admin/accounting/ledger')}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors flex items-center gap-2"
                    >
                        <FileText className="h-4 w-4" /> Grand Livre
                    </button>
                    <button
                        onClick={() => navigate('/admin/accounting/scheduler')}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        Planificateur de Paiements <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {isLoadingStats ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-[120px] rounded-lg" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
                    <StatCard
                        title="Banque Principale"
                        value={formatCurrency(stats?.['Banque Principale'] || 0)}
                        icon={Landmark}
                        gradient="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20"
                    />
                    <StatCard
                        title="Portefeuille Crypto"
                        value={formatCurrency(stats?.['Portefeuille Crypto'] || 0)}
                        icon={Wallet}
                        gradient="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20"
                    />
                    <StatCard
                        title="Dépôts Clients"
                        value={formatCurrency(stats?.['Dépôts Clients'] || 0)}
                        icon={TrendingDown}
                        gradient="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20"
                    />
                    <StatCard
                        title="Revenus Frais"
                        value={formatCurrency(stats?.['Revenus Frais'] || 0)}
                        icon={TrendingUp}
                        gradient="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20"
                    />
                </div>
            )}

            {/* Upcoming Profits Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Profits à verser (7 prochains jours)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingProfits ? (
                            <div className="space-y-2">
                                {[...Array(3)].map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : upcomingProfits && upcomingProfits.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Contrat</TableHead>
                                        <TableHead>Date Prévue</TableHead>
                                        <TableHead className="text-right">Montant</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {upcomingProfits.map((profit) => (
                                        <TableRow key={`${profit.contract_id}-${profit.expected_date}`}>
                                            <TableCell className="font-medium">{profit.contract_name}</TableCell>
                                            <TableCell>{new Date(profit.expected_date).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right font-bold text-green-500">
                                                {formatCurrency(profit.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                Aucun profit prévu pour les 7 prochains jours.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardHeader>
                        <CardTitle>Résumé Semaine</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Total Profits à Verser</p>
                            <p className="text-3xl font-bold text-primary">{formatCurrency(totalUpcoming)}</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                            <p className="text-sm font-medium mb-2">Note</p>
                            <p className="text-xs text-muted-foreground">
                                Ces profits seront automatiquement crédités sur les portefeuilles des utilisateurs à la date anniversaire.
                                Assurez-vous que la trésorerie est suffisante si des retraits sont demandés par la suite.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AccountingPage;
