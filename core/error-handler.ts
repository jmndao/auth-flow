import type { AuthError } from '../types';

/**
 * Handles authentication errors with retry logic and error normalization
 * Provides utilities for error categorization and recovery strategies
 */
export class ErrorHandler {
  private readonly onAuthError?: (error: AuthError) => void;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

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
   * Handles and normalizes errors, calling error callback for auth errors
   */
  handleError(error: any): AuthError {
    const authError = this.normalizeError(error);

    // Call error callback for auth errors
    if (this.onAuthError && this.isAuthenticationError(authError)) {
      try {
        this.onAuthError(authError);
      } catch {
        // Error in callback should not break the flow - ignore silently
      }
    }

    return authError;
  }

  /**
   * Normalizes various error types into consistent AuthError format
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
   * Checks if error is an authentication error (401/403)
   */
  isAuthenticationError(error: AuthError): boolean {
    return error.status === 401 || error.status === 403;
  }

  /**
   * Checks if error indicates token expiration
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
   * Checks if error indicates refresh token problems
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
   * Checks if error is a network connectivity issue
   */
  isNetworkError(error: AuthError): boolean {
    return error.status === 0 || error.code === 'NETWORK_ERROR';
  }

  /**
   * Determines if an error should be retried
   */
  shouldRetry(error: AuthError): boolean {
    // Don't retry auth errors
    if (this.isAuthenticationError(error)) {
      return false;
    }

    // Don't retry client errors (4xx except 401/403)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }

    return false;
  }

  /**
   * Executes operation with retry logic
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

        // Don't retry if not retryable
        if (!this.shouldRetry(lastError)) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    // If exhausted all retries, throw last error
    throw lastError!;
  }

  /**
   * Utility method to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Static utility methods for creating specific error types
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
