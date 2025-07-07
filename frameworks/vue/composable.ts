import type { LoginCredentials } from '../../types';
import type { AuthClient } from '../../core/auth-client';

/**
 * Vue 3 composables for AuthFlow integration
 * Provides Vue-specific authentication utilities
 *
 * Note: This file provides types and utilities for Vue integration.
 * Vue 3 should be installed as a peer dependency in your project.
 */

/**
 * Authentication injection key
 */
export const AUTH_KEY = Symbol('auth');

/**
 * Authentication state interface
 */
export interface AuthState {
  auth: AuthClient;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  error: string | null;
}

/**
 * Authentication composable return type
 */
export interface UseAuthReturn {
  auth: AuthClient;
  isAuthenticated: any; // Vue Ref<boolean>
  isLoading: any; // Vue Ref<boolean>
  user: any; // Vue Ref<any>
  error: any; // Vue Ref<string | null>
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  checkAuth: () => Promise<void>;
  provide: () => void;
}

/**
 * Login composable return type
 */
export interface UseLoginReturn {
  login: (credentials: LoginCredentials) => Promise<void>;
  isLoading: any; // Vue Ref<boolean>
  error: any; // Vue Ref<string | null>
}

/**
 * Logout composable return type
 */
export interface UseLogoutReturn {
  logout: () => Promise<void>;
  isLoading: any; // Vue Ref<boolean>
  error: any; // Vue Ref<string | null>
}

/**
 * Authenticated request composable return type
 */
export interface UseAuthenticatedRequestReturn {
  get: (url: string, config?: any) => Promise<any>;
  post: (url: string, data?: any, config?: any) => Promise<any>;
  put: (url: string, data?: any, config?: any) => Promise<any>;
  patch: (url: string, data?: any, config?: any) => Promise<any>;
  delete: (url: string, config?: any) => Promise<any>;
}

/**
 * Example implementation for user's Vue application:
 *
 * ```typescript
 * import { ref, computed, onMounted, provide, inject } from 'vue';
 * import { AuthClient } from '@jmndao/auth-flow';
 * import { AUTH_KEY, type AuthState, type UseAuthReturn } from '@jmndao/auth-flow/frameworks/vue';
 *
 * export function createAuth(config: AuthConfig): UseAuthReturn {
 *   const auth = new AuthClient(config);
 *   const isAuthenticated = ref(false);
 *   const isLoading = ref(true);
 *   const user = ref(null);
 *   const error = ref<string | null>(null);
 *
 *   const checkAuth = async () => {
 *     try {
 *       const tokens = await auth.getTokens();
 *       isAuthenticated.value = Boolean(tokens);
 *     } catch {
 *       isAuthenticated.value = false;
 *     } finally {
 *       isLoading.value = false;
 *     }
 *   };
 *
 *   const login = async (credentials: LoginCredentials) => {
 *     isLoading.value = true;
 *     error.value = null;
 *     try {
 *       const userData = await auth.login(credentials);
 *       user.value = userData;
 *       isAuthenticated.value = true;
 *     } catch (err) {
 *       error.value = err instanceof Error ? err.message : 'Login failed';
 *       isAuthenticated.value = false;
 *       throw err;
 *     } finally {
 *       isLoading.value = false;
 *     }
 *   };
 *
 *   const logout = async () => {
 *     isLoading.value = true;
 *     error.value = null;
 *     try {
 *       await auth.logout();
 *       user.value = null;
 *       isAuthenticated.value = false;
 *     } catch (err) {
 *       error.value = err instanceof Error ? err.message : 'Logout failed';
 *     } finally {
 *       isLoading.value = false;
 *     }
 *   };
 *
 *   const refreshTokens = async () => {
 *     try {
 *       const tokens = await auth.getTokens();
 *       isAuthenticated.value = Boolean(tokens);
 *     } catch {
 *       isAuthenticated.value = false;
 *       user.value = null;
 *     }
 *   };
 *
 *   onMounted(checkAuth);
 *
 *   return {
 *     auth,
 *     isAuthenticated: computed(() => isAuthenticated.value),
 *     isLoading: computed(() => isLoading.value),
 *     user: computed(() => user.value),
 *     error: computed(() => error.value),
 *     login,
 *     logout,
 *     refreshTokens,
 *     checkAuth,
 *     provide: () => provide(AUTH_KEY, { auth, isAuthenticated: isAuthenticated.value, isLoading: isLoading.value, user: user.value, error: error.value }),
 *   };
 * }
 *
 * export function useAuth(): AuthState {
 *   const authState = inject<AuthState>(AUTH_KEY);
 *   if (!authState) {
 *     throw new Error('useAuth must be used within an auth provider');
 *   }
 *   return authState;
 * }
 * ```
 */

/**
 * Utility functions that don't require Vue imports
 */
export function createVueAuthGuard(authChecker: () => boolean) {
  return function authGuard(to: any, from: any, next: any) {
    if (authChecker()) {
      next();
    } else {
      next('/login');
    }
  };
}

/**
 * Create route meta checker for Vue Router
 */
export function createRouteAuthChecker(getAuth: () => AuthClient) {
  return function checkRouteAuth(to: any) {
    if (to.meta?.requiresAuth) {
      const auth = getAuth();
      return auth.isAuthenticated();
    }
    return true;
  };
}
