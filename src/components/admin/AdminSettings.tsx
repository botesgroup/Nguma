import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Shield, Settings as SettingsIcon, CreditCard, ShieldCheck } from 'lucide-react';
import { invalidateSecuritySettingsCache } from '@/services/securitySettingsService';
import { WysiwygEditor } from '@/components/WysiwygEditor';
import { PaymentMethodsManager } from '@/components/admin/PaymentMethodsManager';
import { FileUploadControl } from '@/components/admin/FileUploadControl'; // Added import
import { DepositSettings } from '@/components/admin/DepositSettings'; // Added import
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { Bell } from 'lucide-react';
import { MaintenanceModeToggle } from './MaintenanceModeToggle'; // Added import

interface Setting {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  label: string;
  description?: string;
  options?: string[];
  category?: string;
}

export const AdminSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category', { ascending: true })
        .order('label', { ascending: true });

      if (error) throw error;
      return data as Setting[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });

      // Invalidate security settings cache if updating security category
      const setting = settings?.find(s => s.key === variables.key);
      if (setting?.category === 'security') {
        invalidateSecuritySettingsCache();
        queryClient.invalidateQueries({ queryKey: ['securitySettings'] });
      }

      toast({
        title: 'Paramètre mis à jour',
        description: 'Le paramètre a été enregistré avec succès.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: `Impossible de mettre à jour le paramètre: ${error.message}`,
      });
    },
  });

  const handleSave = (key: string, value: string) => {
    updateMutation.mutate({ key, value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group settings by category
  const settingsByCategory = settings?.reduce((acc, setting) => {
    const category = setting.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, Setting[]>);

  const categoryLabels: Record<string, { label: string; icon: any; description: string }> = {
    general: {
      label: 'Général',
      icon: SettingsIcon,
      description: 'Paramètres généraux de la plateforme',
    },
    security: {
      label: 'Sécurité',
      icon: Shield,
      description: 'Configuration des fonctionnalités de sécurité',
    },
    insurance: {
      label: 'Assurance des Contrats',
      icon: ShieldCheck, // Ajout d'une virgule ici si c'était le problème
      description: 'Configuration du système d\'assurance optionnel des contrats',
    },
    payment_methods: {
      label: 'Moyens de Paiement',
      icon: CreditCard,
      description: 'Gestion des méthodes de paiement disponibles',
    },
    deposits: {
      label: 'Dépôts',
      icon: CreditCard,
      description: 'Gestion des périodes et limitations des dépôts',
    },
  };

  return (
    <div className="space-y-6">
      {/* --- Maintenance Mode Toggle --- */}
      <MaintenanceModeToggle />
      {/* --- End Maintenance Mode Toggle --- */}

      <Accordion type="multiple" defaultValue={['security', 'general', 'insurance', 'payment_methods']} className="space-y-4">
        {Object.entries(settingsByCategory || {}).map(([category, categorySettings]) => {
          const categoryInfo = categoryLabels[category] || {
            label: category.charAt(0).toUpperCase() + category.slice(1),
            icon: SettingsIcon,
            description: `Paramètres ${category}`,
          };
          const Icon = categoryInfo.icon;

          // Separate special settings from other settings
          const termsContentSetting = categorySettings.find(s => s.key === 'terms_content');
          const pdfUrlSetting = categorySettings.find(s => s.key === 'contract_explanation_pdf_url');
          const regularSettings = categorySettings.filter(s => s.key !== 'terms_content' && s.key !== 'contract_explanation_pdf_url');

          return (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">{categoryInfo.label}</div>
                    <div className="text-sm text-muted-foreground">{categoryInfo.description}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6 pt-4">
                  {/* Grid layout for regular settings */}
                  {regularSettings.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {regularSettings.map((setting) => (
                                                  <SettingControl
                                                    key={setting.id}
                                                    setting={{ ...setting, type: setting.key === 'withdrawal_otp_enabled' ? 'boolean' : setting.type }}
                                                    onSave={handleSave}
                                                    isLoading={updateMutation.isPending}
                                                  />                      ))}
                    </div>
                  )}

                  {/* Full width for special settings */}
                  {pdfUrlSetting && (
                    <SettingControl
                      key={pdfUrlSetting.id}
                      setting={pdfUrlSetting}
                      onSave={handleSave}
                      isLoading={updateMutation.isPending}
                    />
                  )}
                  {termsContentSetting && (
                    <SettingControl
                      key={termsContentSetting.id}
                      setting={termsContentSetting}
                      onSave={handleSave}
                      isLoading={updateMutation.isPending}
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* Section spéciale pour les moyens de paiement */}
        <AccordionItem value="payment_methods" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Moyens de Paiement</div>
                <div className="text-sm text-muted-foreground">
                  Gestion des méthodes de paiement disponibles
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="pt-4">
              <PaymentMethodsManager />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section spéciale pour les paramètres de dépôt */}
        <AccordionItem value="deposits" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Dépôts</div>
                <div className="text-sm text-muted-foreground">
                  Gestion des périodes et limitations des dépôts
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="pt-4">
              <DepositSettings />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section pour les notifications personnelles de l'admin */}
        {currentUserId && (
          <AccordionItem value="personal_notifications" className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Mes Notifications</div>
                  <div className="text-sm text-muted-foreground">
                    Gérez vos propres alertes (Email, Push, In-App)
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="pt-4">
                <NotificationPreferences userId={currentUserId} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};

// Component pour contrôler chaque type de setting
const SettingControl = ({
  setting,
  onSave,
  isLoading,
}: {
  setting: Setting;
  onSave: (key: string, value: string) => void;
  isLoading: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState(setting.value);
  const hasChanged = localValue !== setting.value;

  React.useEffect(() => {
    setLocalValue(setting.value);
  }, [setting.value]);

  const handleSave = () => {
    if (hasChanged) {
      onSave(setting.key, localValue);
    }
  };

  return (
    <div className={`flex ${setting.key === 'terms_content' ? 'flex-col' : 'flex-col'} gap-4 p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors h-full`}>
      {/* Label + Description en haut */}
      <div className="flex-1 min-w-0">
        <Label htmlFor={setting.key} className="font-medium text-base">
          {setting.label}
        </Label>
        {setting.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{setting.description}</p>
        )}
      </div>

      {/* Contrôle en bas */}
      <div className="flex items-center gap-3 flex-shrink-0 justify-end">
        {/* Special handling for terms_content */}
        {setting.key === 'terms_content' && (
          <div className="w-full flex flex-col gap-2">
            <WysiwygEditor
              value={localValue}
              onChange={setLocalValue}
            />
            <Button
              onClick={handleSave}
              disabled={!hasChanged || isLoading}
              size="sm"
              variant={hasChanged ? 'default' : 'outline'}
              className="self-end"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sauvegarde...
                </>
              ) : hasChanged ? (
                '💾 Sauvegarder'
              ) : (
                '✓ Sauvegardé'
              )}
            </Button>
          </div>
        )}

        {/* Special handling for PDF upload */}
        {setting.key === 'contract_explanation_pdf_url' && (
          <div className="w-full">
            <FileUploadControl
              value={localValue}
              onSave={(newUrl) => onSave(setting.key, newUrl)}
              storageBucket="documents"
              label={setting.label}
            />
          </div>
        )}

        {/* Regular controls for other settings */}
        {setting.key !== 'terms_content' && setting.key !== 'contract_explanation_pdf_url' && (
          <>
            {setting.type === 'boolean' && (
              <>
                <Switch
                  id={setting.key}
                  checked={localValue === 'true'}
                  onCheckedChange={(checked) => {
                    const newValue = checked.toString();
                    setLocalValue(newValue);
                    onSave(setting.key, newValue);
                  }}
                  disabled={isLoading}
                />
                <span className="text-sm font-medium min-w-[70px]">
                  {localValue === 'true' ? '✅ Activé' : '❌ Désactivé'}
                </span>
              </>
            )}

            {setting.type === 'text' && (
              <>
                <Input
                  id={setting.key}
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  disabled={isLoading}
                  className="w-full"
                />
                <Button
                  onClick={handleSave}
                  disabled={!hasChanged || isLoading}
                  size="sm"
                  variant={hasChanged ? 'default' : 'outline'}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sauvegarde...
                    </>
                  ) : hasChanged ? (
                    '💾 Sauvegarder'
                  ) : (
                    '✓ Sauvegardé'
                  )}
                </Button>
              </>
            )}

            {setting.type === 'number' && (
              <>
                <Input
                  id={setting.key}
                  type="number"
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  disabled={isLoading}
                  className="w-full"
                />
                <Button
                  onClick={handleSave}
                  disabled={!hasChanged || isLoading}
                  size="sm"
                  variant={hasChanged ? 'default' : 'outline'}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sauvegarde...
                    </>
                  ) : hasChanged ? (
                    '💾 Sauvegarder'
                  ) : (
                    '✓ Sauvegardé'
                  )}
                </Button>
              </>
            )}

            {setting.type === 'textarea' && (
              <div className="flex flex-col gap-2 w-full">
                <Textarea
                  id={setting.key}
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  disabled={isLoading}
                  rows={4}
                  className="w-full"
                />
                <Button
                  onClick={handleSave}
                  disabled={!hasChanged || isLoading}
                  size="sm"
                  variant={hasChanged ? 'default' : 'outline'}
                  className="self-end"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sauvegarde...
                    </>
                  ) : hasChanged ? (
                    '💾 Sauvegarder'
                  ) : (
                    '✓ Sauvegardé'
                  )}
                </Button>
              </div>
            )}

            {setting.type === 'select' && setting.options && (
              <Select
                value={localValue}
                onValueChange={(value) => {
                  setLocalValue(value);
                  onSave(setting.key, value);
                }}
                disabled={isLoading}
              >
                <SelectTrigger id={setting.key} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {setting.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>
    </div>
  );
};