import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingPayments } from "@/services/portfolioService";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * UpcomingPayments Component
 * 
 * Displays a timeline of upcoming profit payments from active contracts
 * Shows contract number, next payment date, estimated amount, and countdown
 */
export const UpcomingPayments = () => {
    const { data: payments, isLoading } = useQuery({
        queryKey: ["upcomingPayments"],
        queryFn: () => getUpcomingPayments(5),
    });

    if (isLoading) {
        return <Skeleton className="h-[350px] w-full" />;
    }

    if (!payments || payments.length === 0) {
        return (
            <Card className="shadow-elegant border-border/50 bg-gradient-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Prochains Paiements
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground">
                    Aucun paiement à venir
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-elegant border-border/50 bg-gradient-card">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Prochains Paiements
                    </CardTitle>
                    <Badge variant="outline" className="bg-primary/10">
                        {payments.length} en attente
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {payments.map((payment, index) => {
                        const paymentDate = new Date(payment.next_payment_date);
                        const isUpcoming = paymentDate > new Date();
                        const distance = formatDistanceToNow(paymentDate, {
                            addSuffix: true,
                            locale: fr,
                        });

                        return (
                            <div
                                key={payment.contract_id}
                                className={`flex items-start gap-4 p-3 rounded-lg transition-colors ${index === 0
                                        ? "bg-primary/10 border border-primary/20"
                                        : "bg-muted/30 hover:bg-muted/50"
                                    }`}
                            >
                                {/* Timeline indicator */}
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`rounded-full p-2 ${index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                                            }`}
                                    >
                                        {index === 0 ? (
                                            <TrendingUp className="h-4 w-4 text-primary-foreground" />
                                        ) : (
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    {index < payments.length - 1 && (
                                        <div className="w-0.5 h-12 bg-border mt-2" />
                                    )}
                                </div>

                                {/* Payment details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium">
                                            Contrat #{payment.contract_number}
                                        </p>
                                        <Badge variant="secondary" className="text-xs">
                                            {payment.months_remaining} mois restants
                                        </Badge>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xl font-bold text-profit">
                                                +{formatCurrency(payment.estimated_amount)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {format(paymentDate, "d MMMM yyyy", { locale: fr })}
                                            </p>
                                        </div>

                                        {index === 0 && (
                                            <div className="text-right">
                                                <p className="text-xs font-medium text-primary">
                                                    {distance}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Prochain paiement
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Summary footer */}
                <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total estimé (5 prochains)</span>
                        <span className="font-bold text-lg">
                            +{formatCurrency(
                                payments.reduce((sum, p) => sum + Number(p.estimated_amount), 0)
                            )}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
