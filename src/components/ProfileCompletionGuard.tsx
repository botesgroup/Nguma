import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/services/profileService';
import { useLocation, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProfileCompletionGuardProps {
  children: ReactNode;
}

export const ProfileCompletionGuard = ({ children }: ProfileCompletionGuardProps) => {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: false, // Ne pas réessayer indéfiniment si ça échoue
    staleTime: 5000,
  });

  const location = useLocation();

  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground animate-pulse">Configuration de votre espace...</p>
      </div>
    );
  }

  if (isError) {
    // If we're authenticated but getting a profile error, give it a moment to retry
    // or show a slightly more helpful message.
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <p className="text-destructive">Un problème est survenu lors du chargement de votre profil.</p>
        <button 
          onClick={() => {
            window.location.hash = '#/';
            window.location.reload();
          }} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const isProfileComplete = profile?.first_name && profile.first_name.trim() !== '' &&
    profile?.last_name && profile.last_name.trim() !== '' &&
    // post_nom, country, city, address sont maintenant optionnels
    profile?.phone && profile.phone.trim() !== '' &&
    profile?.birth_date;

  // If profile is not complete and user is not already on the profile page or auth page
  if (!isProfileComplete && location.pathname !== '/profile' && location.pathname !== '/auth') {
    return <Navigate to="/profile" replace />;
  }

  // If profile is complete or user is on the allowed pages, render the children
  return <>{children}</>;
};
