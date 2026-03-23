/**
 * Navigation Service - Centralized navigation logic for Nguma
 * 
 * This service provides a single source of truth for all navigation-related logic,
 * including route protection, role-based redirects, and state preservation.
 */

import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Profile type from Supabase database
export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Navigation result after authentication/route guard checks
 */
export interface NavigationResult {
  /** The path to navigate to */
  path: string;
  /** Whether to replace the current history entry */
  replace?: boolean;
  /** State to pass to the navigation */
  state?: Record<string, unknown>;
  /** Whether navigation should be blocked */
  blocked?: boolean;
  /** Reason for blocking (if applicable) */
  blockReason?: 'unauthenticated' | 'banned' | 'incomplete_profile' | 'insufficient_role' | 'mfa_required';
}

/**
 * Check if current route is part of recovery flow
 */
export function isRecoveryFlow(hash: string): boolean {
  return (
    hash.includes('type=recovery') ||
    hash.includes('access_token=') ||
    hash.includes('/update-password') ||
    hash.includes('error_description=')
  );
}

/**
 * Determine the default destination based on user role
 */
export function getDefaultDestination(userRole: string | null): string {
  if (userRole === 'admin') {
    return '/admin';
  }
  return '/dashboard';
}

/**
 * Check if profile is complete
 */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  
  return (
    profile.first_name && profile.first_name.trim() !== '' &&
    profile.last_name && profile.last_name.trim() !== '' &&
    profile.phone && profile.phone.trim() !== '' &&
    profile.birth_date !== null && profile.birth_date !== undefined
  );
}

/**
 * Get allowed routes for incomplete profile
 * These routes don't require a complete profile
 */
export function getIncompleteProfileAllowedRoutes(): string[] {
  return [
    '/profile',
    '/auth',
    '/',
    '/logout',
    '/update-password',
    '/setup-2fa',
    '/terms',
    '/how-it-works'
  ];
}

/**
 * Check if a route is allowed for incomplete profile
 */
export function isRouteAllowedForIncompleteProfile(pathname: string): boolean {
  const allowedRoutes = getIncompleteProfileAllowedRoutes();
  return allowedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
}

/**
 * Determine navigation after successful login
 */
export function getPostLoginNavigation(
  userRole: string | null,
  fromPath?: string | null
): NavigationResult {
  // If there's a saved 'from' path and it's not a public route, use it
  if (fromPath && !isPublicRoute(fromPath)) {
    return { path: fromPath, replace: true };
  }
  
  // Otherwise, navigate to default destination based on role
  return { path: getDefaultDestination(userRole), replace: true };
}

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/',
    '/auth',
    '/terms',
    '/how-it-works',
    '/update-password',
    '/logout'
  ];
  
  return publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
}

/**
 * Check if user is banned based on profile data
 */
export function isUserBanned(profile: Profile | null): boolean {
  if (!profile?.banned_until) return false;
  
  const bannedUntil = new Date(profile.banned_until);
  return bannedUntil > new Date();
}

/**
 * Get ban expiry date if user is currently banned
 */
export function getBanExpiryDate(profile: Profile | null): Date | null {
  if (!profile?.banned_until) return null;
  
  const bannedUntil = new Date(profile.banned_until);
  return bannedUntil > new Date() ? bannedUntil : null;
}

/**
 * Format ban expiry message for display
 */
export function formatBanMessage(profile: Profile | null): string {
  const expiryDate = getBanExpiryDate(profile);
  
  if (!expiryDate) {
    return "Votre compte a été banni pour non-respect des règles et conditions d'utilisation de la plateforme.";
  }
  
  const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `Votre compte a été banni jusqu'au ${formattedDate} pour non-respect des règles et conditions d'utilisation de la plateforme.`;
}

/**
 * Storage key for preserving navigation state across refreshes
 */
const NAVIGATION_STATE_KEY = 'nguma_navigation_state';

/**
 * Save navigation state to sessionStorage
 */
export function saveNavigationState(fromPath: string): void {
  try {
    sessionStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify({
      from: fromPath,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Failed to save navigation state:', error);
  }
}

/**
 * Retrieve saved navigation state from sessionStorage
 */
export function getSavedNavigationState(): string | null {
  try {
    const saved = sessionStorage.getItem(NAVIGATION_STATE_KEY);
    if (!saved) return null;
    
    const { from, timestamp } = JSON.parse(saved);
    
    // Invalidate state older than 5 minutes
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - timestamp > maxAge) {
      sessionStorage.removeItem(NAVIGATION_STATE_KEY);
      return null;
    }
    
    return from;
  } catch (error) {
    console.warn('Failed to retrieve navigation state:', error);
    return null;
  }
}

/**
 * Clear saved navigation state
 */
export function clearNavigationState(): void {
  try {
    sessionStorage.removeItem(NAVIGATION_STATE_KEY);
  } catch (error) {
    console.warn('Failed to clear navigation state:', error);
  }
}

/**
 * Admin route navigation logic
 */
export function getAdminNavigationResult(
  userRole: string | null,
  has2FA: boolean | null,
  twoFactorMandatoryForAdmins: boolean,
  fromPath?: string | null
): NavigationResult {
  // Not an admin - redirect to dashboard
  if (userRole !== 'admin') {
    return { 
      path: '/dashboard', 
      replace: true,
      blocked: true,
      blockReason: 'insufficient_role'
    };
  }
  
  // Admin without required 2FA
  if (twoFactorMandatoryForAdmins && has2FA === false) {
    return { 
      path: '/setup-2fa', 
      replace: true,
      blocked: true,
      blockReason: 'mfa_required'
    };
  }
  
  // Admin with proper access
  if (fromPath && fromPath.startsWith('/admin')) {
    return { path: fromPath, replace: true };
  }
  
  return { path: '/admin', replace: true };
}

/**
 * Protected route navigation logic
 */
export function getProtectedRouteNavigationResult(
  user: User | null,
  profile: Profile | null,
  fromPath: string
): NavigationResult {
  // Not authenticated
  if (!user) {
    saveNavigationState(fromPath);
    return { 
      path: '/auth', 
      replace: false,
      state: { from: fromPath },
      blocked: true,
      blockReason: 'unauthenticated'
    };
  }
  
  // User is banned
  if (isUserBanned(profile)) {
    return { 
      path: fromPath,
      blocked: true,
      blockReason: 'banned'
    };
  }
  
  // Profile incomplete
  if (!isProfileComplete(profile) && !isRouteAllowedForIncompleteProfile(fromPath)) {
    return { 
      path: '/profile', 
      replace: true,
      blocked: true,
      blockReason: 'incomplete_profile'
    };
  }
  
  // All checks passed - navigation allowed
  return { path: fromPath, blocked: false };
}
