import type { AuthError } from '../types';

/**
 * Simplified error handler with clean error normalization and handling
 * Focuses on essential error processing without complex retry logic
 */
export class ErrorHandler {
  private onAuthError?: (error: AuthError) => void;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(
    onAuthError?: (error: AuthError) => void,
    retryAttempts: number = 3,
    retryDelay: number = 1000
  ) {
    this.onAuthError = onAuthError;
    this.retryAttempts = retryAttempts;
    this.retryDelay = retryDelay;
  }

  /**
   * Handle and normalize errors
   */
  handleError(error: any): AuthError {
    const authError = this.normalizeError(error);

    // Call error callback for authentication errors
    if (this.onAuthError && this.isAuthenticationError(authError)) {
      try {
        this.onAuthError(authError);
      } catch (callbackError) {
        console.error('Error in onAuthError callback:', callbackError);
      }
    }

    return authError;
  }

  /**
   * Normalize error to consistent AuthError format
   */
  private normalizeError(error: any): AuthError {
    // Handle axios-style errors
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || error.response.statusText || 'Request failed',
        code: error.response.data?.code || error.code,
        originalError: error,
      };
    }

    // Handle network errors
    if (error.request) {
      return {
        status: 0,
        message: 'Network error - unable to reach server',
        code: 'NETWORK_ERROR',
        originalError: error,
      };
    }

    // Handle other errors
    return {
      status: error.status || 500,
      message: error.message || 'Unknown error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      originalError: error,
    };
  }

  /**
   * Check if error is authentication related
   */
  isAuthenticationError(error: AuthError): boolean {
    return error.status === 401 || error.status === 403;
  }

  /**
   * Check if error indicates token expiration
   */
  isTokenExpiredError(error: AuthError): boolean {
    const tokenExpiredMessages = [
      'token expired',
      'token invalid',
      'access denied',
      'unauthorized',
      'jwt expired',
      'token malformed',
    ];

    const message = error.message.toLowerCase();
    return error.status === 401 && tokenExpiredMessages.some((msg) => message.includes(msg));
  }

  /**
   * Check if error is refresh token related
   */
  isRefreshTokenError(error: AuthError): boolean {
    const refreshTokenMessages = [
      'refresh token expired',
      'refresh token invalid',
      'invalid refresh token',
      'refresh token not found',
    ];

    const message = error.message.toLowerCase();
    return error.status === 401 && refreshTokenMessages.some((msg) => message.includes(msg));
  }

  /**
   * Check if error is network related
   */
  isNetworkError(error: AuthError): boolean {
    return error.status === 0 || error.code === 'NETWORK_ERROR';
  }

  /**
   * Execute operation with retry logic (simplified)
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.retryAttempts
  ): Promise<T> {
    let lastError: AuthError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.normalizeError(error);

        // Don't retry authentication errors
        if (this.isAuthenticationError(lastError)) {
          throw lastError;
        }

        // Don't retry client errors (4xx except auth errors)
        if (lastError.status >= 400 && lastError.status < 500) {
          throw lastError;
        }

        // Wait before retrying
        if (attempt < maxAttempts - 1) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Static error creation utilities
  static createAuthError(status: number, message: string, code?: string): AuthError {
    return {
      status,
      message,
      code,
      originalError: null,
    };
  }

  static createNetworkError(message: string = 'Network error'): AuthError {
    return {
      status: 0,
      message,
      code: 'NETWORK_ERROR',
      originalError: null,
    };
  }

  static createTokenExpiredError(): AuthError {
    return {
      status: 401,
      message: 'Access token has expired',
      code: 'TOKEN_EXPIRED',
      originalError: null,
    };
  }

  static createRefreshTokenExpiredError(): AuthError {
    return {
      status: 401,
      message: 'Refresh token has expired',
      code: 'REFRESH_TOKEN_EXPIRED',
      originalError: null,
    };
  }
}
