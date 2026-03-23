import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { getSecuritySettings } from "@/services/securitySettingsService";
import { getAdminNavigationResult } from "@/services/navigationService";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const location = useLocation();

  // Get security settings
  const { data: securitySettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["securitySettings"],
    queryFn: getSecuritySettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user role
  const { data: userRole, isLoading: isLoadingRole } = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error || !data || data.length === 0) return null;

      const roles = data.map(r => r.role);
      return roles.includes('admin') ? 'admin' : roles[0];
    },
  });

  // Check if admin has 2FA enabled
  const { data: has2FA, isLoading: isLoading2FA, error: mfaError } = useQuery({
    queryKey: ["has2FA"],
    queryFn: async () => {
      if (userRole !== 'admin') return true; // Only check for admins

      try {
        const { data } = await supabase.auth.mfa.listFactors();
        return data?.totp?.some(f => f.status === 'verified') || false;
      } catch (error) {
        console.error("Error checking MFA status:", error);
        return false;
      }
    },
    enabled: userRole === 'admin', // Only run if user is admin
    retry: 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const isLoading = isLoadingSettings || isLoadingRole || isLoading2FA;

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // Handle MFA check errors
  if (mfaError && userRole === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl border-2 border-destructive/50 p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Erreur de sécurité</h1>
            <p className="text-muted-foreground">
              Impossible de vérifier votre authentification à deux facteurs.
            </p>
          </div>
          <div className="pt-4 space-y-2">
            <Button
              variant="default"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/dashboard'}
            >
              Retour au dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Get navigation result from centralized service
  const navigationResult = getAdminNavigationResult(
    userRole,
    has2FA ?? null,
    securitySettings?.twoFactorMandatoryForAdmins ?? false,
    location.pathname
  );

  // Redirect if not admin
  if (navigationResult.blocked && navigationResult.blockReason === 'insufficient_role') {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect to 2FA setup if required
  if (navigationResult.blocked && navigationResult.blockReason === 'mfa_required') {
    return <Navigate to="/setup-2fa" replace />;
  }

  // All checks passed - render children
  return children;
};

export default AdminRoute;
