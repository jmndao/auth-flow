import type { AuthConfig, TokenPair } from '../../types';
import { AuthClient } from '../../core/auth-client';

/**
 * Next.js Server Actions integration helpers
 * Provides utilities for authentication in server actions
 */

/**
 * Create AuthFlow instance optimized for server actions
 */
export function createServerActionAuth(config: AuthConfig): AuthClient {
  return new AuthClient({
    ...config,
    storage: 'cookies',
  });
}

/**
 * Server action wrapper for authentication
 */
export function withServerAuth<T extends any[], R>(action: (...args: T) => Promise<R>) {
  return async function wrappedAction(...args: T): Promise<R> {
    try {
      return await action(...args);
    } catch (error) {
      console.error('Server action authentication error:', error);
      throw error;
    }
  };
}

/**
 * Extract and set cookies in server action context
 */
export async function setAuthCookies(tokens: TokenPair): Promise<void> {
  try {
    const { cookies } = await require('next/headers');
    const cookieStore = await cookies();

    const cookieOptions = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false, // Allow client-side access
    };

    cookieStore.set('accessToken', tokens.accessToken, cookieOptions);
    cookieStore.set('refreshToken', tokens.refreshToken, cookieOptions);
  } catch (error) {
    console.error('Error setting authentication cookies:', error);
    throw new Error('Failed to set authentication cookies in server action');
  }
}

/**
 * Clear authentication cookies in server action
 */
export async function clearAuthCookies(): Promise<void> {
  try {
    const { cookies } = await require('next/headers');
    const cookieStore = await cookies();

    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
  } catch {
    throw new Error('Failed to clear authentication cookies in server action');
  }
}

/**
 * Get tokens from cookies in server action
 */
export async function getAuthTokens(): Promise<TokenPair | null> {
  try {
    const { cookies } = await require('next/headers');
    const cookieStore = await cookies();

    const accessToken = cookieStore.get('accessToken')?.value;
    const refreshToken = cookieStore.get('refreshToken')?.value;

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated in server action
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getAuthTokens();

  if (!tokens) return false;

  try {
    const parts = tokens.accessToken.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

/**
 * Server action for login
 */
export async function loginAction(
  auth: AuthClient,
  credentials: any
): Promise<{ success: boolean; error?: string }> {
  try {
    await auth.login(credentials);
    const tokens = await auth.getTokens();

    if (tokens) {
      await setAuthCookies(tokens);
      return { success: true };
    }

    return { success: false, error: 'No tokens received' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

/**
 * Server action for logout
 */
export async function logoutAction(auth: AuthClient): Promise<void> {
  try {
    await auth.logout();
  } catch {
    // Continue with cookie clearing even if API logout fails
  } finally {
    await clearAuthCookies();
  }
}
