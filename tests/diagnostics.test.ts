import { ConfigValidator } from '../diagnostics/validator';
import { Troubleshooter } from '../diagnostics/troubleshooter';
import type { AuthConfig } from '../types';

describe('Diagnostics', () => {
  describe('ConfigValidator', () => {
    it('should validate correct configuration', () => {
      const config: AuthConfig = {
        baseURL: 'https://api.example.com',
        endpoints: {
          login: '/auth/login',
          refresh: '/auth/refresh',
        },
        tokens: {
          access: 'accessToken',
          refresh: 'refreshToken',
        },
        storage: 'auto',
        retry: {
          attempts: 3,
          delay: 1000,
        },
      };

      const issues = ConfigValidator.validate(config);
      expect(issues).toHaveLength(0);
    });

    it('should detect missing baseURL', () => {
      const config = {} as AuthConfig;
      const issues = ConfigValidator.validate(config);

      expect(issues).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_BASE_URL',
          severity: 'high',
        })
      );
    });

    it('should detect invalid storage type', () => {
      const config: AuthConfig = {
        baseURL: 'https://api.example.com',
        storage: 'invalid' as any,
      };

      const issues = ConfigValidator.validate(config);
      expect(issues).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_STORAGE_TYPE',
          severity: 'high',
        })
      );
    });

    it('should detect excessive retry attempts', () => {
      const config: AuthConfig = {
        baseURL: 'https://api.example.com',
        retry: {
          attempts: 15,
          delay: 1000,
        },
      };

      const issues = ConfigValidator.validate(config);
      expect(issues).toContainEqual(
        expect.objectContaining({
          code: 'EXCESSIVE_RETRY_ATTEMPTS',
          severity: 'medium',
        })
      );
    });
  });

  describe('Troubleshooter', () => {
    it('should detect environment correctly', () => {
      const environment = (Troubleshooter as any).detectEnvironment();
      expect(environment).toBe('browser-unknown'); // In Jest/jsdom environment
    });

    it('should generate optimal configuration', () => {
      const config = Troubleshooter.generateOptimalConfig('https://api.example.com');

      expect(config).toMatchObject({
        baseURL: 'https://api.example.com',
        storage: expect.any(String),
        timeout: 10000,
        retry: {
          attempts: 3,
          delay: 1000,
        },
      });
    });

    it('should provide fixes for common issues', async () => {
      const config: AuthConfig = {
        baseURL: '', // Invalid
        storage: 'invalid' as any,
      };

      const result = await Troubleshooter.diagnose(config);

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.fixes).toContain(expect.stringContaining('Add baseURL to config'));
    });
  });
});
