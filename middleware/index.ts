import type { AuthClient } from '../core/auth-client';
import type { AuthFlowV2Client } from '../types/authflow-v2';

export type AuthFlowInstance = AuthClient | AuthFlowV2Client;

export interface MiddlewareConfig {
  redirectUrl?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
  skipValidation?: (path: string) => boolean;
  includeCallbackUrl?: boolean;
}

/**
 * Matches a path against a pattern (supports wildcards)
 */
function matchPath(pattern: string, path: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(path);
  }
  return pattern === path;
}

/**
 * Determines if a path should be protected based on configuration
 */
function shouldProtectPath(path: string, config: Partial<MiddlewareConfig>): boolean {
  if (config.publicPaths?.some((pattern) => matchPath(pattern, path))) {
    return false;
  }

  if (config.skipValidation?.(path)) {
    return false;
  }

  if (config.protectedPaths?.length) {
    return config.protectedPaths.some((pattern) => matchPath(pattern, path));
  }

  return true;
}

/**
 * Validates a JWT token and returns validation result
 */
function validateToken(token: string): { isValid: boolean; payload?: any } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { isValid: false };

    const payload = JSON.parse(atob(parts[1]));

    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { isValid: false, payload };
    }

    return { isValid: true, payload };
  } catch {
    return { isValid: false };
  }
}

/**
 * Gets token field names from auth flow configuration
 */
function getTokenNames(authFlow: AuthFlowInstance): { access: string; refresh: string } {
  const config = (authFlow as any).config;
  return {
    access: config?.tokens?.access || 'c_aToken',
    refresh: config?.tokens?.refresh || 'c_rToken',
  };
}

/**
 * Attempts to refresh tokens using the auth flow instance
 */
async function refreshTokensViaAuthFlow(
  authFlow: AuthFlowInstance,
  _refreshToken?: string
): Promise<{ accessToken?: string; error?: string }> {
  try {
    // Use the auth flow's internal refresh mechanism
    await (authFlow as any).performTokenRefresh();

    // Get the new access token from the auth flow
    const newAccessToken = await (authFlow as any)?.getAccessToken();

    if (newAccessToken) {
      return { accessToken: newAccessToken };
    } else {
      return { error: 'No access token after refresh' };
    }
  } catch (error: any) {
    return { error: error.message || 'Token refresh failed' };
  }
}

/**
 * Creates authentication middleware for Next.js
 *
 * Note: This function requires Next.js environment.
 * Token refresh in middleware is complex and may not work reliably.
 * For production apps, consider implementing token refresh in API routes or server components.
 * See: https://github.com/jmndao/auth-flow/blob/main/docs/middleware-setup.md
 */
export function createAuthMiddleware(authFlow: AuthFlowInstance, config: MiddlewareConfig = {}) {
  let NextResponse: any;

  try {
    const nextServer = require('next/server');
    NextResponse = nextServer.NextResponse;
  } catch {
    throw new Error(
      'createAuthMiddleware requires Next.js environment. Please install Next.js or use this function only in Next.js projects.'
    );
  }

  const tokenNames = getTokenNames(authFlow);

  return async function middleware(request: any) {
    const path = request.nextUrl.pathname;

    // Skip authentication for public paths
    if (!shouldProtectPath(path, config)) {
      return NextResponse.next();
    }

    // Get tokens from request cookies
    const accessToken = request.cookies.get(tokenNames.access)?.value;
    const refreshToken = request.cookies.get(tokenNames.refresh)?.value;

    // If no refresh token, redirect to login
    if (!refreshToken) {
      if (config.redirectUrl) {
        const url = new URL(config.redirectUrl, request.url);
        if (config.includeCallbackUrl) {
          url.searchParams.set('callbackUrl', path);
        }
        return NextResponse.redirect(url);
      }
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check refresh token validity
    const refreshValidation = validateToken(refreshToken);
    if (!refreshValidation.isValid) {
      const response = config.redirectUrl
        ? NextResponse.redirect(new URL(config.redirectUrl, request.url))
        : new NextResponse('Unauthorized', { status: 401 });

      response.cookies.delete(tokenNames.access);
      response.cookies.delete(tokenNames.refresh);
      return response;
    }

    // If we have a valid access token, continue
    if (accessToken) {
      const accessValidation = validateToken(accessToken);
      if (accessValidation.isValid) {
        return NextResponse.next();
      }
    }

    // Access token is missing or expired - attempt refresh
    const refreshResult = await refreshTokensViaAuthFlow(authFlow, refreshToken);

    if (refreshResult.error || !refreshResult.accessToken) {
      // Token refresh failed - redirect to login
      const response = config.redirectUrl
        ? NextResponse.redirect(new URL(config.redirectUrl, request.url))
        : new NextResponse('Unauthorized', { status: 401 });

      response.cookies.delete(tokenNames.access);
      response.cookies.delete(tokenNames.refresh);
      return response;
    }

    // Token refresh successful - set new access token and continue
    const response = NextResponse.next();

    response.cookies.set(tokenNames.access, refreshResult.accessToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });

    return response;
  };
}

/**
 * Creates server-side authentication checker for use in server components and API routes
 */
export async function createServerAuthChecker(authFlow: AuthFlowInstance) {
  return async function checkAuth(): Promise<{
    isAuthenticated: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      const hasValidTokens = await authFlow.hasValidTokens();

      if (hasValidTokens) {
        const tokens = await authFlow.getTokens();

        if (tokens?.accessToken) {
          try {
            const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
            return { isAuthenticated: true, user: payload };
          } catch {
            return { isAuthenticated: true };
          }
        }

        return { isAuthenticated: true };
      }

      return { isAuthenticated: false, error: 'No valid tokens' };
    } catch (error: any) {
      return { isAuthenticated: false, error: error.message || 'Auth check failed' };
    }
  };
}

/**
 * Creates wrapper for server actions with authentication
 * This enables token management in server action contexts where cookies can be modified
 */
export function createServerActionWrapper(authFlow: AuthFlowInstance) {
  return function withAuth<T extends any[], R>(action: (...args: T) => Promise<R>) {
    return async function wrappedAction(...args: T): Promise<R> {
      // Set up external cookie setters for the auth flow
      const cookieManager =
        (authFlow as any).cookieManager || (authFlow as any).tokenManager?.storageAdapter;

      if (cookieManager && cookieManager.options) {
        cookieManager.options.externalSetter = async (
          key: string,
          value: string,
          options: any = {}
        ) => {
          try {
            const nextHeaders = await require('next/headers');
            const cookieStore = await nextHeaders.cookies();
            cookieStore.set(key, value, {
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 7, // 7 days
              ...options,
            });
          } catch {
            // next/headers not available - ignore silently
          }
        };

        cookieManager.options.externalRemover = async (key: string) => {
          try {
            const nextHeaders = await require('next/headers');
            const cookieStore = await nextHeaders.cookies();
            cookieStore.delete(key);
          } catch {
            // next/headers not available - ignore silently
          }
        };
      }

      return action(...args);
    };
  };
}
