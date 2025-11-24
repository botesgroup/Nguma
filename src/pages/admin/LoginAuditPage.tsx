import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LoginAuditLog {
    id: string;
    user_id: string | null;
    email: string;
    success: boolean;
    ip_address: string | null;
    user_agent: string | null;
    error_message: string | null;
    created_at: string;
}

export default function LoginAuditPage() {
    const [emailFilter, setEmailFilter] = useState('');
    const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failed'>('all');

    const { data: logs, isLoading } = useQuery({
        queryKey: ['loginAudit', emailFilter, successFilter],
        queryFn: async () => {
            let query = supabase
                .from('login_audit' as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (emailFilter) {
                query = query.ilike('email', `%${emailFilter}%`);
            }

            if (successFilter !== 'all') {
                query = query.eq('success', successFilter === 'success');
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching login audit:', error);
                throw error;
            }

            return data as LoginAuditLog[];
        },
    });

    const handleExportCSV = () => {
        if (!logs || logs.length === 0) return;

        const headers = ['Date', 'Email', 'Statut', 'IP', 'User-Agent', 'Erreur'];
        const rows = logs.map(log => [
            format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr }),
            log.email,
            log.success ? 'Réussi' : 'Échoué',
            log.ip_address || 'N/A',
            log.user_agent || 'N/A',
            log.error_message || 'N/A',
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `login-audit-${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Audit des Connexions</h1>
                <p className="text-muted-foreground">Historique des tentatives de connexion (succès et échecs)</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtres</CardTitle>
                    <CardDescription>Rechercher et filtrer les logs de connexion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher par email..."
                                    value={emailFilter}
                                    onChange={(e) => setEmailFilter(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Statut</label>
                            <Select value={successFilter} onValueChange={(v: any) => setSuccessFilter(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous</SelectItem>
                                    <SelectItem value="success">Réussis uniquement</SelectItem>
                                    <SelectItem value="failed">Échecs uniquement</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end">
                            <Button onClick={handleExportCSV} variant="outline" className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Exporter CSV
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historique ({logs?.length || 0} résultats)</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                    ) : !logs || logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Aucun log trouvé</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 font-medium">Date</th>
                                        <th className="text-left p-2 font-medium">Email</th>
                                        <th className="text-left p-2 font-medium">Statut</th>
                                        <th className="text-left p-2 font-medium">IP</th>
                                        <th className="text-left p-2 font-medium">User-Agent</th>
                                        <th className="text-left p-2 font-medium">Erreur</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b hover:bg-muted/50">
                                            <td className="p-2 text-sm">
                                                {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                            </td>
                                            <td className="p-2 text-sm font-medium">{log.email}</td>
                                            <td className="p-2">
                                                <Badge variant={log.success ? 'default' : 'destructive'}>
                                                    {log.success ? '✓ Réussi' : '✗ Échoué'}
                                                </Badge>
                                            </td>
                                            <td className="p-2 text-sm text-muted-foreground">
                                                {log.ip_address || 'N/A'}
                                            </td>
                                            <td className="p-2 text-sm text-muted-foreground max-w-xs truncate" title={log.user_agent || ''}>
                                                {log.user_agent ? log.user_agent.substring(0, 50) + '...' : 'N/A'}
                                            </td>
                                            <td className="p-2 text-sm text-destructive">
                                                {log.error_message || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
