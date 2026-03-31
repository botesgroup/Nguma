import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Power } from "lucide-react";
import { getMaintenanceMode, setMaintenanceMode } from "@/services/maintenanceService";
import { toast } from "sonner";

export const MaintenanceModeToggle = () => {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            const status = await getMaintenanceMode();
            setIsMaintenance(status);
            setLoading(false);
        };
        fetchStatus();
    }, []);

    const handleToggle = async (enabled: boolean) => {
        setLoading(true);
        const success = await setMaintenanceMode(enabled);
        if (success) {
            setIsMaintenance(enabled);
            toast.success(
                enabled 
                ? "Le mode maintenance est activé. Seuls les administrateurs peuvent accéder au site." 
                : "Le mode maintenance est désactivé. Le site est de nouveau accessible à tous."
            );
        } else {
            toast.error("Échec de la mise à jour du mode maintenance.");
        }
        setLoading(false);
    };

    return (
        <Card className={isMaintenance ? "border-amber-500 bg-amber-50/10" : ""}>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Power className={`h-5 w-5 ${isMaintenance ? "text-amber-500" : "text-green-500"}`} />
                    <CardTitle>Mode Maintenance</CardTitle>
                </div>
                <CardDescription>
                    Lorsque ce mode est activé, tous les utilisateurs non-administrateurs seront redirigés vers une page de maintenance.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-4">
                    <Switch 
                        id="maintenance-mode" 
                        checked={isMaintenance} 
                        onCheckedChange={handleToggle}
                        disabled={loading}
                    />
                    <Label htmlFor="maintenance-mode" className="font-semibold text-lg">
                        {isMaintenance ? "ACTIVÉ" : "DÉSACTIVÉ"}
                    </Label>
                </div>
                {isMaintenance && (
                    <div className="mt-4 flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">
                            Attention : Le site est actuellement inaccessible pour les investisseurs. N'oubliez pas de le désactiver une fois vos travaux terminés.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
