import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting, uploadGenericContractPdf } from "@/services/settingsService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        <div className="flex items-center gap-2 w-1/3">
          <Input
            id={setting.key}
            type={setting.type === 'number' ? 'number' : 'text'}
            value={setting.value ?? ""}
            onChange={(e) => handleInputChange(setting.key, e.target.value)}
          />
          <Button onClick={() => handleSave(setting.key)} disabled={mutation.isPending && mutation.variables?.key === setting.key}>
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Paramètres Globaux</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres Globaux</CardTitle>
        <CardDescription>Modifiez les paramètres de l'application. Ces changements sont appliqués en temps réel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {settingsState.map((setting) => (
          <div key={setting.key} className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={setting.key} className="capitalize font-medium">{setting.key.replace(/_/g, ' ')}</Label>
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            </div>
            <SettingControl 
              setting={setting} 
              handleInputChange={handleInputChange} 
              handleSave={handleSave} 
              mutation={mutation} 
            />
          </div>
        ))}

        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Contrat PDF Générique</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="generic_contract_pdf" className="font-medium">Fichier PDF du Contrat Modèle</Label>
              <p className="text-sm text-muted-foreground">Téléversez le fichier PDF qui servira de modèle pour tous les nouveaux contrats.</p>
              {genericContractPdfUrl && (
                <p className="text-sm text-muted-foreground mt-1">
                  Actuel: <a href={genericContractPdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Voir le PDF</a>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 w-1/3">
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
              <Button 
                size="sm" 
                onClick={handleUploadGenericPdf}
                disabled={!selectedGenericPdfFile || uploadGenericPdfMutation.isPending}
              >
                {uploadGenericPdfMutation.isPending ? "Téléversement..." : "Téléverser"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};