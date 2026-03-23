import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/services/profileService';
import { useLocation, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { isProfileComplete, isRouteAllowedForIncompleteProfile } from '@/services/navigationService';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface ProfileCompletionGuardProps {
  children: ReactNode;
}

/**
 * ProfileCompletionGuard - Ensures user has completed their profile
 * 
 * This guard:
 * 1. Checks if the user's profile is complete (required fields filled)
 * 2. Redirects to /profile if incomplete (except for allowed routes)
 * 3. Handles loading and error states gracefully
 */
export const ProfileCompletionGuard = ({ children }: ProfileCompletionGuardProps) => {
  const location = useLocation();

  const { data: profile, isLoading, isError, error } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: (failureCount) => failureCount < 3, // Retry up to 3 times
    staleTime: 5000, // Consider data fresh for 5 seconds
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground animate-pulse">Vérification de votre profil...</p>
      </div>
    );
  }

  // Show error state with retry option
  if (isError) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl border-2 border-destructive/50 p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Profil indisponible</h1>
            <p className="text-muted-foreground">
              {error?.message || 'Un problème est survenu lors du chargement de votre profil.'}
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
              onClick={() => {
                window.location.hash = '#/';
              }}
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if profile is complete using centralized service
  const complete = isProfileComplete(profile);

  // If profile is not complete and user is not on an allowed route
  if (!complete && !isRouteAllowedForIncompleteProfile(location.pathname)) {
    return <Navigate to="/profile" replace />;
  }

  // Profile is complete or user is on an allowed route
  return <>{children}</>;
};
