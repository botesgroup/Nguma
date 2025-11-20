import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting, uploadGenericContractPdf } from "@/services/settingsService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { Upload, Settings as SettingsIcon, CreditCard, FileText, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database } from "@/integrations/supabase/types";

type Setting = Database['public']['Tables']['settings']['Row'];

// A new component to render the correct form control based on the setting type
const SettingControl = ({ setting, handleInputChange, handleSave, mutation }: { setting: Setting, handleInputChange: (key: string, value: string) => void, handleSave: (key: string) => void, mutation: any }) => {
  switch (setting.type) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2 w-1/3 justify-end">
          <Switch
            checked={setting.value === 'true'}
            onCheckedChange={(checked) => {
              // For switches, it's better UX to save immediately
              const newValue = checked.toString();
              handleInputChange(setting.key, newValue);
              mutation.mutate({ key: setting.key, value: newValue });
            }}
          />
        </div>
      );
    case 'select':
      return (
        <div className="flex items-center gap-2 w-1/3">
          <Select
            value={setting.value ?? ""}
            onValueChange={(value) => handleInputChange(setting.key, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handleSave(setting.key)} disabled={mutation.isPending && mutation.variables?.key === setting.key}>
            Sauvegarder
          </Button>
        </div>
      );
    case 'number':
    default: // 'text' and others
      return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <Input
            id={setting.key}
            type={setting.type === 'number' ? 'number' : 'text'}
            value={setting.value ?? ""}
            onChange={(e) => handleInputChange(setting.key, e.target.value)}
            className="w-full sm:w-48"
          />
          <Button onClick={() => handleSave(setting.key)} disabled={mutation.isPending && mutation.variables?.key === setting.key} className="w-full sm:w-auto">
            Sauvegarder
          </Button>
        </div>
      );
  }
};

export const AdminSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsState, setSettingsState] = useState<Setting[]>([]);
  const [selectedGenericPdfFile, setSelectedGenericPdfFile] = useState<File | null>(null);
  const [genericPdfFileInputKey, setGenericPdfFileInputKey] = useState(Date.now());

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settings) {
      setSettingsState(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSetting,
    onSuccess: () => {
      toast({ title: "Succès", description: "Paramètre mis à jour." });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const uploadGenericPdfMutation = useMutation({
    mutationFn: uploadGenericContractPdf,
    onSuccess: () => {
      toast({ title: "Succès", description: "PDF de contrat générique téléversé et mis à jour." });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSelectedGenericPdfFile(null);
      setGenericPdfFileInputKey(Date.now()); // Reset file input
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur de téléversement", description: error.message });
    },
  });

  const handleInputChange = (key: string, value: string) => {
    setSettingsState(currentSettings =>
      currentSettings.map(s => s.key === key ? { ...s, value } : s)
    );
  };

  const handleSave = (key: string) => {
    const settingToSave = settingsState.find(s => s.key === key);
    if (settingToSave) {
      mutation.mutate({ key: settingToSave.key, value: settingToSave.value ?? "" });
    }
  };

  const handleGenericPdfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedGenericPdfFile(event.target.files[0]);
    } else {
      setSelectedGenericPdfFile(null);
    }
  };

  const handleUploadGenericPdf = () => {
    if (!selectedGenericPdfFile) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez sélectionner un fichier PDF." });
      return;
    }
    uploadGenericPdfMutation.mutate(selectedGenericPdfFile);
  };

  const genericContractPdfUrl = settingsState.find(s => s.key === 'generic_contract_pdf_url')?.value || "";

  // Categorize settings
  const paymentSettings = settingsState.filter(s => s.key.includes('payment') || s.key.includes('deposit') || s.key.includes('withdrawal'));
  const contractSettings = settingsState.filter(s => s.key.includes('contract') || s.key.includes('profit') || s.key.includes('roi'));
  const systemSettings = settingsState.filter(s => !paymentSettings.includes(s) && !contractSettings.includes(s));

  // Calculate stats
  const totalSettings = settingsState.length;
  const customizedSettings = settingsState.filter(s => s.value !== s.default_value).length;
  const hasPdf = !!genericContractPdfUrl;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle>Paramètres Globaux</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const SettingsGroup = ({ settings }: { settings: Setting[] }) => (
    <div className="space-y-6">
      {settings.map((setting) => (
        <div key={setting.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b last:border-0">
          <div className="flex-1">
            <Label htmlFor={setting.key} className="capitalize font-medium text-base">{setting.key.replace(/_/g, ' ')}</Label>
            <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
          </div>
          <SettingControl
            setting={setting}
            handleInputChange={handleInputChange}
            handleSave={handleSave}
            mutation={mutation}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Total Paramètres</div>
              <SettingsIcon className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {totalSettings}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dans toute l'application
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Personnalisés</div>
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {customizedSettings}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Modifiés par défaut
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${hasPdf ? 'from-green-500/10 to-emerald-500/10 border-green-500/20' : 'from-amber-500/10 to-orange-500/10 border-amber-500/20'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">PDF Contrat</div>
              <FileText className={`h-4 w-4 ${hasPdf ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <div className={`text-2xl font-bold ${hasPdf ? 'text-green-700' : 'text-amber-700'}`}>
              {hasPdf ? '✓ Configuré' : '⚠ Manquant'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Modèle de contrat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Categorized Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres Globaux</CardTitle>
          <CardDescription>Modifiez les paramètres de l'application. Ces changements sont appliqués en temps réel.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="paiements" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="paiements" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Paiements</span>
                <span className="sm:hidden">💳</span>
              </TabsTrigger>
              <TabsTrigger value="contrats" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Contrats</span>
                <span className="sm:hidden">📄</span>
              </TabsTrigger>
              <TabsTrigger value="systeme" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Système</span>
                <span className="sm:hidden">⚙️</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paiements" className="space-y-4">
              {paymentSettings.length > 0 ? (
                <SettingsGroup settings={paymentSettings} />
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun paramètre de paiement configuré.</p>
              )}
            </TabsContent>

            <TabsContent value="contrats" className="space-y-4">
              {contractSettings.length > 0 ? (
                <SettingsGroup settings={contractSettings} />
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun paramètre de contrat configuré.</p>
              )}
            </TabsContent>

            <TabsContent value="systeme" className="space-y-4">
              {systemSettings.length > 0 ? (
                <SettingsGroup settings={systemSettings} />
              ) : (
                <p className="text-muted-foreground text-center py-8">Aucun paramètre système configuré.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* PDF Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Contrat PDF Générique</CardTitle>
          <CardDescription>Téléversez le fichier PDF qui servira de modèle pour tous les nouveaux contrats.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="generic_contract_pdf" className="font-medium text-base">Fichier PDF du Contrat Modèle</Label>
              {genericContractPdfUrl && (
                <p className="text-sm text-muted-foreground mt-2">
                  Actuel: <a href={genericContractPdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Voir le PDF</a>
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Input
                key={genericPdfFileInputKey}
                id="generic_contract_pdf"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleGenericPdfFileChange}
              />
              <label htmlFor="generic_contract_pdf" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> Choisir un fichier
              </label>
              {selectedGenericPdfFile && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">{selectedGenericPdfFile.name}</span>
              )}
              <Button
                size="sm"
                onClick={handleUploadGenericPdf}
                disabled={!selectedGenericPdfFile || uploadGenericPdfMutation.isPending}
                className="w-full sm:w-auto"
              >
                {uploadGenericPdfMutation.isPending ? "Téléversement..." : "Téléverser"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};