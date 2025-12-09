import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PaymentMethod, PaymentMethodField } from '@/services/paymentMethodsService';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Props {
    method: PaymentMethod;
    amount: number;
    onSubmit: (formData: Record<string, any>) => void;
    isSubmitting?: boolean;
}

export const DynamicPaymentForm = ({ method, amount, onSubmit, isSubmitting = false }: Props) => {
    const [proofUrl, setProofUrl] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const { toast } = useToast();

    const adminFields = method.fields?.filter(f => !f.is_user_input) || [];

    const copyToClipboard = (text: string, fieldKey: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        toast({ description: "✅ Copié dans le presse-papier" });
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('payment_proofs')
                .upload(fileName, file);

            if (uploadError) {
                toast({
                    variant: "destructive",
                    title: "Erreur d'upload",
                    description: uploadError.message
                });
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('payment_proofs')
                .getPublicUrl(fileName);

            setProofUrl(publicUrl);

            toast({
                title: "✅ Fichier uploadé",
                description: "Votre preuve de paiement a été téléchargée avec succès."
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Vérifier que la preuve a été uploadée
        if (!proofUrl) {
            toast({
                variant: "destructive",
                title: "❌ Preuve requise",
                description: "Veuillez uploader une preuve de paiement."
            });
            return;
        }

        onSubmit({ proof_url: proofUrl });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Instructions */}
            {method.instructions && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                        {method.instructions}
                    </AlertDescription>
                </Alert>
            )}

            {/* Champs admin (affichage seul avec bouton copier) */}
            {adminFields.length > 0 && (
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                            Informations de paiement
                        </div>
                        {adminFields.map(field => (
                            <div key={field.id} className="space-y-2">
                                <Label className="text-sm font-medium">{field.field_label}</Label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 p-3 rounded-md bg-muted/50 font-mono text-sm break-all border">
                                        {field.field_value}
                                    </div>
                                    {field.show_copy_button && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => copyToClipboard(field.field_value || '', field.field_key)}
                                        >
                                            {copiedField === field.field_key ? (
                                                <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Preuve de paiement */}
            <div className="space-y-2">
                <Label htmlFor="proof" className="text-sm font-medium">
                    Preuve de paiement <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="proof"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                    }}
                    disabled={isSubmitting || isUploading}
                    className="cursor-pointer"
                />
                {proofUrl && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <span>Fichier uploadé avec succès</span>
                    </div>
                )}
                {isUploading && (
                    <div className="text-sm text-muted-foreground">
                        Upload en cours...
                    </div>
                )}
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Téléchargez une capture d'écran ou une photo de votre transaction</span>
                </p>
            </div>

            {/* Montant (lecture seule) */}
            <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">Montant</Label>
                <Input
                    id="amount"
                    type="text"
                    value={`${amount.toFixed(2)} USD`}
                    disabled
                    className="font-semibold text-lg"
                />
            </div>

            {/* Bouton de soumission */}
            <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || isUploading}
            >
                {isSubmitting ? "Envoi en cours..." : isUploading ? "Upload en cours..." : "Confirmer la demande de dépôt"}
            </Button>
        </form>
    );
};
