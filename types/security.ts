/**
 * Configuration for security features
 */
export interface SecurityConfig {
  /** Whether to encrypt tokens in storage */
  encryptTokens: boolean;
  /** Encryption key for token encryption */
  encryptionKey?: string;
  /** CSRF protection configuration */
  csrf: {
    /** Whether CSRF protection is enabled */
    enabled: boolean;
    /** Endpoint to fetch CSRF token from */
    tokenEndpoint?: string;
    /** Header name for CSRF token */
    headerName?: string;
    /** Cookie name for CSRF token */
    cookieName?: string;
  };
  /** Request signing configuration */
  requestSigning: {
    /** Whether request signing is enabled */
    enabled: boolean;
    /** Signing algorithm */
    algorithm?: 'HMAC-SHA256';
    /** Secret key for signing */
    secretKey?: string;
    /** Headers to include in signature */
    includeHeaders?: string[];
  };
}

/**
 * Result of token validation
 */
export interface TokenValidation {
  /** Whether the token is valid */
  isValid: boolean;
  /** Whether the token is expired */
  isExpired: boolean;
  /** Token expiration date */
  expiresAt?: Date;
  /** Decoded token payload */
  payload?: any;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Identifier for rate limiting (IP, user ID, etc.) */
  identifier: string;
}
