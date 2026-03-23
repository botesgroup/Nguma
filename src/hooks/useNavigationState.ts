/**
 * useNavigationState Hook - Preserve navigation state across refreshes
 * 
 * This hook manages the preservation and retrieval of navigation state
 * (like the 'from' path for redirects after login) across page refreshes.
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  saveNavigationState,
  getSavedNavigationState,
  clearNavigationState,
  isRecoveryFlow
} from '@/services/navigationService';

interface NavigationState {
  from: string | null;
  hasInitialized: boolean;
}

/**
 * Hook to manage navigation state persistence
 */
export function useNavigationState() {
  const initializedRef = useRef(false);
  
  /**
   * Get the initial navigation state
   * Called once on mount to restore state from sessionStorage
   */
  const getInitialState = useCallback((): NavigationState => {
    // Don't restore if in recovery flow
    if (isRecoveryFlow(window.location.hash)) {
      return { from: null, hasInitialized: true };
    }
    
    const savedFrom = getSavedNavigationState();
    return {
      from: savedFrom,
      hasInitialized: true
    };
  }, []);

  /**
   * Save the current path for later retrieval
   */
  const saveState = useCallback((fromPath: string) => {
    saveNavigationState(fromPath);
  }, []);

  /**
   * Clear the saved navigation state
   */
  const clearState = useCallback(() => {
    clearNavigationState();
  }, []);

  /**
   * Check if we should redirect to saved path
   */
  const shouldRedirectToSaved = useCallback((currentPath: string): boolean => {
    // Don't redirect in recovery flow
    if (isRecoveryFlow(window.location.hash)) {
      return false;
    }
    
    // Don't redirect if already on the saved path
    const savedFrom = getSavedNavigationState();
    if (!savedFrom || savedFrom === currentPath) {
      return false;
    }
    
    // Don't redirect from public routes
    const publicRoutes = ['/', '/auth', '/terms', '/how-it-works', '/update-password'];
    if (publicRoutes.includes(currentPath)) {
      return false;
    }
    
    return true;
  }, []);

  return {
    getInitialState,
    saveState,
    clearState,
    shouldRedirectToSaved
  };
}

/**
 * HOC wrapper for components that need navigation state
 * @deprecated Use useNavigationState hook directly instead.
 * Note: This HOC has been disabled because .ts files cannot contain JSX.
 * Use the hook directly in your components instead.
 */
export function withNavigationState<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
  // Return a placeholder component that throws an error if used
  // This is intentional - use the hook directly instead
  return function WithNavigationState(_props: P) {
    throw new Error(
      'withNavigationState is deprecated and disabled. ' +
      'Use the useNavigationState hook directly in your component.'
    );
  };
}
