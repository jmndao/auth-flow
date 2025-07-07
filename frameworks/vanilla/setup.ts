import type { AuthConfig, TokenPair } from '../../types';
import { AuthClient } from '../../core/auth-client';

/**
 * Vanilla JavaScript integration helpers
 * Provides utilities for framework-agnostic usage
 */

/**
 * Global authentication state manager
 */
class GlobalAuthManager {
  private auth: AuthClient | null = null;
  private readonly listeners: Array<(isAuthenticated: boolean) => void> = [];

  /**
   * Initialize authentication
   */
  init(config: AuthConfig): AuthClient {
    this.auth = new AuthClient({
      ...config,
      onTokenRefresh: (tokens: TokenPair) => {
        this.notifyListeners(true);
        config.onTokenRefresh?.(tokens);
      },
      onAuthError: (error) => {
        this.notifyListeners(false);
        config.onAuthError?.(error);
      },
      onLogout: () => {
        this.notifyListeners(false);
        config.onLogout?.();
      },
    });

    // Check initial auth status
    this.checkAuthStatus();

    return this.auth;
  }

  /**
   * Get authentication instance
   */
  getInstance(): AuthClient {
    if (!this.auth) {
      throw new Error('Authentication not initialized. Call GlobalAuth.init() first.');
    }
    return this.auth;
  }

  /**
   * Add authentication status listener
   */
  onAuthChange(callback: (isAuthenticated: boolean) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Check current authentication status
   */
  private async checkAuthStatus() {
    if (this.auth) {
      const isAuthenticated = this.auth.isAuthenticated();
      this.notifyListeners(isAuthenticated);
    }
  }

  /**
   * Notify all listeners of auth status change
   */
  private notifyListeners(isAuthenticated: boolean) {
    this.listeners.forEach((callback) => {
      try {
        callback(isAuthenticated);
      } catch (error) {
        console.error('Error in auth status listener:', error);
      }
    });
  }
}

/**
 * Global authentication manager instance
 */
export const GlobalAuth = new GlobalAuthManager();

/**
 * Initialize authentication for vanilla JavaScript
 */
export function initAuth(config: AuthConfig): AuthClient {
  return GlobalAuth.init(config);
}

/**
 * Get authentication instance
 */
export function getAuth(): AuthClient {
  return GlobalAuth.getInstance();
}

/**
 * Authentication utilities for DOM manipulation
 */
export class AuthUI {
  private auth: AuthClient;

  constructor(auth: AuthClient) {
    this.auth = auth;
  }

  /**
   * Set up login form handler
   */
  setupLoginForm(
    formSelector: string,
    options: {
      usernameField?: string;
      passwordField?: string;
      onSuccess?: () => void;
      onError?: (error: string) => void;
    } = {}
  ) {
    const form = document.querySelector(formSelector) as HTMLFormElement;
    if (!form) {
      throw new Error(`Login form not found: ${formSelector}`);
    }

    const { usernameField = 'username', passwordField = 'password', onSuccess, onError } = options;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const credentials = {
        [usernameField]: formData.get(usernameField),
        [passwordField]: formData.get(passwordField),
      };

      try {
        await this.auth.login(credentials);
        onSuccess?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        onError?.(message);
      }
    });
  }

  /**
   * Set up logout button handler
   */
  setupLogoutButton(
    buttonSelector: string,
    options: {
      onSuccess?: () => void;
      onError?: (error: string) => void;
    } = {}
  ) {
    const button = document.querySelector(buttonSelector) as HTMLButtonElement;
    if (!button) {
      throw new Error(`Logout button not found: ${buttonSelector}`);
    }

    const { onSuccess, onError } = options;

    button.addEventListener('click', async (event) => {
      event.preventDefault();

      try {
        await this.auth.logout();
        onSuccess?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Logout failed';
        onError?.(message);
      }
    });
  }

  /**
   * Show/hide elements based on authentication status
   */
  setupConditionalDisplay() {
    const isAuthenticated = this.auth.isAuthenticated();

    // Show elements for authenticated users
    const authElements = document.querySelectorAll('[data-auth="true"]');
    authElements.forEach((element) => {
      (element as HTMLElement).style.display = isAuthenticated ? 'block' : 'none';
    });

    // Show elements for unauthenticated users
    const noAuthElements = document.querySelectorAll('[data-auth="false"]');
    noAuthElements.forEach((element) => {
      (element as HTMLElement).style.display = isAuthenticated ? 'none' : 'block';
    });
  }

  /**
   * Set up automatic form authentication headers
   */
  setupFormAuth() {
    document.addEventListener('submit', async (event) => {
      const form = event.target as HTMLFormElement;
      if (!form.hasAttribute('data-auth-form')) return;

      event.preventDefault();

      const formData = new FormData(form);
      const data: Record<string, any> = {};

      formData.forEach((value, key) => {
        data[key] = value;
      });

      try {
        const method = form.method.toUpperCase();
        const url = form.action;

        let response;
        switch (method) {
          case 'POST':
            response = await this.auth.post(url, data);
            break;
          case 'PUT':
            response = await this.auth.put(url, data);
            break;
          case 'PATCH':
            response = await this.auth.patch(url, data);
            break;
          default:
            throw new Error(`Unsupported form method: ${method}`);
        }

        // Trigger custom event with response
        form.dispatchEvent(
          new CustomEvent('auth-form-success', {
            detail: response,
          })
        );
      } catch (error) {
        // Trigger custom event with error
        form.dispatchEvent(
          new CustomEvent('auth-form-error', {
            detail: error,
          })
        );
      }
    });
  }
}

/**
 * Create authentication UI helper
 */
export function createAuthUI(auth?: AuthClient): AuthUI {
  const authInstance = auth || getAuth();
  return new AuthUI(authInstance);
}

/**
 * Simple authentication status monitor
 */
export function monitorAuthStatus(callback: (isAuthenticated: boolean) => void): () => void {
  return GlobalAuth.onAuthChange(callback);
}
