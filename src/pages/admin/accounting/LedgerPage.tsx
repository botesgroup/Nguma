import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getAccountingEntries } from "@/services/accountingService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Loader2, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";

const LedgerPage = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [datePreset, setDatePreset] = useState("all");

    const { data: entries, isLoading } = useQuery({
        queryKey: ["accountingEntries", dateFrom, dateTo, searchQuery],
        queryFn: () => getAccountingEntries(dateFrom, dateTo, searchQuery),
    });

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
    };

    return (
        <div className="p-8 space-y-8 neon-grid-bg min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-text-primary mb-2">Grand Livre</h1>
                    <p className="text-muted-foreground">Historique complet des écritures comptables.</p>
                </div>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border">
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Écritures
                            </CardTitle>

                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher par description..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
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
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="w-[150px]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Au:</span>
                                        <Input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
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
                    ) : entries && entries.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Compte Débit</TableHead>
                                    <TableHead>Compte Crédit</TableHead>
                                    <TableHead className="text-right">Montant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell>{new Date(entry.transaction_date).toLocaleDateString()} {new Date(entry.transaction_date).toLocaleTimeString()}</TableCell>
                                        <TableCell className="font-medium">{entry.description}</TableCell>
                                        <TableCell>{entry.debit_account_name}</TableCell>
                                        <TableCell>{entry.credit_account_name}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(entry.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell colSpan={4} className="text-right">TOTAL</TableCell>
                                    <TableCell className="text-right text-primary text-lg">
                                        {formatCurrency(entries.reduce((sum, entry) => sum + Number(entry.amount), 0))}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Aucune écriture comptable trouvée.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LedgerPage;
