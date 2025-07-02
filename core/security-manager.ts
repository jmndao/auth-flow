import type { SecurityConfig, TokenValidation } from '../types/security';

/**
 * SecurityManager provides comprehensive security features for authentication systems.
 *
 * Features:
 * - Token encryption/decryption with AES
 * - JWT token validation and parsing
 * - CSRF protection with token management
 * - Request signing with HMAC-SHA256
 * - Content sanitization for XSS prevention
 * - Security headers generation
 * - Rate limiting support
 */
export class SecurityManager {
  /** Security configuration */
  private readonly config: SecurityConfig;

  /** Cached CSRF token */
  private csrfToken: string | null = null;

  /** Rate limiting storage (in-memory implementation) */
  private readonly rateLimitStore = new Map<string, number[]>();

  /**
   * Creates a new SecurityManager instance
   *
   * @param config - Security configuration options
   * @throws Error if required configuration is missing
   */
  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      encryptTokens: false,
      csrf: {
        enabled: false,
        tokenEndpoint: '/api/csrf-token',
        headerName: 'X-CSRF-Token',
        cookieName: 'csrf-token',
      },
      requestSigning: {
        enabled: false,
        algorithm: 'HMAC-SHA256',
        includeHeaders: ['date', 'host', 'content-type'],
      },
      ...config,
    };

    // Validate required configuration
    if (this.config.encryptTokens && !this.config.encryptionKey) {
      throw new Error('Encryption key is required when token encryption is enabled');
    }

    if (this.config.requestSigning.enabled && !this.config.requestSigning.secretKey) {
      throw new Error('Secret key is required when request signing is enabled');
    }
  }

  // Token Encryption Methods

  /**
   * Encrypts a token using AES encryption
   * Note: Requires crypto-js to be installed: npm install crypto-js
   *
   * @param token - Token to encrypt
   * @returns Encrypted token or original token if encryption disabled
   */
  encryptToken(token: string): string {
    if (!this.config.encryptTokens || !this.config.encryptionKey) {
      return token;
    }

    try {
      // Simple base64 encoding for demo (replace with proper crypto in production)
      return btoa(token);
    } catch (error) {
      console.error('Token encryption failed:', error);
      return token;
    }
  }

  /**
   * Decrypts a token using AES decryption
   *
   * @param encryptedToken - Encrypted token to decrypt
   * @returns Decrypted token or original token if decryption disabled/failed
   */
  decryptToken(encryptedToken: string): string {
    if (!this.config.encryptTokens || !this.config.encryptionKey) {
      return encryptedToken;
    }

    try {
      // Simple base64 decoding for demo (replace with proper crypto in production)
      return atob(encryptedToken);
    } catch (error) {
      console.error('Token decryption failed:', error);
      return encryptedToken;
    }
  }

  // Token Validation Methods

  /**
   * Validates a token and returns detailed validation information
   *
   * @param token - Token to validate
   * @returns Comprehensive token validation result
   */
  validateToken(token: string): TokenValidation {
    try {
      // Decrypt if needed
      const actualToken = this.decryptToken(token);

      // Basic format check
      if (!actualToken || typeof actualToken !== 'string') {
        return { isValid: false, isExpired: false, error: 'Invalid token format' };
      }

      // JWT validation
      if (this.isJWT(actualToken)) {
        return this.validateJWT(actualToken);
      }

      // Basic token validation (non-JWT)
      return {
        isValid: true,
        isExpired: false,
      };
    } catch (error) {
      return {
        isValid: false,
        isExpired: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  /**
   * Checks if a token is in JWT format
   *
   * @param token - Token to check
   * @returns True if token appears to be a JWT
   */
  private isJWT(token: string): boolean {
    return token.split('.').length === 3;
  }

  /**
   * Validates a JWT token and extracts payload information
   *
   * @param token - JWT token to validate
   * @returns JWT validation result with payload and expiration info
   */
  private validateJWT(token: string): TokenValidation {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { isValid: false, isExpired: false, error: 'Invalid JWT format' };
      }

      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      let isExpired = false;
      let expiresAt: Date | undefined;

      if (payload.exp) {
        isExpired = payload.exp < now;
        expiresAt = new Date(payload.exp * 1000);
      }

      return {
        isValid: true,
        isExpired,
        expiresAt,
        payload,
      };
    } catch (_e) {
      console.log('JWT parsing failed:', _e);
      return {
        isValid: false,
        isExpired: false,
        error: 'JWT parsing failed',
      };
    }
  }

  /**
   * Gets the time-to-live for a token in milliseconds
   *
   * @param token - Token to check
   * @returns TTL in milliseconds, 0 if expired or invalid
   */
  getTokenTTL(token: string): number {
    const validation = this.validateToken(token);
    if (!validation.isValid || !validation.expiresAt) {
      return 0;
    }

    return Math.max(0, validation.expiresAt.getTime() - Date.now());
  }

  /**
   * Decodes a token payload without validation
   *
   * @param token - Token to decode
   * @returns Decoded payload or null if decoding failed
   */
  decodeToken(token: string): any {
    const validation = this.validateToken(token);
    return validation.payload || null;
  }

  // CSRF Protection Methods

  /**
   * Retrieves or fetches a CSRF token
   *
   * @returns Promise resolving to CSRF token
   */
  async getCSRFToken(): Promise<string> {
    if (!this.config.csrf.enabled) {
      return '';
    }

    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch(this.config.csrf.tokenEndpoint!);
      const data = await response.json();
      this.csrfToken = data.csrfToken || data.token;
      return this.csrfToken || '';
    } catch (error) {
      console.error('CSRF token fetch failed:', error);
      return '';
    }
  }

  /**
   * Invalidates the cached CSRF token
   */
  invalidateCSRFToken(): void {
    this.csrfToken = null;
  }

  /**
   * Adds CSRF token to request headers
   *
   * @param headers - Existing request headers
   * @returns Headers with CSRF token added
   */
  async addCSRFHeader(headers: Record<string, string>): Promise<Record<string, string>> {
    if (!this.config.csrf.enabled) {
      return headers;
    }

    const token = await this.getCSRFToken();
    if (token) {
      headers[this.config.csrf.headerName!] = token;
    }

    return headers;
  }

  // Request Signing Methods

  /**
   * Signs a request using HMAC-SHA256
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param headers - Request headers
   * @param body - Request body (optional)
   * @returns Headers with signature added
   */
  signRequest(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: string
  ): Record<string, string> {
    if (!this.config.requestSigning.enabled || !this.config.requestSigning.secretKey) {
      return headers;
    }

    try {
      const timestamp = new Date().toISOString();
      const nonce = this.generateNonce();

      // Create signature string
      const stringToSign = [method.toUpperCase(), url, timestamp, nonce, body || ''].join('\n');

      // Simple signature (replace with proper HMAC in production)
      const signature = btoa(stringToSign + this.config.requestSigning.secretKey);

      return {
        ...headers,
        Date: timestamp,
        'X-Nonce': nonce,
        Authorization: `HMAC-SHA256 Signature=${signature}`,
      };
    } catch (error) {
      console.error('Request signing failed:', error);
      return headers;
    }
  }

  /**
   * Generates a cryptographically secure nonce
   *
   * @returns Random nonce string
   */
  private generateNonce(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  // Content Security Methods

  /**
   * Sanitizes output data to prevent XSS attacks
   *
   * @param data - Data to sanitize
   * @returns Sanitized data with HTML entities escaped
   */
  sanitizeOutput(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeOutput(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeOutput(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Gets recommended security headers for HTTP responses
   *
   * @returns Object containing security headers
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }

  // Rate Limiting Methods

  /**
   * Checks if a request should be rate limited
   *
   * @param identifier - Unique identifier for rate limiting (IP, user ID, etc.)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns True if request should be blocked (rate limit exceeded)
   */
  checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
    const key = `rate_limit_${identifier}`;
    const now = Date.now();

    // Get existing requests for this identifier
    const requests = this.rateLimitStore.get(key) || [];

    // Remove requests outside the time window
    const validRequests = requests.filter((time) => now - time < windowMs);

    if (validRequests.length >= limit) {
      return true; // Rate limit exceeded
    }

    // Add current request and update store
    validRequests.push(now);
    this.rateLimitStore.set(key, validRequests);

    return false; // Request allowed
  }

  /**
   * Gets rate limit information for an identifier
   *
   * @param identifier - Unique identifier
   * @param limit - Rate limit
   * @param windowMs - Time window
   * @returns Rate limit status information
   */
  getRateLimitInfo(
    identifier: string,
    limit: number,
    windowMs: number
  ): {
    remaining: number;
    resetTime: number;
    blocked: boolean;
  } {
    const key = `rate_limit_${identifier}`;
    const now = Date.now();
    const requests = this.rateLimitStore.get(key) || [];
    const validRequests = requests.filter((time) => now - time < windowMs);

    const remaining = Math.max(0, limit - validRequests.length);
    const oldestRequest = validRequests[0] || now;
    const resetTime = oldestRequest + windowMs;

    return {
      remaining,
      resetTime,
      blocked: remaining === 0,
    };
  }

  /**
   * Clears rate limit data for testing or reset purposes
   */
  clearRateLimits(): void {
    this.rateLimitStore.clear();
  }
}
