import type {
  AuthFlowV2Config,
  AuthFlowV2Client,
  AuthFlowPresets,
  CreateAuthFlowV2,
} from './types/authflow-v2';
import type { AuthContext } from './types/config';
import { AuthFlowV2ClientImpl } from './core/authflow-v2-client';
import { ContextDetector } from './core/context-detector';

// Re-export v1.x functionality selectively to avoid conflicts
export { createAuthFlow, createSingleTokenAuth } from './index';
export type { TokenPair, AuthError, LoginCredentials, LoginResponse } from './index';

// Export v2.0 types
export type {
  AuthFlowV2Config,
  AuthFlowV2Client,
  V2RequestConfig,
  AuthFlowPresets,
  DebugInfo,
  AnalyticsEvent,
} from './types/authflow-v2';

export type { CacheConfig, CacheStats } from './types/cache';
export type { PerformanceConfig, AggregatedMetrics } from './types/performance';
export type { SecurityConfig, TokenValidation } from './types/security';
export type { V2RetryConfig as RetryConfigV2 } from './types/authflow-v2';
export type { CircuitBreakerConfig, HealthConfig } from './types/resilience';

/**
 * Creates a new AuthFlow v2.0 client instance with automatic context detection
 */
export const createAuthFlowV2: CreateAuthFlowV2 = (
  config: string | Partial<AuthFlowV2Config>,
  context?: AuthContext
): AuthFlowV2Client => {
  // Handle string configuration (simple base URL)
  const baseConfig: AuthFlowV2Config =
    typeof config === 'string'
      ? {
          baseURL: config,
          endpoints: {
            login: '/auth/login',
            refresh: '/auth/refresh',
            logout: '/auth/logout',
          },
          tokens: {
            access: 'accessToken',
            refresh: 'refreshToken',
          },
        }
      : {
          endpoints: {
            login: '/auth/login',
            refresh: '/auth/refresh',
            logout: '/auth/logout',
          },
          tokens: {
            access: 'accessToken',
            refresh: 'refreshToken',
          },
          ...config,
        };

  // Use provided context or auto-detect
  const finalContext = context || ContextDetector.getAutoContext();

  return new AuthFlowV2ClientImpl(baseConfig, finalContext);
};

/**
 * Predefined configuration presets for common scenarios
 */
export const authFlowPresets: AuthFlowPresets = {
  /**
   * High-performance configuration with aggressive caching
   */
  performance: {
    caching: {
      enabled: true,
      defaultTTL: 600000, // 10 minutes
      maxSize: 200,
      strategies: new Map([
        ['/user/profile', { ttl: 1800000 }], // 30 minutes
        ['/settings/*', { ttl: 3600000 }], // 1 hour
        ['/static/*', { ttl: 86400000 }], // 24 hours
      ]),
    },
    monitoring: {
      enabled: true,
      sampleRate: 0.1, // 10% sampling for high traffic
      aggregationInterval: 30000, // 30 seconds
    },
    retry: {
      attempts: 2,
      delay: 500,
      strategy: 'fixed',
    },
  },

  /**
   * Security-focused configuration with all protections enabled
   */
  security: {
    security: {
      encryptTokens: true,
      csrf: {
        enabled: true,
        tokenEndpoint: '/api/csrf-token',
        headerName: 'X-CSRF-Token',
      },
      requestSigning: {
        enabled: true,
        algorithm: 'HMAC-SHA256',
      },
    },
    caching: {
      enabled: false, // Disable caching for security
    },
    monitoring: {
      enabled: true,
      sampleRate: 1.0, // Full monitoring for security
    },
  },

  /**
   * Resilient configuration for unreliable networks
   */
  resilient: {
    retry: {
      attempts: 5,
      delay: 2000,
      strategy: 'exponential-jitter',
      conditions: ['network', '5xx', 'timeout', 'circuit-open'],
      maxDelay: 30000,
    },
    circuitBreaker: {
      threshold: 3,
      resetTimeout: 30000,
      minimumRequests: 5,
    },
    health: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
    },
    timeout: 15000,
  },

  /**
   * Development configuration with debugging enabled
   */
  development: {
    caching: {
      enabled: true,
      defaultTTL: 60000, // 1 minute for quick testing
    },
    monitoring: {
      enabled: true,
      sampleRate: 1.0,
      aggregationInterval: 10000, // 10 seconds for quick feedback
    },
    health: {
      enabled: true,
      interval: 15000,
    },
    analytics: {
      enabled: true,
      sampleRate: 1.0,
    },
  },

  /**
   * Production configuration with monitoring and security
   */
  production: {
    caching: {
      enabled: true,
      defaultTTL: 300000, // 5 minutes
      maxSize: 500,
    },
    monitoring: {
      enabled: true,
      sampleRate: 0.05, // 5% sampling
      aggregationInterval: 60000,
    },
    security: {
      encryptTokens: false, // Disable by default, require explicit key
      csrf: {
        enabled: true,
      },
    },
    health: {
      enabled: true,
      interval: 60000,
    },
    circuitBreaker: {
      threshold: 5,
      resetTimeout: 60000,
    },
    analytics: {
      enabled: true,
      sampleRate: 0.1,
    },
  },

  /**
   * Minimal configuration for simple use cases
   */
  minimal: {
    caching: {
      enabled: false,
    },
    monitoring: {
      enabled: false,
    },
    security: {
      encryptTokens: false,
      csrf: { enabled: false },
      requestSigning: { enabled: false },
    },
    health: {
      enabled: false,
    },
    analytics: {
      enabled: false,
    },
  },
};

/**
 * Quick preset application function
 */
export function createAuthFlowWithPreset(
  preset: keyof AuthFlowPresets,
  baseURL: string,
  overrides: Partial<AuthFlowV2Config> = {}
): AuthFlowV2Client {
  const presetConfig = authFlowPresets[preset];
  const config: AuthFlowV2Config = {
    baseURL,
    endpoints: {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
    },
    tokens: {
      access: 'accessToken',
      refresh: 'refreshToken',
    },
    ...presetConfig,
    ...overrides,
  };

  return createAuthFlowV2(config);
}

/**
 * Helper functions for common scenarios
 */

/**
 * Creates a high-performance AuthFlow instance
 */
export function createPerformantAuthFlow(baseURL: string): AuthFlowV2Client {
  return createAuthFlowWithPreset('performance', baseURL);
}

/**
 * Creates a security-focused AuthFlow instance
 */
export function createSecureAuthFlow(
  baseURL: string,
  encryptionKey: string,
  signingKey: string
): AuthFlowV2Client {
  return createAuthFlowWithPreset('security', baseURL, {
    security: {
      encryptionKey,
      requestSigning: {
        enabled: true,
        secretKey: signingKey,
      },
    },
  });
}

/**
 * Creates a resilient AuthFlow instance for unreliable networks
 */
export function createResilientAuthFlow(baseURL: string): AuthFlowV2Client {
  return createAuthFlowWithPreset('resilient', baseURL);
}

/**
 * Creates a development-friendly AuthFlow instance
 */
export function createDevAuthFlow(baseURL: string): AuthFlowV2Client {
  return createAuthFlowWithPreset('development', baseURL);
}

/**
 * Creates a production-ready AuthFlow instance
 */
export function createProductionAuthFlow(
  baseURL: string,
  config?: Partial<AuthFlowV2Config>
): AuthFlowV2Client {
  return createAuthFlowWithPreset('production', baseURL, config);
}

/**
 * Environment detection and diagnostic utilities
 */
export function diagnoseAuthFlowEnvironment() {
  const envInfo = ContextDetector.getEnvironmentInfo();
  const autoContext = ContextDetector.getAutoContext();

  return {
    environment: envInfo,
    detectedContext: {
      hasCookies: !!autoContext.cookies,
      hasHeaders: !!autoContext.headers,
      hasCookieSetter: !!autoContext.cookieSetter,
      hasReq: !!autoContext.req,
      hasRes: !!autoContext.res,
    },
    recommendations: {
      tokenSource: envInfo.isServer ? 'cookies' : 'body',
      storage: envInfo.isNextJS ? 'cookies' : envInfo.isServer ? 'memory' : 'localStorage',
    },
    compatibility: {
      nextJS: envInfo.isNextJS,
      serverSide: envInfo.isServer,
      clientSide: !envInfo.isServer,
      cookiesAvailable: !!autoContext.cookies || typeof document !== 'undefined',
      localStorageAvailable: typeof localStorage !== 'undefined',
    },
  };
}

/**
 * Smart configuration generator based on detected environment
 */
export function generateSmartConfig(
  baseURL: string,
  overrides: Partial<AuthFlowV2Config> = {}
): AuthFlowV2Config {
  const diagnosis = diagnoseAuthFlowEnvironment();

  const smartConfig: AuthFlowV2Config = {
    baseURL,
    endpoints: {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
    },
    tokens: {
      access: 'accessToken',
      refresh: 'refreshToken',
    },
    // Smart defaults based on environment
    tokenSource: diagnosis.recommendations.tokenSource as 'body' | 'cookies',
    storage: {
      type: diagnosis.recommendations.storage as any,
      options: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        httpOnly: false,
        waitForCookies: 1000,
        fallbackToBody: true,
        retryCount: 3,
      },
    },
    caching: {
      enabled: true,
      defaultTTL: 300000,
    },
    monitoring: {
      enabled: true,
      sampleRate: diagnosis.environment.nodeEnv === 'production' ? 0.1 : 1.0,
    },
    ...overrides,
  };

  return smartConfig;
}

/**
 * Tests all AuthFlow v2.0 features with a given configuration
 */
export async function testAuthFlowFeatures(
  config: AuthFlowV2Config,
  testCredentials?: any
): Promise<{
  features: Record<string, boolean>;
  performance: any;
  health: any;
  errors: string[];
}> {
  const client = createAuthFlowV2(config);
  const errors: string[] = [];

  try {
    // Test authentication if credentials provided
    if (testCredentials) {
      try {
        await client.login(testCredentials);
      } catch (error) {
        errors.push(`Login test failed: ${error}`);
      }
    }

    // Test health check
    let healthStatus;
    try {
      healthStatus = await client.checkHealth();
    } catch (error) {
      errors.push(`Health check failed: ${error}`);
      healthStatus = { isHealthy: false };
    }

    // Test cache
    try {
      await client.get('/test-endpoint');
      await client.get('/test-endpoint'); // Should hit cache
    } catch (error) {
      errors.push(`Cache test failed: ${error}`);
    }

    // Get performance metrics
    const performance = client.getPerformanceMetrics();

    // Get feature status
    const debugInfo = client.getDebugInfo();

    // Cleanup
    client.destroy();

    return {
      features: debugInfo.features,
      performance,
      health: healthStatus,
      errors,
    };
  } catch (error) {
    errors.push(`General test failure: ${error}`);
    return {
      features: {},
      performance: {},
      health: {},
      errors,
    };
  }
}

/**
 * Migration helper from v1.x to v2.0
 */
export function migrateV1ConfigToV2(v1Config: any): AuthFlowV2Config {
  return {
    ...v1Config,
    // Add default endpoints and tokens if missing
    endpoints: v1Config.endpoints || {
      login: '/auth/login',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
    },
    tokens: v1Config.tokens || {
      access: 'accessToken',
      refresh: 'refreshToken',
    },
    // Enable basic v2.0 features
    caching: {
      enabled: true,
      defaultTTL: 300000,
    },
    monitoring: {
      enabled: true,
    },
    // Keep existing retry config but enhance it
    retry: {
      attempts: v1Config.retry?.attempts || 3,
      delay: v1Config.retry?.delay || 1000,
      strategy: 'exponential',
      conditions: ['network', '5xx', 'timeout'],
    },
  };
}

// Default export for convenience
export default {
  createAuthFlowV2,
  createAuthFlowWithPreset,
  createPerformantAuthFlow,
  createSecureAuthFlow,
  createResilientAuthFlow,
  createDevAuthFlow,
  createProductionAuthFlow,
  authFlowPresets,
  testAuthFlowFeatures,
  migrateV1ConfigToV2,
  diagnoseAuthFlowEnvironment,
  generateSmartConfig,
};
