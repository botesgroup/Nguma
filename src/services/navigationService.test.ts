/**
 * Tests for navigationService.ts
 * 
 * Run with: npm test -- navigationService.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isRecoveryFlow,
  getDefaultDestination,
  isProfileComplete,
  isRouteAllowedForIncompleteProfile,
  getPostLoginNavigation,
  isPublicRoute,
  isUserBanned,
  getBanExpiryDate,
  formatBanMessage,
  saveNavigationState,
  getSavedNavigationState,
  clearNavigationState,
  getAdminNavigationResult,
  getProtectedRouteNavigationResult,
  type Profile,
} from '@/services/navigationService';

// Mock sessionStorage
const mockSessionStorage = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => this.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => { this.store.set(key, value); }),
  removeItem: vi.fn((key: string) => { this.store.delete(key); }),
  clear: vi.fn(() => { this.store.clear(); }),
};

vi.stubGlobal('sessionStorage', mockSessionStorage);

describe('navigationService', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('isRecoveryFlow', () => {
    it('should return true for recovery hash', () => {
      expect(isRecoveryFlow('#/update-password?type=recovery')).toBe(true);
      expect(isRecoveryFlow('#/update-password?access_token=abc123')).toBe(true);
    });

    it('should return true for update-password route', () => {
      expect(isRecoveryFlow('#/update-password')).toBe(true);
    });

    it('should return true for error flows', () => {
      expect(isRecoveryFlow('#/auth?error_description=invalid')).toBe(true);
    });

    it('should return false for normal routes', () => {
      expect(isRecoveryFlow('#/dashboard')).toBe(false);
      expect(isRecoveryFlow('#/')).toBe(false);
    });
  });

  describe('getDefaultDestination', () => {
    it('should return /admin for admin users', () => {
      expect(getDefaultDestination('admin')).toBe('/admin');
    });

    it('should return /dashboard for regular users', () => {
      expect(getDefaultDestination('user')).toBe('/dashboard');
      expect(getDefaultDestination(null)).toBe('/dashboard');
    });
  });

  describe('isProfileComplete', () => {
    const createProfile = (overrides: Partial<Profile>): Profile => ({
      id: 'test-id',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      post_nom: null,
      phone: '+1234567890',
      birth_date: '1990-01-01',
      country: null,
      city: null,
      address: null,
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      banned_until: null,
      ...overrides,
    });

    it('should return true for complete profile', () => {
      const profile = createProfile({});
      expect(isProfileComplete(profile)).toBe(true);
    });

    it('should return false for missing first_name', () => {
      const profile = createProfile({ first_name: '' });
      expect(isProfileComplete(profile)).toBe(false);
    });

    it('should return false for missing last_name', () => {
      const profile = createProfile({ last_name: '' });
      expect(isProfileComplete(profile)).toBe(false);
    });

    it('should return false for missing phone', () => {
      const profile = createProfile({ phone: '' });
      expect(isProfileComplete(profile)).toBe(false);
    });

    it('should return false for null profile', () => {
      expect(isProfileComplete(null)).toBe(false);
    });
  });

  describe('isPublicRoute', () => {
    it('should return true for public routes', () => {
      expect(isPublicRoute('/')).toBe(true);
      expect(isPublicRoute('/auth')).toBe(true);
      expect(isPublicRoute('/terms')).toBe(true);
      expect(isPublicRoute('/how-it-works')).toBe(true);
      expect(isPublicRoute('/update-password')).toBe(true);
      expect(isPublicRoute('/logout')).toBe(true);
    });

    it('should return false for protected routes', () => {
      expect(isPublicRoute('/dashboard')).toBe(false);
      expect(isPublicRoute('/admin')).toBe(false);
      expect(isPublicRoute('/contracts')).toBe(false);
    });
  });

  describe('isRouteAllowedForIncompleteProfile', () => {
    it('should return true for allowed routes', () => {
      expect(isRouteAllowedForIncompleteProfile('/profile')).toBe(true);
      expect(isRouteAllowedForIncompleteProfile('/auth')).toBe(true);
      expect(isRouteAllowedForIncompleteProfile('/')).toBe(true);
    });

    it('should return false for restricted routes', () => {
      expect(isRouteAllowedForIncompleteProfile('/dashboard')).toBe(false);
      expect(isRouteAllowedForIncompleteProfile('/contracts')).toBe(false);
    });
  });

  describe('isUserBanned', () => {
    it('should return false for non-banned user', () => {
      const profile: Profile = {
        id: 'test',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        phone: '123',
        birth_date: '2000-01-01',
        banned_until: null,
        created_at: '',
        updated_at: '',
        post_nom: null,
        country: null,
        city: null,
        address: null,
        avatar_url: null,
      };
      expect(isUserBanned(profile)).toBe(false);
    });

    it('should return false for expired ban', () => {
      const profile: Profile = {
        id: 'test',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        phone: '123',
        birth_date: '2000-01-01',
        banned_until: '2020-01-01T00:00:00Z',
        created_at: '',
        updated_at: '',
        post_nom: null,
        country: null,
        city: null,
        address: null,
        avatar_url: null,
      };
      expect(isUserBanned(profile)).toBe(false);
    });

    it('should return true for active ban', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const profile: Profile = {
        id: 'test',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        phone: '123',
        birth_date: '2000-01-01',
        banned_until: futureDate.toISOString(),
        created_at: '',
        updated_at: '',
        post_nom: null,
        country: null,
        city: null,
        address: null,
        avatar_url: null,
      };
      expect(isUserBanned(profile)).toBe(true);
    });
  });

  describe('getAdminNavigationResult', () => {
    it('should redirect to dashboard if not admin', () => {
      const result = getAdminNavigationResult('user', true, false);
      expect(result.path).toBe('/dashboard');
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe('insufficient_role');
    });

    it('should redirect to 2FA setup if required and not enabled', () => {
      const result = getAdminNavigationResult('admin', false, true);
      expect(result.path).toBe('/setup-2fa');
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe('mfa_required');
    });

    it('should allow access if admin with 2FA', () => {
      const result = getAdminNavigationResult('admin', true, true);
      expect(result.blocked).toBe(false);
      expect(result.path).toBe('/admin');
    });

    it('should allow access if admin and 2FA not required', () => {
      const result = getAdminNavigationResult('admin', false, false);
      expect(result.blocked).toBe(false);
    });
  });

  describe('navigation state persistence', () => {
    it('should save and retrieve navigation state', () => {
      saveNavigationState('/dashboard');
      const saved = getSavedNavigationState();
      expect(saved).toBe('/dashboard');
    });

    it('should clear navigation state', () => {
      saveNavigationState('/dashboard');
      clearNavigationState();
      const saved = getSavedNavigationState();
      expect(saved).toBe(null);
    });
  });

  describe('getPostLoginNavigation', () => {
    it('should return saved from path if not public', () => {
      const result = getPostLoginNavigation('user', '/contracts');
      expect(result.path).toBe('/contracts');
    });

    it('should return default destination if from path is public', () => {
      const result = getPostLoginNavigation('user', '/auth');
      expect(result.path).toBe('/dashboard');
    });

    it('should return admin destination for admin users', () => {
      const result = getPostLoginNavigation('admin', null);
      expect(result.path).toBe('/admin');
    });
  });
});
