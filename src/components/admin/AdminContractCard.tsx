import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, MoreHorizontal, Edit, TrendingUp, User } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";

// Extend the base row type to include user info
type ContractData = Database['public']['Tables']['contracts']['Row'] & {
    first_name: string | null;
    last_name: string | null;
    email: string;
};

interface AdminContractCardProps {
    contract: ContractData;
    onEdit: (contract: ContractData) => void;
}

export const AdminContractCard = ({ contract, onEdit }: AdminContractCardProps) => {
    const progress = (contract.months_paid / contract.duration_months) * 100;
    const totalProfitPaid = Number(contract.total_profit_paid) || 0;

    // Smart badges
    const monthsRemaining = contract.duration_months - (contract.months_paid || 0);
    const isEndingSoon = monthsRemaining <= 2 && monthsRemaining > 0 && contract.status === 'active';

    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'active': return 'default';
            case 'completed': return 'secondary';
            case 'refunded': return 'destructive';
            case 'pending_refund': return 'outline';
            case 'cancelled': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <Card className="shadow-lg border-border/40 flex flex-col bg-card hover:bg-card/80 transition-all duration-300 group hover:border-primary/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        {/* User Info Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(0,255,65,0.1)]">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="overflow-hidden">
                                <div className="font-bold text-base text-card-foreground truncate leading-tight" title={`${contract.first_name || ''} ${contract.last_name || ''}`}>
                                    {`${contract.first_name || ''} ${contract.last_name || ''}`.trim() || 'Utilisateur inconnu'}
                                </div>
                                <div className="text-xs text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer" title={contract.email}>
                                    {contract.email}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <CardTitle className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded inline-block">
                                #{contract.id.substring(0, 8)}
                            </CardTitle>
                            {isEndingSoon && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Fin proche
                                </Badge>
                            )}
                        </div>

                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge variant={getStatusVariant(contract.status)} className="capitalize shadow-sm bg-opacity-20 backdrop-blur-sm">
                            {contract.status}
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                                    <span className="sr-only">Menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onEdit(contract)} className="focus:bg-primary/10 focus:text-primary cursor-pointer">
                                    <Edit className="mr-2 h-4 w-4" /> Modifier
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-grow space-y-5 pt-1">
                <div className="flex items-baseline gap-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="text-3xl font-bold text-primary tracking-tight" style={{ textShadow: '0 0 20px rgba(0,255,65,0.2)' }}>
                        {formatCurrency(Number(contract.amount), contract.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Investi</div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Progression</span>
                        <span className="text-foreground font-mono">{contract.months_paid} <span className="text-muted-foreground">/ {contract.duration_months} mois</span></span>
                    </div>
                    <Progress value={progress} className="h-2 w-full bg-secondary" />
                </div>

                {/* Profits versés */}
                <div className="flex justify-between items-center text-sm bg-gradient-to-r from-primary/5 to-transparent p-3 rounded-lg border-l-2 border-primary/30">
                    <span className="text-primary/80 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Profits versés
                    </span>
                    <span className="font-bold text-card-foreground font-mono">
                        +{formatCurrency(totalProfitPaid, contract.currency)}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-3 border-t border-border/50 mt-2">
                    <div>
                        <span className="block text-primary/40 uppercase tracking-wider mb-0.5">Date Début</span>
                        <span className="font-medium text-foreground">{format(new Date(contract.start_date), "dd MMM yyyy", { locale: fr })}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-primary/40 uppercase tracking-wider mb-0.5">Date Fin</span>
                        <span className="font-medium text-foreground">{format(new Date(contract.end_date), "dd MMM yyyy", { locale: fr })}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
