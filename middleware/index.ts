/**
 * Optional middleware utilities for AuthFlow
 *
 * This module provides lightweight authentication middleware
 * for various frameworks (Next.js, Express, etc.)
 */

import { AuthCheckResult, MiddlewareConfig, TokenValidationResult } from '../types/middleware';
export type { TokenValidationResult, MiddlewareConfig, AuthCheckResult } from '../types/middleware';

/**
 * Lightweight JWT token validation for middleware
 */
export function validateJWTToken(token: string): TokenValidationResult {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { isValid: false, error: 'Invalid token format' };
    }

    const payload = JSON.parse(atob(parts[1]));

    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { isValid: false, error: 'Token expired', payload };
    }

    return { isValid: true, token, payload };
  } catch {
    return { isValid: false, error: 'Invalid token payload' };
  }
}

/**
 * Extract token from request (framework agnostic)
 */
export function extractTokenFromRequest(request: any, tokenName: string): string | null {
  // Next.js style
  if (request.cookies?.get) {
    return request.cookies.get(tokenName)?.value || null;
  }

  // Express style
  if (request.cookies && typeof request.cookies === 'object') {
    return request.cookies[tokenName] || null;
  }

  // Manual cookie header parsing
  const cookieHeader = request.headers?.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === tokenName) {
        return decodeURIComponent(value);
      }
    }
  }

  return null;
}

/**
 * Check if path should be protected
 */
export function shouldProtectPath(path: string, config: Partial<MiddlewareConfig>): boolean {
  if (config.skipValidation?.(path)) {
    return false;
  }

  if (config.publicPaths?.some((pattern) => matchPath(pattern, path))) {
    return false;
  }

  if (config.protectedPaths?.length) {
    return config.protectedPaths.some((pattern) => matchPath(pattern, path));
  }

  return true;
}

/**
 * Simple path matching with wildcards
 */
function matchPath(pattern: string, path: string): boolean {
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(path);
  }
  return pattern === path;
}

/**
 * Next.js specific middleware helper
 */
export function createNextJSMiddleware(config: MiddlewareConfig) {
  return function middleware(request: any) {
    const path = request.nextUrl.pathname;

    if (!shouldProtectPath(path, config)) {
      return;
    }

    const token = extractTokenFromRequest(request, config.tokenName);

    if (!token) {
      if (config.redirectUrl) {
        return Response.redirect(new URL(config.redirectUrl, request.url));
      }
      return new Response('Unauthorized', { status: 401 });
    }

    const validation = validateJWTToken(token);

    if (!validation.isValid) {
      if (config.redirectUrl) {
        return Response.redirect(new URL(config.redirectUrl, request.url));
      }
      return new Response('Unauthorized', { status: 401 });
    }

    return;
  };
}

/**
 * Express specific middleware helper
 */
export function createExpressMiddleware(config: MiddlewareConfig) {
  return function middleware(req: any, res: any, next: () => void) {
    const path = req.path;

    if (!shouldProtectPath(path, config)) {
      return next();
    }

    const token = extractTokenFromRequest(req, config.tokenName);

    if (!token) {
      if (config.redirectUrl) {
        return res.redirect(config.redirectUrl);
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = validateJWTToken(token);

    if (!validation.isValid) {
      if (config.redirectUrl) {
        return res.redirect(config.redirectUrl);
      }
      return res.status(401).json({ error: 'Unauthorized', reason: validation.error });
    }

    req.user = validation.payload;
    next();
  };
}

/**
 * Server component authentication check
 */
export async function checkServerAuth(
  cookieStore: any,
  tokenName: string
): Promise<AuthCheckResult> {
  try {
    const token = cookieStore.get?.(tokenName)?.value || cookieStore[tokenName];

    if (!token) {
      return { isAuthenticated: false, error: 'No token found' };
    }

    const validation = validateJWTToken(token);

    if (!validation.isValid) {
      return { isAuthenticated: false, error: validation.error };
    }

    return { isAuthenticated: true, user: validation.payload };
  } catch {
    return { isAuthenticated: false, error: 'Authentication check failed' };
  }
}
