/**
 * Next.js Middleware integration helpers
 * Provides authentication middleware for Next.js applications
 */

export interface MiddlewareConfig {
  loginUrl?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
  cookieNames?: {
    accessToken?: string;
    refreshToken?: string;
  };
}

/**
 * Create authentication middleware for Next.js
 */
export function createAuthMiddleware(config: MiddlewareConfig = {}) {
  const {
    loginUrl = '/login',
    publicPaths = ['/login', '/register', '/'],
    protectedPaths = [],
    cookieNames = {
      accessToken: 'accessToken',
      refreshToken: 'refreshToken',
    },
  } = config;

  return async function middleware(request: any) {
    // Import Next.js response dynamically
    const { NextResponse } = await require('next/server');

    const { pathname } = request.nextUrl;

    // Check if path should be protected
    const isProtected =
      protectedPaths.length > 0
        ? protectedPaths.some((path) => matchPath(path, pathname))
        : !publicPaths.some((path) => matchPath(path, pathname));

    if (!isProtected) {
      return NextResponse.next();
    }

    // Check for authentication tokens
    const accessToken = request.cookies.get(cookieNames.accessToken!)?.value;
    const refreshToken = request.cookies.get(cookieNames.refreshToken!)?.value;

    // No refresh token means not authenticated
    if (!refreshToken) {
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    // Check if refresh token is expired
    if (isTokenExpired(refreshToken)) {
      const response = NextResponse.redirect(new URL(loginUrl, request.url));
      response.cookies.delete(cookieNames.accessToken!);
      response.cookies.delete(cookieNames.refreshToken!);
      return response;
    }

    // Check if access token is valid
    if (!accessToken || isTokenExpired(accessToken)) {
      // Access token expired but refresh token is valid
      // Let the application handle token refresh
      return NextResponse.next();
    }

    return NextResponse.next();
  };
}

/**
 * Match path patterns supporting wildcards
 */
function matchPath(pattern: string, path: string): boolean {
  if (pattern === path) return true;

  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(path);
  }

  return false;
}

/**
 * Check if JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true;
  }
}

/**
 * Get authentication status from middleware request
 */
export function getAuthStatus(
  request: any,
  cookieNames = { accessToken: 'accessToken', refreshToken: 'refreshToken' }
) {
  const accessToken = request.cookies.get(cookieNames.accessToken)?.value;
  const refreshToken = request.cookies.get(cookieNames.refreshToken)?.value;

  return {
    hasTokens: Boolean(accessToken && refreshToken),
    accessTokenValid: accessToken ? !isTokenExpired(accessToken) : false,
    refreshTokenValid: refreshToken ? !isTokenExpired(refreshToken) : false,
  };
}
