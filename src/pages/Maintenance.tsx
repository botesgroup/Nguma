import { Button } from "@/components/ui/button";
import { Hammer, Clock, PhoneCall } from "lucide-react";

export const MaintenancePage = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border-t-4 border-amber-500">
                <div className="mb-6 bg-amber-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Hammer className="h-10 w-10 text-amber-600" />
                </div>
                
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Maintenance en cours</h1>
                
                <p className="text-slate-600 mb-8 leading-relaxed">
                    Nous mettons à jour la plateforme Nguma pour vous offrir une meilleure expérience. 
                    Le site sera de nouveau accessible très bientôt. Merci de votre patience !
                </p>

                <div className="grid grid-cols-1 gap-4 mb-8 text-left">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Durée estimée</p>
                            <p className="text-sm font-medium text-slate-900">Environ 30 minutes</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <PhoneCall className="h-5 w-5 text-green-500" />
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Besoin d'aide ?</p>
                            <p className="text-sm font-medium text-slate-900">Contactez le support sur WhatsApp</p>
                        </div>
                    </div>
                </div>

                <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.location.reload()}
                >
                    Réessayer de charger la page
                </Button>
            </div>
            
            <p className="mt-8 text-slate-400 text-sm">
                © {new Date().getFullYear()} Nguma BotesGroup. Tous droits réservés.
            </p>
        </div>
    );
};
