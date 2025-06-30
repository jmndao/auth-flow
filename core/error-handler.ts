import type { AuthError } from '../types';

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

  handleError(error: any): AuthError {
    const authError = this.normalizeError(error);

    // Call the error callback if provided
    if (this.onAuthError && this.isAuthenticationError(authError)) {
      try {
        this.onAuthError(authError);
      } catch (callbackError) {
        console.error('Error in onAuthError callback:', callbackError);
      }
    }

    return authError;
  }

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

    // Handle request errors (network issues, etc.)
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

  isAuthenticationError(error: AuthError): boolean {
    return error.status === 401 || error.status === 403;
  }

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

  isNetworkError(error: AuthError): boolean {
    return error.status === 0 || error.code === 'NETWORK_ERROR';
  }

  shouldRetry(error: AuthError, attemptCount: number = 0): boolean {
    // Don't retry authentication errors (401, 403)
    if (this.isAuthenticationError(error)) {
      return false;
    }

    // Don't retry client errors (4xx except 401/403)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }

    // Retry network errors and server errors (5xx) up to the limit
    if (this.isNetworkError(error) || error.status >= 500) {
      return attemptCount < this.retryAttempts;
    }

    return false;
  }

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

        // Don't retry if it's not a retryable error
        if (!this.shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Static utility methods for common error scenarios
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
