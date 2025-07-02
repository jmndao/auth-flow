/**
 * Type definitions for AuthFlow middleware module
 */

export interface TokenValidationResult {
  isValid: boolean;
  token?: string;
  payload?: any;
  error?: string;
}

export interface MiddlewareConfig {
  tokenName: string;
  redirectUrl?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
  skipValidation?: (path: string) => boolean;
}

export interface AuthCheckResult {
  isAuthenticated: boolean;
  user?: any;
  error?: string;
}
