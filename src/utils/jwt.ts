import { UserClaims } from '../types';

/**
 * Secure JWT utility functions with proper validation and error handling
 */

/**
 * Base64URL decode with proper padding and validation
 */
function base64UrlDecode(str: string): string {
  if (!str || typeof str !== 'string') {
    throw new Error('Invalid base64url input');
  }

  // Replace base64url specific chars with base64 chars
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Pad with '=' to make length a multiple of 4
  while (base64.length % 4) {
    base64 += '=';
  }

  try {
    return atob(base64);
  } catch {
    throw new Error('Invalid base64url encoding');
  }
}

/**
 * Validate JWT structure without parsing payload
 */
function isValidJWTStructure(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Extract and validate JWT claims with proper error handling
 */
export function extractJWTClaims(token: string): UserClaims | null {
  try {
    if (!isValidJWTStructure(token)) {
      return null;
    }

    const parts = token.split('.');
    const payloadPart = parts[1];

    if (!payloadPart) {
      return null;
    }

    const decoded = base64UrlDecode(payloadPart);
    if (!decoded) {
      return null;
    }

    const payload = JSON.parse(decoded);

    // Basic validation that payload is an object
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    return payload;
  } catch {
    // Any parsing error means invalid token
    return null;
  }
}

/**
 * Check if JWT token is expired with proper validation
 */
export function isJWTExpired(token: string): boolean {
  try {
    const claims = extractJWTClaims(token);
    if (!claims) {
      return true; // Invalid token is considered expired
    }

    // If no expiration claim, assume not expired
    if (typeof claims.exp !== 'number') {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    return claims.exp < now;
  } catch {
    return true; // Any error means token is invalid/expired
  }
}

/**
 * Validate JWT token format and structure
 */
export function validateJWTToken(token: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token must be a non-empty string' };
  }

  if (!isValidJWTStructure(token)) {
    return { isValid: false, error: 'Invalid JWT structure - must have 3 parts separated by dots' };
  }

  try {
    const claims = extractJWTClaims(token);
    if (!claims) {
      return { isValid: false, error: 'Invalid JWT payload' };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `JWT parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
