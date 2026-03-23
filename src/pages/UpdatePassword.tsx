import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

import { sendResendNotification } from "@/services/resendNotificationService";
import { getProfile } from "@/services/profileService";
import { isRecoveryFlow } from "@/services/navigationService";

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

/**
 * Configuration constants
 */
const CONFIG = {
  // Timeout for authorization check (increased from 5s to 15s)
  AUTHORIZATION_TIMEOUT: 15000,
  // Timeout for password update operation
  UPDATE_TIMEOUT: 30000,
  // Session check retry interval
  SESSION_CHECK_INTERVAL: 1000,
};

const UpdatePassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(CONFIG.AUTHORIZATION_TIMEOUT / 1000);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Vérifier si l'utilisateur est autorisé à changer son mot de passe
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    let subscription: { unsubscribe: () => void };

    const checkAuthorization = async () => {
      // Check if we're in a recovery flow
      if (!isRecoveryFlow(window.location.hash)) {
        setAuthorizationError("Lien de réinitialisation invalide. Veuillez utiliser le lien dans l'email.");
        return;
      }

      // Supabase gère automatiquement la session après un clic sur le lien de réinitialisation
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setIsAuthorized(true);
        return;
      }

      // Écouter les changements d'authentification (PASSWORD_RECOVERY)
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || session) {
          setIsAuthorized(true);
          authSubscription.unsubscribe();
        }
      });

      subscription = authSubscription;
    };

    // Countdown timer for visual feedback
    intervalId = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    checkAuthorization();

    // Timeout de 15 secondes si rien ne se passe
    timeoutId = setTimeout(() => {
      if (!isAuthorized) {
        setAuthorizationError("Lien expiré ou invalide. La session de réinitialisation a expiré.");
      }
    }, CONFIG.AUTHORIZATION_TIMEOUT);

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  const onSubmit = async (values: PasswordFormValues) => {
    setIsLoading(true);
    
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Timeout",
        description: "La mise à jour a pris trop de temps. Veuillez réessayer.",
      });
    }, CONFIG.UPDATE_TIMEOUT);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Utilisateur non authentifié.");

      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) throw error;

      // --- Send Password Change Notification ---
      const profile = await getProfile();
      if (profile?.email) {
        await sendResendNotification('password_changed', {
          to: profile.email,
          name: profile.first_name || 'Cher utilisateur',
          date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          userId: user.id
        });
      }

      toast({
        title: "Mot de passe mis à jour !",
        description: "Votre mot de passe a été modifié avec succès.",
      });
      
      clearTimeout(timeoutId);
      navigate("/auth");
    } catch (error) {
      clearTimeout(timeoutId);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la mise à jour du mot de passe.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show authorization error
  if (authorizationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elegant border-destructive/50">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-center text-destructive">Lien invalide ou expiré</CardTitle>
            <CardDescription className="text-center">
              {authorizationError}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Demandez un nouveau lien de réinitialisation depuis la page de connexion.
            </p>
            <Button 
              className="w-full" 
              onClick={() => navigate("/auth")}
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {!isAuthorized ? (
        <Card className="w-full max-w-md shadow-elegant border-border/50">
          <CardHeader>
            <CardTitle>Vérification du lien...</CardTitle>
            <CardDescription>
              Nous vérifions votre lien de réinitialisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-1000"
                style={{ width: `${((CONFIG.AUTHORIZATION_TIMEOUT - timeRemaining * 1000) / CONFIG.AUTHORIZATION_TIMEOUT) * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Temps restant : {timeRemaining}s
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Si rien ne se passe, cliquez sur "Mot de passe oublié ?" sur la page de connexion.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md shadow-elegant border-border/50">
          <CardHeader>
            <CardTitle>Mettre à jour votre mot de passe</CardTitle>
            <CardDescription>Veuillez entrer votre nouveau mot de passe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nouveau mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                      </FormControl>
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
                          <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UpdatePassword;
