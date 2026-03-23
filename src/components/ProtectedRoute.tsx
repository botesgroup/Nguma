import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { getProfile } from "@/services/profileService";
import type { Profile } from "@/services/navigationService";
import {
  isUserBanned,
  formatBanMessage,
  saveNavigationState,
  isPublicRoute
} from "@/services/navigationService";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [banMessage, setBanMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkUserStatus = async (currentUser: User | null) => {
      if (!currentUser) {
        setIsBanned(false);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch profile to check ban status and completeness
        const userProfile = await getProfile();
        setProfile(userProfile);

        if (userProfile?.banned_until) {
          const bannedUntil = new Date(userProfile.banned_until);
          if (bannedUntil > new Date()) {
            setIsBanned(true);
            setBanMessage(formatBanMessage(userProfile));
          }
        }
      } catch (err) {
        console.error("Error checking user status:", err);
        setError(err instanceof Error ? err.message : "Erreur de vérification");
      } finally {
        setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkUserStatus(session.user);
        } else {
          setLoading(false);
        }
      }
    );

    // Initial check with timeout
    timeoutId = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timed out after 10s, forcing loading to false");
        setLoading(false);
      }
    }, 10000);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkUserStatus(session.user);
        } else {
          setLoading(false);
        }
        clearTimeout(timeoutId);
      })
      .catch(err => {
        console.error("Error in getSession:", err);
        setError("Erreur de session");
        setLoading(false);
        clearTimeout(timeoutId);
      });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/auth";
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl border-2 border-destructive/50 p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Erreur d'authentification</h1>
            <p className="text-muted-foreground">{error}</p>
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
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show banned state
  if (isBanned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/5 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border-2 border-destructive p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-destructive tracking-tight">COMPTE BANNI</h1>
            <p className="text-xl font-bold text-gray-900">ACCÈS RÉVOQUÉ</p>
          </div>

          <p className="text-gray-600 leading-relaxed">
            {banMessage}
          </p>

          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full border-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </div>

          <p className="text-xs text-gray-400 italic">
            Si vous pensez qu'il s'agit d'une erreur, contactez le support.
          </p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user || !session) {
    // Save the current path for redirect after login
    const currentPath = location.pathname + location.search;
    if (!isPublicRoute(currentPath)) {
      saveNavigationState(currentPath);
    }
    
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
