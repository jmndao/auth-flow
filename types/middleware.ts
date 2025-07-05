/**
 * Type definitions for AuthFlow middleware module
 */

import type { AuthClient } from '../core/auth-client';
import type { AuthFlowV2Client } from './authflow-v2';

export interface TokenValidationResult {
  isValid: boolean;
  token?: string;
  payload?: any;
  error?: string;
}

export interface TokenConfig {
  access: string;
  refresh: string;
}

export interface MiddlewareConfig {
  redirectUrl?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
  skipValidation?: (path: string) => boolean;
  includeCallbackUrl?: boolean;
}

export interface AuthCheckResult {
  isAuthenticated: boolean;
  user?: any;
  error?: string;
  newAccessToken?: string;
}

export type AuthFlowInstance = AuthClient | AuthFlowV2Client;

export type MiddlewareAuthConfig = AuthFlowInstance | { tokenNames: TokenConfig };
