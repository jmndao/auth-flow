import type { AuthConfig, TokenPair, LoginCredentials } from '../../types';
import type { AuthClient } from '../../core/auth-client';

/**
 * React hooks and context for AuthFlow integration
 * Provides React-specific authentication utilities
 *
 * Note: This file provides types and utilities for React integration.
 * React should be installed as a peer dependency in your project.
 */

/**
 * Authentication context type
 */
export interface AuthContextType {
  auth: AuthClient;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

/**
 * Authentication provider props
 */
export interface AuthProviderProps {
  config: AuthConfig;
  children: any; // React.ReactNode
  onAuthError?: (error: any) => void;
  onTokenRefresh?: (tokens: TokenPair) => void;
}

/**
 * Login hook return type
 */
export interface UseLoginReturn {
  login: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Logout hook return type
 */
export interface UseLogoutReturn {
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Auth status hook return type
 */
export interface UseAuthStatusReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
}

/**
 * Authenticated request hook return type
 */
export interface UseAuthenticatedRequestReturn {
  get: (url: string, config?: any) => Promise<any>;
  post: (url: string, data?: any, config?: any) => Promise<any>;
  put: (url: string, data?: any, config?: any) => Promise<any>;
  patch: (url: string, data?: any, config?: any) => Promise<any>;
  delete: (url: string, config?: any) => Promise<any>;
}

/**
 * Authentication context symbol for injection
 */
export const AUTH_CONTEXT_KEY = Symbol('AuthFlow');

/**
 * Example implementation for user's React application:
 *
 * ```typescript
 * import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
 * import { AuthClient } from '@jmndao/auth-flow';
 * import type {
 *   AuthContextType,
 *   AuthProviderProps,
 *   UseLoginReturn,
 *   UseLogoutReturn,
 *   UseAuthStatusReturn,
 *   UseAuthenticatedRequestReturn
 * } from '@jmndao/auth-flow/frameworks/react';
 *
 * const AuthContext = createContext<AuthContextType | null>(null);
 *
 * export function AuthProvider({ config, children, onAuthError, onTokenRefresh }: AuthProviderProps) {
 *   const [auth] = useState(() => new AuthClient({
 *     ...config,
 *     onAuthError,
 *     onTokenRefresh,
 *   }));
 *
 *   const [isAuthenticated, setIsAuthenticated] = useState(false);
 *   const [isLoading, setIsLoading] = useState(true);
 *   const [user, setUser] = useState(null);
 *
 *   useEffect(() => {
 *     const checkAuth = async () => {
 *       try {
 *         const tokens = await auth.getTokens();
 *         setIsAuthenticated(Boolean(tokens));
 *       } catch {
 *         setIsAuthenticated(false);
 *       } finally {
 *         setIsLoading(false);
 *       }
 *     };
 *     checkAuth();
 *   }, [auth]);
 *
 *   const login = useCallback(async (credentials: LoginCredentials) => {
 *     setIsLoading(true);
 *     try {
 *       const userData = await auth.login(credentials);
 *       setUser(userData);
 *       setIsAuthenticated(true);
 *     } catch (error) {
 *       setIsAuthenticated(false);
 *       throw error;
 *     } finally {
 *       setIsLoading(false);
 *     }
 *   }, [auth]);
 *
 *   const logout = useCallback(async () => {
 *     setIsLoading(true);
 *     try {
 *       await auth.logout();
 *       setUser(null);
 *       setIsAuthenticated(false);
 *     } finally {
 *       setIsLoading(false);
 *     }
 *   }, [auth]);
 *
 *   const refreshTokens = useCallback(async () => {
 *     try {
 *       const tokens = await auth.getTokens();
 *       setIsAuthenticated(Boolean(tokens));
 *     } catch {
 *       setIsAuthenticated(false);
 *       setUser(null);
 *     }
 *   }, [auth]);
 *
 *   const value: AuthContextType = {
 *     auth, isAuthenticated, isLoading, user, login, logout, refreshTokens,
 *   };
 *
 *   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
 * }
 *
 * export function useAuth(): AuthContextType {
 *   const context = useContext(AuthContext);
 *   if (!context) {
 *     throw new Error('useAuth must be used within an AuthProvider');
 *   }
 *   return context;
 * }
 *
 * export function useAuthStatus(): UseAuthStatusReturn {
 *   const { isAuthenticated, isLoading, user } = useAuth();
 *   return { isAuthenticated, isLoading, user };
 * }
 *
 * export function useLogin(): UseLoginReturn {
 *   const { login, isLoading } = useAuth();
 *   const [error, setError] = useState<string | null>(null);
 *
 *   const handleLogin = useCallback(async (credentials: LoginCredentials) => {
 *     setError(null);
 *     try {
 *       await login(credentials);
 *     } catch (err) {
 *       setError(err instanceof Error ? err.message : 'Login failed');
 *       throw err;
 *     }
 *   }, [login]);
 *
 *   return { login: handleLogin, isLoading, error };
 * }
 *
 * export function useLogout(): UseLogoutReturn {
 *   const { logout, isLoading } = useAuth();
 *   const [error, setError] = useState<string | null>(null);
 *
 *   const handleLogout = useCallback(async () => {
 *     setError(null);
 *     try {
 *       await logout();
 *     } catch (err) {
 *       setError(err instanceof Error ? err.message : 'Logout failed');
 *       throw err;
 *     }
 *   }, [logout]);
 *
 *   return { logout: handleLogout, isLoading, error };
 * }
 *
 * export function useAuthenticatedRequest(): UseAuthenticatedRequestReturn {
 *   const { auth } = useAuth();
 *
 *   const get = useCallback((url: string, config?: any) => auth.get(url, config), [auth]);
 *   const post = useCallback((url: string, data?: any, config?: any) => auth.post(url, data, config), [auth]);
 *   const put = useCallback((url: string, data?: any, config?: any) => auth.put(url, data, config), [auth]);
 *   const patch = useCallback((url: string, data?: any, config?: any) => auth.patch(url, data, config), [auth]);
 *   const del = useCallback((url: string, config?: any) => auth.delete(url, config), [auth]);
 *
 *   return { get, post, put, patch, delete: del };
 * }
 * ```
 */

/**
 * Utility functions that don't require React imports
 */
export function createReactAuthGuard(authChecker: () => boolean) {
  return function AuthGuard({ children, fallback }: { children: any; fallback: any }) {
    return authChecker() ? children : fallback;
  };
}

/**
 * Higher-order component factory for authentication
 */
export function createWithAuth(getAuth: () => AuthClient) {
  return function withAuth<P extends object>(Component: any) {
    return function AuthenticatedComponent(props: P) {
      const auth = getAuth();
      if (!auth.isAuthenticated()) {
        return null; // or redirect component
      }
      return Component(props);
    };
  };
}
