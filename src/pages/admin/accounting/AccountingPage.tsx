import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getAccountingStats, getUpcomingProfits } from "@/services/accountingService";
import { getContractDashboardStats, getDepositSummary, getWithdrawalSummary } from "@/services/adminService";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Wallet, TrendingUp, TrendingDown, Landmark, ArrowRight, FileText, DollarSign, Handshake, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { format, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const AccountingPage = () => {
    const navigate = useNavigate();
    const today = new Date();
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(today),
        to: today,
    });

    // Format dates for the RPC call
    const dateFrom = date?.from ? format(date.from, 'yyyy-MM-dd') : undefined;
    const dateTo = date?.to ? format(date.to, 'yyyy-MM-dd') : undefined;

    const { data: accountingStats, isLoading: isLoadingAccStats } = useQuery({
        queryKey: ["accountingStats"],
        queryFn: getAccountingStats,
    });

    const { data: contractStats, isLoading: isLoadingContractStats } = useQuery({
        queryKey: ['contractDashboardStats'],
        queryFn: getContractDashboardStats,
    });

    const { data: depositSummary, isLoading: isLoadingDeposits } = useQuery({
        queryKey: ['depositSummary', dateFrom, dateTo],
        queryFn: () => getDepositSummary(dateFrom!, dateTo!),
        enabled: !!dateFrom && !!dateTo,
    });

    const { data: withdrawalSummary, isLoading: isLoadingWithdrawals } = useQuery({
        queryKey: ['withdrawalSummary', dateFrom, dateTo],
        queryFn: () => getWithdrawalSummary(dateFrom!, dateTo!),
        enabled: !!dateFrom && !!dateTo,
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
                    <h1 className="text-4xl font-black tracking-tight text-text-primary mb-2">Comptabilité & Gestion</h1>
                    <p className="text-muted-foreground">Vue d'ensemble des comptes, contrats et flux financiers.</p>
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

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Accounting Balances */}
                {/* Accounting Balances - Consolidated */}
                <StatCard
                    title="Trésorerie Totale (Banque + Crypto)"
                    value={formatCurrency((accountingStats?.['Banque Principale'] || 0) + (accountingStats?.['Portefeuille Crypto'] || 0))}
                    icon={Landmark}
                    isLoading={isLoadingAccStats}
                    gradient="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
                />
                <StatCard
                    title="Soldes Liquides (Non investis)"
                    value={formatCurrency(contractStats?.total_liquid_balance)}
                    icon={Wallet}
                    isLoading={isLoadingContractStats}
                    gradient="bg-gradient-to-br from-yellow-500/10 to-red-500/10 border-yellow-500/20"
                />
                {/* Contract & Insurance Stats */}

                <StatCard
                    title="Capital Total Investi"
                    value={formatCurrency(contractStats?.total_capital_invested)}
                    icon={TrendingUp}
                    isLoading={isLoadingContractStats}
                />
                <StatCard
                    title="Total des Frais d'Assurance"
                    value={formatCurrency(contractStats?.total_insurance_fees_collected)}
                    icon={Handshake}
                    isLoading={isLoadingContractStats}
                />
            </div>


            {/* Deposit Summary Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Résumé des Dépôts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-[300px] justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (
                                        date.to ? (
                                            <>
                                                {format(date.from, "dd LLL, y", { locale: fr })} -{" "}
                                                {format(date.to, "dd LLL, y", { locale: fr })}
                                            </>
                                        ) : (
                                            format(date.from, "dd LLL, y", { locale: fr })
                                        )
                                    ) : (
                                        <span>Choisissez une date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={date?.from}
                                    selected={date}
                                    onSelect={setDate}
                                    numberOfMonths={2}
                                    locale={fr}
                                />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={() => setDate({ from: today, to: today })}>Aujourd'hui</Button>
                        <Button onClick={() => setDate({ from: startOfWeek(today, { locale: fr }), to: today })}>Cette semaine</Button>
                        <Button onClick={() => setDate({ from: startOfMonth(today), to: today })}>Ce mois-ci</Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <StatCard
                            title="Montant Total des Dépôts"
                            value={formatCurrency(depositSummary?.total_deposits)}
                            icon={DollarSign}
                            isLoading={isLoadingDeposits}
                        />
                        <StatCard
                            title="Nombre de Dépôts"
                            value={depositSummary?.deposits_count?.toString() || '0'}
                            icon={FileText}
                            isLoading={isLoadingDeposits}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Withdrawal Summary Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Résumé des Retraits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date-withdrawal"
                                    variant={"outline"}
                                    className={cn(
                                        "w-[300px] justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (
                                        date.to ? (
                                            <>
                                                {format(date.from, "dd LLL, y", { locale: fr })} -{" "}
                                                {format(date.to, "dd LLL, y", { locale: fr })}
                                            </>
                                        ) : (
                                            format(date.from, "dd LLL, y", { locale: fr })
                                        )
                                    ) : (
                                        <span>Choisissez une date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={date?.from}
                                    selected={date}
                                    onSelect={setDate}
                                    numberOfMonths={2}
                                    locale={fr}
                                />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={() => setDate({ from: today, to: today })}>Aujourd'hui</Button>
                        <Button onClick={() => setDate({ from: startOfWeek(today, { locale: fr }), to: today })}>Cette semaine</Button>
                        <Button onClick={() => setDate({ from: startOfMonth(today), to: today })}>Ce mois-ci</Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <StatCard
                            title="Montant Total des Retraits"
                            value={formatCurrency(withdrawalSummary?.total_withdrawals)}
                            icon={DollarSign}
                            isLoading={isLoadingWithdrawals}
                        />
                        <StatCard
                            title="Nombre de Retraits"
                            value={withdrawalSummary?.withdrawals_count?.toString() || '0'}
                            icon={FileText}
                            isLoading={isLoadingWithdrawals}
                        />
                    </div>
                </CardContent>
            </Card>

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
                                        <TableHead>Utilisateur</TableHead>
                                        <TableHead>Contrat</TableHead>
                                        <TableHead>Échéance</TableHead>
                                        <TableHead className="text-right">Montant</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {upcomingProfits.map((profit) => (
                                        <TableRow key={`${profit.contract_id}-${profit.expected_date}`}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{profit.user_name}</span>
                                                    <span className="text-xs text-muted-foreground">{profit.user_email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm font-mono text-muted-foreground">{profit.contract_name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span>{new Date(profit.expected_date).toLocaleDateString()}</span>
                                                    {profit.days_remaining <= 1 ? (
                                                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20">
                                                            {profit.days_remaining === 0 ? "Aujourd'hui" : "Demain"}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
                                                            J-{profit.days_remaining}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
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
