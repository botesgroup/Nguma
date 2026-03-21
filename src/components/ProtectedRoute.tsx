import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "./ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserStatus = async (currentUser: User | null) => {
      if (!currentUser) {
        setIsBanned(false);
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('banned_until')
          .eq('id', currentUser.id)
          .single();

        if (!error && profile?.banned_until) {
          const bannedUntil = new Date(profile.banned_until);
          if (bannedUntil > new Date()) {
            setIsBanned(true);
          }
        }
      } catch (err) {
        console.error("Error checking ban status:", err);
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
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timed out after 10s, forcing loading to false");
        setLoading(false);
      }
    }, 10000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkUserStatus(session.user);
      } else {
        setLoading(false);
      }
      clearTimeout(timeout);
    }).catch(err => {
      console.error("Error in getSession:", err);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

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
            Votre compte a été banni pour non-respect des règles et conditions d'utilisation de la plateforme.
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

  if (!user || !session) {
    const location = useLocation();
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
