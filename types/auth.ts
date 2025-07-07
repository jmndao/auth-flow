/**
 * Authentication-related type definitions
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  [key: string]: any;
}

export interface AuthError {
  status: number;
  message: string;
  code?: string;
  originalError?: any;
}
