
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { getSecuritySettings } from "@/services/securitySettingsService";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  // Get security settings
  const { data: securitySettings } = useQuery({
    queryKey: ["securitySettings"],
    queryFn: getSecuritySettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: userRole, isLoading } = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      return data?.role;
    },
  });

  // Check if admin has 2FA enabled
  const { data: has2FA, isLoading: isLoading2FA } = useQuery({
    queryKey: ["has2FA"],
    queryFn: async () => {
      if (userRole !== 'admin') return true; // Only check for admins

      const { data } = await supabase.auth.mfa.listFactors();
      return data?.totp?.some(f => f.status === 'verified') || false;
    },
    enabled: userRole === 'admin', // Only run if user is admin
  });

  if (isLoading || isLoading2FA) {
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

  if (userRole !== 'admin') {
    // Redirect them to the home page, but replace the current entry in the
    // history stack so the user can't "go back" to the admin page.
    return <Navigate to="/dashboard" replace />;
  }

  // Only enforce 2FA if setting is enabled
  if (userRole === 'admin' && securitySettings?.twoFactorMandatoryForAdmins && has2FA === false) {
    return <Navigate to="/setup-2fa" replace />;
  }

  return children;
};

export default AdminRoute;
