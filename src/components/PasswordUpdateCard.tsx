import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]).{8,}$/, "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.")
    .max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

type Step = 'initial' | 'otp' | 'password';

export function PasswordUpdateCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('initial');
  const [otpCode, setOtpCode] = useState("");
  const { toast } = useToast();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const sendOtpRequest = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Email non trouvé. Veuillez vous reconnecter.");

      const { data, error } = await supabase.rpc('request_password_reset_otp', {
        p_email: user.email
      });

      if (error) throw error;
      if (data && !(data as any).success) throw new Error((data as any).message);

      setCurrentStep('otp');
      toast({
        title: "Code de sécurité envoyé",
        description: "Vérifiez votre boîte mail pour obtenir votre code de validation à 6 chiffres.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur d'envoi",
        description: error.message || "Une erreur est survenue lors de l'envoi du code.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateOtpFormat = () => {
    if (otpCode.length === 6) {
      setCurrentStep('password');
      toast({
        title: "Identité vérifiée",
        description: "Vous pouvez maintenant définir votre nouveau mot de passe.",
      });
    } else {
      toast({ variant: "destructive", title: "Code invalide", description: "Veuillez entrer un code à 6 chiffres." });
    }
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session expirée.");

      const { data, error } = await supabase.functions.invoke('reset-password-admin', {
        body: {
          email: user.email,
          code: otpCode,
          password: values.password,
        },
      });

      if (error) {
        let errorMessage = "Erreur lors de la mise à jour.";
        try {
          const errorBody = await error.context?.json();
          errorMessage = errorBody?.error || error.message;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      if (data?.error) throw new Error(data.error);

      toast({
        title: "Succès !",
        description: "Votre mot de passe a été modifié avec succès.",
      });

      form.reset();
      setCurrentStep('initial');
      setOtpCode("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Échec de la modification",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Sécurité du Compte</CardTitle>
            <CardDescription>Mise à jour sécurisée du mot de passe</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {currentStep === 'initial' && (
          <div className="space-y-4 py-4 text-center animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Vérification requise</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Pour modifier votre mot de passe, nous devons d'abord confirmer votre identité via un code envoyé sur votre adresse email.
              </p>
            </div>
            <Button 
              onClick={sendOtpRequest} 
              className="w-full sm:w-auto px-8" 
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi...</>
              ) : (
                <><ArrowRight className="mr-2 w-4 h-4" /> Commencer la vérification</>
              )}
            </Button>
          </div>
        )}

        {currentStep === 'otp' && (
          <div className="space-y-6 py-4 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg flex items-start gap-3 border border-amber-200 dark:border-amber-900/30">
              <Mail className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Code de vérification envoyé</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                  Veuillez entrer le code à 6 chiffres que vous avez reçu par email.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium">Saisissez votre code</label>
              <Input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-3xl tracking-[0.4em] font-mono h-16 border-primary/30"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={validateOtpFormat} 
                className="flex-1"
                disabled={isLoading || otpCode.length !== 6}
              >
                Suivant
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setCurrentStep('initial')} 
                disabled={isLoading}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'password' && (
          <div className="space-y-6 py-2 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/20 p-3 rounded-md border border-green-200 dark:border-green-900/30">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Identité vérifiée (Code: {otpCode})</span>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nouveau mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>Minimum 8 caractères, une majuscule et un symbole.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mise à jour...</>
                    ) : "Valider le changement"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setCurrentStep('otp')} 
                    disabled={isLoading}
                  >
                    Retour
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
