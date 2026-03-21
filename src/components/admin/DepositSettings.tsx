// src/components/admin/DepositSettings.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { getSettingByKey, updateSetting } from '@/services/settingsService';
import { Loader2, BellRing } from 'lucide-react';

export const DepositSettings = () => {
  const [notifyUsers, setNotifyUsers] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['deposit-settings'],
    queryFn: async () => {
      const enabled = await getSettingByKey('deposit_enabled');
      return {
        enabled: enabled?.value === 'true',
      };
    }
  });

  // Removed manual notifyMutation as it's now handled by a Database Trigger
  // on the 'settings' table.

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('site_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      // Announce success first
      toast({
        title: 'Paramètres mis à jour',
        description: 'Le statut des dépôts a été enregistré avec succès.',
      });

      // Invalidate queries to refetch data and re-render the component
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-settings'] });

      const isEnabling = variables.key === 'deposit_enabled' && (variables.value === 'true' || variables.value === true);

      if (isEnabling && notifyUsers) {
        toast({
          title: '✅ Notifications en cours',
          description: 'Les notifications d\'ouverture de dépôt sont en cours d\'envoi via le système automatique.',
        });
      }
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Impossible de mettre à jour le statut des dépôts: ${error.message}`,
      });
    }
  });

  const handleToggle = (key: string, checked: boolean) => {
    updateSettingMutation.mutate({ key, value: checked.toString() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isSaving = updateSettingMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestion des Dépôts</CardTitle>
        <CardDescription>
          Contrôlez si les dépôts sont autorisés globalement sur la plateforme.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg space-y-4 bg-background">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="deposit-switch" className="text-base font-semibold">Dépôts activés</Label>
              <p className="text-sm text-muted-foreground">
                Autoriser les utilisateurs à effectuer de nouveaux dépôts.
              </p>
            </div>
            <Switch
              id="deposit-switch"
              checked={settings?.enabled}
              onCheckedChange={(checked) => handleToggle('deposit_enabled', checked)}
              disabled={isSaving}
            />
          </div>

          {/* Afficher la checkbox seulement si on s'apprête à activer les dépôts */}
          {!settings?.enabled && (
            <div className="pt-4 border-t">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="notify-users"
                  checked={notifyUsers}
                  onCheckedChange={setNotifyUsers}
                  disabled={isSaving}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="notify-users"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <BellRing className="h-4 w-4 inline-block mr-2" />
                    Notifier les utilisateurs abonnés
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Envoie un e-mail et une notification aux utilisateurs qui ont demandé à être prévenus.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {isSaving && (
          <div className="flex items-center justify-center pt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Sauvegarde du paramètre...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};