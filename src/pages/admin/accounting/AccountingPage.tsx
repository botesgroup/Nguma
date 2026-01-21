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
import { format, startOfMonth, startOfWeek, endOfMonth, startOfToday, endOfToday, endOfWeek, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AccountingPage = () => {
    const navigate = useNavigate();
    const today = new Date();
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(today),
        to: today,
    });
    const [activeTab, setActiveTab] = useState<string>("week");

    // Format dates for the RPC call - Fetch broad range for stats (current month at minimum)
    // We want to ensure we have data for "This Month" regardless of the picker selection for the quick stats
    const statsStart = startOfMonth(today);
    const statsEnd = endOfMonth(today);

    // For the LIST view, we respect the date picker, but we ALSO need "Today" and "This Week" data for the KPI cards.
    // So distinct queries might be cleaner, but let's fetch a superset to minimize requests.
    // Fetch from min(date.from, startOfMonth) to max(date.to, endOfMonth)

    const fetchStart = date?.from && date.from < statsStart ? date.from : statsStart;
    const fetchEnd = date?.to && date.to > statsEnd ? date.to : statsEnd;

    const queryStart = format(fetchStart, 'yyyy-MM-dd');
    const queryEnd = format(fetchEnd, 'yyyy-MM-dd');

    const { data: accountingStats, isLoading: isLoadingAccStats } = useQuery({
        queryKey: ["accountingStats"],
        queryFn: getAccountingStats,
    });

    const { data: contractStats, isLoading: isLoadingContractStats } = useQuery({
        queryKey: ['contractDashboardStats'],
        queryFn: getContractDashboardStats,
    });

    // Deposit/Withdrawal summaries respect the PICKER date mostly
    const pickerStart = date?.from ? format(date.from, 'yyyy-MM-dd') : undefined;
    const pickerEnd = date?.to ? format(date.to, 'yyyy-MM-dd') : undefined;

    const { data: depositSummary, isLoading: isLoadingDeposits } = useQuery({
        queryKey: ['depositSummary', pickerStart, pickerEnd],
        queryFn: () => getDepositSummary(pickerStart!, pickerEnd!),
        enabled: !!pickerStart && !!pickerEnd,
    });

    const { data: withdrawalSummary, isLoading: isLoadingWithdrawals } = useQuery({
        queryKey: ['withdrawalSummary', pickerStart, pickerEnd],
        queryFn: () => getWithdrawalSummary(pickerStart!, pickerEnd!),
        enabled: !!pickerStart && !!pickerEnd,
    });

    const { data: allUpcomingProfits, isLoading: isLoadingProfits } = useQuery({
        queryKey: ["upcomingProfits", queryStart, queryEnd],
        queryFn: () => getUpcomingProfits(new Date(queryStart), new Date(queryEnd)),
    });

    // --- CALCULATE STATS ---
    const startOfTodayDate = startOfToday();
    const endOfTodayDate = endOfToday();
    const startOfWeekDate = startOfWeek(today, { locale: fr });
    const endOfWeekDate = endOfWeek(today, { locale: fr });
    const startOfMonthDate = startOfMonth(today);
    const endOfMonthDate = endOfMonth(today);

    // 1. Today
    const todayProfits = allUpcomingProfits?.filter(p =>
        isWithinInterval(new Date(p.expected_date), { start: startOfTodayDate, end: endOfTodayDate })
    ) || [];
    const todayAmount = todayProfits.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // 2. This Week
    const weekProfits = allUpcomingProfits?.filter(p =>
        isWithinInterval(new Date(p.expected_date), { start: startOfWeekDate, end: endOfWeekDate })
    ) || [];
    const weekAmount = weekProfits.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // 3. This Month
    const monthProfits = allUpcomingProfits?.filter(p =>
        isWithinInterval(new Date(p.expected_date), { start: startOfMonthDate, end: endOfMonthDate })
    ) || [];
    const monthAmount = monthProfits.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // --- FILTER LIST FOR TABLE ---
    // Decision on which list to show based on activeTab
    const getDisplayedProfits = () => {
        switch (activeTab) {
            case "week": return weekProfits;
            case "month": return monthProfits;
            case "custom":
            default:
                return allUpcomingProfits?.filter(p => {
                    if (!date?.from || !date?.to) return true;
                    return isWithinInterval(new Date(p.expected_date), { start: date.from, end: date.to });
                }) || [];
        }
    };

    const displayedProfits = getDisplayedProfits();
    const totalDisplayed = displayedProfits.reduce((acc, curr) => acc + Number(curr.amount), 0);

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
                <StatCard
                    title="Trésorerie Totale"
                    value={formatCurrency(
                        (contractStats?.total_liquid_balance || 0) +
                        (contractStats?.total_capital_invested || 0) +
                        (contractStats?.total_insurance_fees_collected || 0)
                    )}
                    icon={Landmark}
                    isLoading={isLoadingContractStats}
                    gradient="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
                />
                <StatCard
                    title="Soldes Liquides"
                    value={formatCurrency(contractStats?.total_liquid_balance)}
                    icon={Wallet}
                    isLoading={isLoadingContractStats}
                    gradient="bg-gradient-to-br from-yellow-500/10 to-red-500/10 border-yellow-500/20"
                />
                <StatCard
                    title="Capital Investi"
                    value={formatCurrency(contractStats?.total_capital_invested)}
                    icon={TrendingUp}
                    isLoading={isLoadingContractStats}
                />
                <StatCard
                    title="Frais d'Assurance"
                    value={formatCurrency(contractStats?.total_insurance_fees_collected)}
                    icon={Handshake}
                    isLoading={isLoadingContractStats}
                />
            </div>

            {/* PROFIT PAYABLE STATS (Today, Week, Month) */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <StatCard
                    title="Profits à Payer (Aujourd'hui)"
                    value={formatCurrency(todayAmount)}
                    icon={CalendarIcon}
                    isLoading={isLoadingProfits}
                    gradient="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20"
                    description={format(today, "dd MMMM", { locale: fr })}
                />
                <StatCard
                    title="Profits à Payer (Cette Semaine)"
                    value={formatCurrency(weekAmount)}
                    icon={CalendarIcon}
                    isLoading={isLoadingProfits}
                    gradient="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20"
                    description={`Semaine ${format(today, "wo", { locale: fr })}`}
                />
                <StatCard
                    title="Profits à Payer (Ce Mois)"
                    value={formatCurrency(monthAmount)}
                    icon={CalendarIcon}
                    isLoading={isLoadingProfits}
                    gradient="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20"
                    description={format(today, "MMMM yyyy", { locale: fr })}
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
                    {/* Date picker for withdrawals is shared with deposits for now as per previous design, or could be separate if needed. Using same date state. */}
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
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                        <TabsList className="grid grid-cols-3 w-full md:w-[400px]">
                            <TabsTrigger value="week">Cette Semaine</TabsTrigger>
                            <TabsTrigger value="month">Ce Mois</TabsTrigger>
                            <TabsTrigger value="custom">Calendrier</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {activeTab === "custom" && (
                        <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date-profits"
                                        variant={"outline"}
                                        className={cn(
                                            "w-[260px] justify-start text-left font-normal border-primary/20 bg-background/50",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, "dd LLL", { locale: fr })} - {format(date.to, "dd LLL", { locale: fr })}
                                                </>
                                            ) : (
                                                format(date.from, "dd LLL", { locale: fr })
                                            )
                                        ) : (
                                            <span>Choisir dates</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
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
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border overflow-hidden">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                {activeTab === "week" && "Paiements attendus cette semaine"}
                                {activeTab === "month" && "Paiements attendus ce mois"}
                                {activeTab === "custom" && "Paiements sur la période personnalisée"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoadingProfits ? (
                                <div className="p-6 space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : displayedProfits && displayedProfits.length > 0 ? (
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="pl-6">Utilisateur</TableHead>
                                            <TableHead>Contrat</TableHead>
                                            <TableHead>Échéance</TableHead>
                                            <TableHead className="text-right pr-6">Montant</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedProfits.map((profit) => (
                                            <TableRow key={`${profit.contract_id}-${profit.expected_date}`} className="hover:bg-primary/5 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-text-primary">{profit.user_name}</span>
                                                        <span className="text-xs text-muted-foreground">{profit.user_email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm font-medium text-muted-foreground">{profit.contract_name}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm">{new Date(profit.expected_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                                                        {profit.days_remaining <= 1 ? (
                                                            <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 ring-1 ring-inset ring-red-500/20">
                                                                {profit.days_remaining <= 0 ? (new Date(profit.expected_date).getDate() === new Date().getDate() ? "Aujourd'hui" : "Passé") : "Demain"}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/20">
                                                                J-{profit.days_remaining}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6 font-bold text-green-500 italic">
                                                    {formatCurrency(profit.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground bg-muted/5">
                                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>Aucun profit trouvé pour cette vue.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 backdrop-blur-sm border-border flex flex-col">
                        <CardHeader className="border-b border-border/50 bg-muted/20">
                            <CardTitle className="text-lg text-center">Somme à Prévoir</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-center items-center p-8 space-y-6">
                            <div className="text-center">
                                <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">Total {activeTab === 'week' ? 'hebdomadaire' : activeTab === 'month' ? 'mensuel' : 'sélectionné'}</p>
                                <p className="text-5xl font-black text-primary drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                                    {formatCurrency(totalDisplayed)}
                                </p>
                            </div>

                            <div className="w-full p-6 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl border border-primary/20 space-y-3">
                                <div className="flex items-center gap-3 text-primary">
                                    <div className="p-2 bg-primary/20 rounded-lg">
                                        <Landmark className="h-5 w-5" />
                                    </div>
                                    <span className="font-bold">Note de Trésorerie</span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {activeTab === 'week'
                                        ? "Ces profits seront distribués automatiquement cette semaine. Assurez-vous d'avoir les fonds nécessaires sur les comptes opérationnels."
                                        : "Ceci est une prévision basée sur les contrats actifs. Les montants peuvent varier si des contrats sont clôturés prématurément."}
                                </p>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full border-primary/20 hover:bg-primary/10 text-primary font-bold group"
                                onClick={() => navigate('/admin/accounting/scheduler')}
                            >
                                Aller au Planificateur
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AccountingPage;
