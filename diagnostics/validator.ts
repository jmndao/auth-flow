import type { AuthConfig, HealthIssue } from '../types';

/**
 * Configuration validation and setup checking
 * Validates AuthFlow configuration before runtime issues occur
 */
export class ConfigValidator {
  /**
   * Validate AuthFlow configuration
   */
  static validate(config: AuthConfig): HealthIssue[] {
    const issues: HealthIssue[] = [];

    issues.push(...this.validateBaseURL(config.baseURL));
    issues.push(...this.validateEndpoints(config.endpoints));
    issues.push(...this.validateTokens(config.tokens));
    issues.push(...this.validateStorage(config.storage));
    issues.push(...this.validateRetry(config.retry));

    return issues;
  }

  /**
   * Validate base URL configuration
   */
  private static validateBaseURL(baseURL: string): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (!baseURL) {
      issues.push({
        code: 'MISSING_BASE_URL',
        severity: 'high',
        description: 'baseURL is required',
        solution: 'Provide a valid API base URL',
      });
      return issues;
    }

    if (typeof baseURL !== 'string') {
      issues.push({
        code: 'INVALID_BASE_URL_TYPE',
        severity: 'high',
        description: 'baseURL must be a string',
        solution: 'Ensure baseURL is a valid string',
      });
      return issues;
    }

    if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
      issues.push({
        code: 'INVALID_BASE_URL_PROTOCOL',
        severity: 'medium',
        description: 'baseURL should include protocol (http:// or https://)',
        solution: 'Add http:// or https:// to your baseURL',
      });
    }

    if (baseURL.endsWith('/')) {
      issues.push({
        code: 'BASE_URL_TRAILING_SLASH',
        severity: 'low',
        description: 'baseURL should not end with a trailing slash',
        solution: 'Remove the trailing slash from baseURL',
      });
    }

    return issues;
  }

  /**
   * Validate endpoints configuration
   */
  private static validateEndpoints(endpoints?: AuthConfig['endpoints']): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (endpoints) {
      if (endpoints.login && typeof endpoints.login !== 'string') {
        issues.push({
          code: 'INVALID_LOGIN_ENDPOINT',
          severity: 'high',
          description: 'login endpoint must be a string',
          solution: 'Ensure endpoints.login is a valid string path',
        });
      }

      if (endpoints.refresh && typeof endpoints.refresh !== 'string') {
        issues.push({
          code: 'INVALID_REFRESH_ENDPOINT',
          severity: 'high',
          description: 'refresh endpoint must be a string',
          solution: 'Ensure endpoints.refresh is a valid string path',
        });
      }

      if (endpoints.logout && typeof endpoints.logout !== 'string') {
        issues.push({
          code: 'INVALID_LOGOUT_ENDPOINT',
          severity: 'medium',
          description: 'logout endpoint must be a string',
          solution: 'Ensure endpoints.logout is a valid string path',
        });
      }
    }

    return issues;
  }

  /**
   * Validate token configuration
   */
  private static validateTokens(tokens?: AuthConfig['tokens']): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (tokens) {
      if (tokens.access && typeof tokens.access !== 'string') {
        issues.push({
          code: 'INVALID_ACCESS_TOKEN_FIELD',
          severity: 'high',
          description: 'access token field name must be a string',
          solution: 'Ensure tokens.access is a valid string',
        });
      }

      if (tokens.refresh && typeof tokens.refresh !== 'string') {
        issues.push({
          code: 'INVALID_REFRESH_TOKEN_FIELD',
          severity: 'high',
          description: 'refresh token field name must be a string',
          solution: 'Ensure tokens.refresh is a valid string',
        });
      }
    }

    return issues;
  }

  /**
   * Validate storage configuration
   */
  private static validateStorage(storage?: AuthConfig['storage']): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (storage) {
      const validStorageTypes = ['auto', 'memory', 'browser', 'cookies'];
      if (!validStorageTypes.includes(storage)) {
        issues.push({
          code: 'INVALID_STORAGE_TYPE',
          severity: 'high',
          description: `Invalid storage type: ${storage}`,
          solution: `Use one of: ${validStorageTypes.join(', ')}`,
        });
      }
    }

    return issues;
  }

  /**
   * Validate retry configuration
   */
  private static validateRetry(retry?: AuthConfig['retry']): HealthIssue[] {
    const issues: HealthIssue[] = [];

    if (retry) {
      if (retry.attempts !== undefined) {
        if (typeof retry.attempts !== 'number' || retry.attempts < 0) {
          issues.push({
            code: 'INVALID_RETRY_ATTEMPTS',
            severity: 'medium',
            description: 'retry attempts must be a non-negative number',
            solution: 'Set retry.attempts to a number >= 0',
          });
        }

        if (retry.attempts > 10) {
          issues.push({
            code: 'EXCESSIVE_RETRY_ATTEMPTS',
            severity: 'medium',
            description: 'retry attempts should not exceed 10',
            solution: 'Consider reducing retry.attempts for better performance',
          });
        }
      }

      if (retry.delay !== undefined) {
        if (typeof retry.delay !== 'number' || retry.delay < 0) {
          issues.push({
            code: 'INVALID_RETRY_DELAY',
            severity: 'medium',
            description: 'retry delay must be a non-negative number',
            solution: 'Set retry.delay to a number >= 0',
          });
        }
      }
    }

    return issues;
  }
}
