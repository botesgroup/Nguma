import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { z } from "zod";
import { checkRateLimit, formatRateLimitReset } from "@/services/rateLimitService";
import { logLoginAttempt } from "@/services/auditService";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, EyeOff, Shield } from "lucide-react";

const signInSchema = z.object({
  email: z.string().email("Email invalide").max(255),
  password: z.string().min(1, "Le mot de passe est requis."),
});

const signUpSchema = z.object({
  email: z.string().email("Email invalide").max(255),
  firstName: z.string().min(2, "Le prénom est requis.").max(100),
  lastName: z.string().min(2, "Le nom est requis.").max(100),
  postNom: z.string().optional(),
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]).*$/, "Doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
});

import { Checkbox } from "@/components/ui/checkbox";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Check for accepted param in URL
    const params = new URLSearchParams(location.search);
    if (params.get("accepted") === "true") {
      setTermsAccepted(true);
      // Switch to signup tab if accepted
      if (params.get("tab") === "signup") {
        // We need to handle tab switching, but the Tabs component is uncontrolled by default.
        // Let's just set the state, the user will see the checkbox checked.
      }
    }
  }, [location.search]);

  const signInForm = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", firstName: "", lastName: "", postNom: "", password: "", confirmPassword: "" },
  });

  const handleSignUp = async (values: z.infer<typeof signUpSchema>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            post_nom: values.postNom || "",
          },
        },
      });
      if (error) throw error;

      // If user is created and session exists (email confirmation disabled or auto-confirmed)
      if (data.session) {
        toast({
          title: "Compte créé !",
          description: "Redirection vers votre dashboard...",
        });
        // Redirect to dashboard immediately
        navigate("/dashboard");
      } else {
        // Email confirmation required
        toast({
          title: "Compte créé !",
          description: "Veuillez vérifier votre email pour confirmer votre compte.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const [showMFAInput, setShowMFAInput] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string>("");
  const [mfaCode, setMfaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleSignIn = async (values: z.infer<typeof signInSchema>) => {
    setIsLoading(true);
    try {
      // Vérifier rate limit AVANT la tentative de connexion
      const rateLimit = await checkRateLimit(values.email, 'login');

      if (!rateLimit.allowed) {
        const resetTime = formatRateLimitReset(rateLimit.reset_at);
        toast({
          variant: "destructive",
          title: "🔒 Trop de tentatives",
          description: `Votre compte est temporairement bloqué. Réessayez dans ${resetTime}.`,
        });
        return; // Arrêter ici, pas de tentative de login
      }

      // Afficher avertissement si proche de la limite
      if (rateLimit.remaining <= 2 && rateLimit.remaining > 0) {
        toast({
          variant: "warning" as any,
          title: "⚠️ Attention",
          description: `Il vous reste ${rateLimit.remaining} tentative(s) avant blocage.`,
        });
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signInError) throw signInError;

      // Check if MFA is required (Supabase might return a session with aal1 if mfa is enabled but not verified)
      // However, usually signInWithPassword returns data.user and data.session.
      // If MFA is enforced, we might need to check the assurance level or if an error was thrown (Supabase Auth v2 handles this differently depending on config).
      // But typically for "optional" MFA that we enforce in app, we check if the user has factors.

      // Let's check if the user has any MFA factors enrolled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(f => f.status === 'verified');

      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
        setShowMFAInput(true);
        setIsLoading(false);
        return;
      }

      if (signInData.user) {
        // Log successful login
        await logLoginAttempt({
          email: values.email,
          success: true,
          userId: signInData.user.id,
        });

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", signInData.user.id)
          .single();

        const from = location.state?.from || (roleData?.role === 'admin' ? "/admin" : "/dashboard");
        navigate(from);
      }
    } catch (error: any) {
      // Log failed login
      await logLoginAttempt({
        email: values.email,
        success: false,
        errorMessage: error.message,
      });

      // Handle specific MFA error if Supabase throws one (depends on project settings)
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Identifiants incorrects ou erreur de réseau.",
      });
    } finally {
      if (!showMFAInput) setIsLoading(false);
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });

      if (error) throw error;

      toast({
        title: "Authentification réussie",
        description: "Connexion sécurisée validée.",
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const from = location.state?.from || (roleData?.role === 'admin' ? "/admin" : "/dashboard");
        navigate(from);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur 2FA",
        description: error.message || "Code incorrect.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Verify backup code via RPC
      const { data, error } = await supabase.rpc('verify_backup_code', {
        p_code: mfaCode,
      });

      if (error || !data || data.length === 0 || !data[0].valid) {
        toast({
          variant: "destructive",
          title: "Code invalide",
          description: "Ce code de récupération est invalide ou déjà utilisé.",
        });
        return;
      }

      toast({
        title: "Authentification réussie",
        description: "Connexion sécurisée avec code de récupération.",
      });

      // Get user role and navigate
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const from = location.state?.from || (roleData?.role === 'admin' ? "/admin" : "/dashboard");
        navigate(from);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Code de récupération incorrect.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = signInForm.getValues("email");
    if (!email) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez entrer votre adresse email dans le champ de connexion.",
      });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      toast({
        title: "Email envoyé",
        description: "Veuillez vérifier votre boîte de réception.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google') => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur OAuth",
        description: `Impossible de se connecter avec ${provider}: ${error.message}`,
      });
      setIsLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState("signin");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === "signup") {
      setActiveTab("signup");
    }
  }, [location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Nguma" className="mx-auto h-18 w-auto rounded-md shadow-sm" />
          <h1 className="text-3xl font-bold mt-3 mb-2">NGUMA</h1>
          <p className="text-muted-foreground">Plateforme d'investissement automatisé</p>
        </div>

        <Card className="shadow-elegant border-border/50">
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>Connectez-vous ou créez votre compte</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <div className="my-4">
                <Button variant="outline" className="w-full" onClick={() => handleOAuthSignIn('google')} disabled={isLoading}>
                  <img src="/google-logo.svg" alt="Google logo" className="mr-2 h-5 w-5" />
                  Continuer avec Google
                </Button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Ou continuer avec</span>
                </div>
              </div>

              <TabsContent value="signin">
                {showMFAInput ? (
                  <form onSubmit={useBackupCode ? handleBackupCodeLogin : handleMFAVerify} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mfa-code">
                        {useBackupCode ? "Code de récupération" : "Code d'authentification (2FA)"}
                      </Label>
                      <Input
                        id="mfa-code"
                        placeholder={useBackupCode ? "ABCD1234" : "123456"}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        maxLength={useBackupCode ? 8 : 6}
                        className="text-center text-lg tracking-widest"
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground">
                        {useBackupCode
                          ? "Entrez l'un de vos codes de récupération sauvegardés lors de la configuration 2FA."
                          : "Ouvrez votre application d'authentification (Google Authenticator, Authy...) pour obtenir le code."
                        }
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || (useBackupCode ? mfaCode.length !== 8 : mfaCode.length !== 6)}
                    >
                      {isLoading ? "Vérification..." : "Vérifier"}
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      className="w-full"
                      onClick={() => {
                        setUseBackupCode(!useBackupCode);
                        setMfaCode("");
                      }}
                    >
                      {useBackupCode ? "Utiliser l'app d'authentification" : "Utiliser un code de récupération"}
                    </Button>
                    <Button variant="ghost" type="button" className="w-full" onClick={() => setShowMFAInput(false)}>
                      Retour
                    </Button>
                  </form>
                ) : (
                  <Form {...signInForm}>
                    <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                      <FormField control={signInForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="vous@exemple.com" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={signInForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                            </FormControl>
                            <Button type="button" variant="ghost" size="sm" className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="text-right text-sm -mt-2">
                        <Button variant="link" type="button" onClick={handleForgotPassword} className="px-0 h-auto py-1">
                          Mot de passe oublié ?
                        </Button>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Connexion..." : "Se connecter"}
                      </Button>
                    </form>
                  </Form>
                )}
              </TabsContent>

              <TabsContent value="signup">
                <Form {...signUpForm}>
                  <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={signUpForm.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input placeholder="Jean" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={signUpForm.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={signUpForm.control} name="postNom" render={({ field }) => (
                      <FormItem><FormLabel>Post-nom (Optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={signUpForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="vous@exemple.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={signUpForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                          </FormControl>
                          <Button type="button" variant="ghost" size="sm" className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={signUpForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmer le mot de passe</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                          </FormControl>
                          <Button type="button" variant="ghost" size="sm" className="absolute inset-y-0 right-0 h-full px-3 text-gray-500 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="flex items-center space-x-2 py-2">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                      />
                      <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        J'accepte les <a href="/terms" className="text-primary hover:underline font-semibold">conditions générales d'utilisation</a>
                      </label>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading || !termsAccepted}>
                      {isLoading ? "Création..." : "Créer mon compte"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Vos données sont sécurisées et chiffrées</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
