import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/settingsService";
import { sanitizeHtml } from "@/lib/utils";

const Terms = () => {
    const navigate = useNavigate();

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings"],
        queryFn: getSettings,
    });

    const termsContent = settings?.find(s => s.key === 'terms_content')?.value || "<p>Chargement des conditions...</p>";

    const handleAccept = () => {
        // Navigate back to auth page with accepted param
        navigate("/auth?tab=signup&accepted=true");
    };

    const handleBack = () => {
        navigate(-1);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl h-[90vh] flex flex-col shadow-elegant border-border/50">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={handleBack}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <CardTitle className="text-2xl font-bold text-primary">Conditions Générales d'Utilisation</CardTitle>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full p-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none space-y-6"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(termsContent) }}
                            />
                        )}
                    </ScrollArea>
                </CardContent>

                <div className="p-6 border-t bg-card/50 backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground text-center sm:text-left">
                            En cliquant sur le bouton ci-contre, vous confirmez avoir lu et compris l'intégralité des conditions générales d'utilisation.
                        </p>
                        <Button onClick={handleAccept} size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-lg hover:shadow-xl transition-all">
                            <Check className="h-5 w-5" />
                            J'ai lu et j'accepte
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Terms;
