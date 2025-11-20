import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Award, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioStats, getPerformanceTrends } from "@/services/portfolioService";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

/**
 * PerformanceMetrics Component - Simplified to 3 Essential KPIs
 * 
 * Displays advanced KPIs: ROI, Total Profits, and Monthly Average
 * Enhanced with trend indicators
 */
export const PerformanceMetrics = () => {
    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ["portfolioStats"],
        queryFn: getPortfolioStats,
    });

    const { data: trends, isLoading: isLoadingTrends } = useQuery({
        queryKey: ["performanceTrends"],
        queryFn: getPerformanceTrends,
    });

    const isLoading = isLoadingStats || isLoadingTrends;

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[140px]" />)}
            </div>
        );
    }

    const formatPercentage = (value: number) => {
        const sign = value >= 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}%`;
    };

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* ROI Global */}
            <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20 shadow-elegant hover:shadow-xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">ROI Global</CardTitle>
                    <Award className="h-4 w-4 text-violet-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-violet-600">
                        {formatPercentage(stats?.roi_percentage || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Return on Investment total
                    </p>
                    <div className="mt-2 flex items-center text-xs">
                        {stats && stats.roi_percentage > 0 ? (
                            <>
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-green-500">Performance excellente</span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">En croissance</span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Profits Totaux */}
            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 shadow-elegant hover:shadow-xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Profits Totaux</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                        {formatCurrency(stats?.total_profits || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Cumulés depuis le début
                    </p>
                    {trends && (
                        <div className="mt-2 flex items-center text-xs">
                            {trends.is_positive ? (
                                <>
                                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                                    <span className="text-green-500">
                                        {formatPercentage(trends.trend_percentage)} vs mois dernier
                                    </span>
                                </>
                            ) : (
                                <>
                                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                                    <span className="text-red-500">
                                        {formatPercentage(trends.trend_percentage)} vs mois dernier
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Profit Mensuel Moyen */}
            <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 shadow-elegant hover:shadow-xl transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Profit Mensuel Moy.</CardTitle>
                    <Zap className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-amber-600">
                        {formatCurrency(stats?.monthly_avg_profit || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Moyenne des 3 derniers mois
                    </p>
                    <div className="mt-2 flex items-center text-xs">
                        {trends && (
                            <span className="text-muted-foreground">
                                Ce mois: {formatCurrency(trends.current_month)}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
