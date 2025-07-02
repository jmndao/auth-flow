# Configuration Guide

Complete configuration reference for AuthFlow authentication client.

## Table of Contents

- [Basic Configuration](#basic-configuration)
- [Storage Options](#storage-options)
- [Cookie Storage](#cookie-storage)
- [Token Configuration](#token-configuration)
- [Endpoints Configuration](#endpoints-configuration)
- [Retry Configuration](#retry-configuration)
- [Security Configuration](#security-configuration)
- [Caching Configuration](#caching-configuration)
- [Monitoring Configuration](#monitoring-configuration)
- [Circuit Breaker Configuration](#circuit-breaker-configuration)
- [Health Monitoring](#health-monitoring)
- [Environment-Specific Settings](#environment-specific-settings)
- [Framework Integration](#framework-integration)

## Basic Configuration

### Minimal Setup

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
});
```

### Complete Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  environment: 'auto', // 'client' | 'server' | 'auto'
  tokenSource: 'body', // 'body' | 'cookies'
  storage: 'auto', // 'localStorage' | 'cookies' | 'memory' | 'auto'
  timeout: 10000,

  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },

  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },

  retry: {
    attempts: 3,
    delay: 1000,
  },

  // Callback functions
  onTokenRefresh: (tokens) => console.log('Tokens refreshed'),
  onAuthError: (error) => console.error('Auth error:', error),
  onLogout: () => console.log('User logged out'),
});
```

## Storage Options

### Local Storage

```typescript
const auth = createAuthFlow({
  // ... other config
  storage: 'localStorage',
});
```

### Memory Storage

```typescript
const auth = createAuthFlow({
  // ... other config
  storage: 'memory',
});
```

### Auto Storage

```typescript
const auth = createAuthFlow({
  // ... other config
  storage: 'auto', // Automatically chooses best storage for environment
});
```

### Custom Storage Configuration

```typescript
const auth = createAuthFlow({
  // ... other config
  storage: {
    type: 'localStorage',
    options: {
      prefix: 'myapp_', // Optional prefix for storage keys
    },
  },
});
```

## Cookie Storage

### Basic Cookie Setup

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours in seconds
      domain: '.example.com',
    },
  },
  tokens: {
    access: 'authToken',
    refresh: 'refreshToken',
  },
  endpoints: {
    login: '/login',
    refresh: '/refresh',
  },
});
```

### Cookie Options

```typescript
interface CookieStorageOptions {
  secure?: boolean; // Use secure flag (HTTPS only)
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string; // Cookie path
  maxAge?: number; // Max age in seconds
  domain?: string; // Cookie domain
  httpOnly?: boolean; // HTTP only flag (server-side only)
  waitForCookies?: number; // Wait time for cookie propagation (ms)
  fallbackToBody?: boolean; // Fallback to response body if cookies fail
  retryCount?: number; // Number of retry attempts
  debugMode?: boolean; // Enable debug logging
}
```

### Next.js Cookie Configuration

```typescript
// Server action or API route
import { cookies } from 'next/headers';

const auth = createAuthFlow(config, {
  cookies: () => cookies(),
  cookieSetter: (name, value, options) => {
    cookies().set(name, value, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      ...options,
    });
  },
});
```

## Token Configuration

### Custom Token Names

```typescript
const auth = createAuthFlow({
  // ... other config
  tokens: {
    access: 'jwt_token',
    refresh: 'refresh_jwt',
  },
});
```

### Token Source

```typescript
// Extract tokens from response body (default)
const auth = createAuthFlow({
  // ... other config
  tokenSource: 'body',
});

// Extract tokens from cookies
const auth = createAuthFlow({
  // ... other config
  tokenSource: 'cookies',
});
```

## Endpoints Configuration

### Standard Endpoints

```typescript
const auth = createAuthFlow({
  // ... other config
  endpoints: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout', // Optional
  },
});
```

### Full URL Endpoints

```typescript
const auth = createAuthFlow({
  // ... other config
  endpoints: {
    login: 'https://auth.example.com/login',
    refresh: 'https://auth.example.com/refresh',
    logout: 'https://auth.example.com/logout',
  },
});
```

## Retry Configuration

### Basic Retry Setup

```typescript
const auth = createAuthFlow({
  // ... other config
  retry: {
    attempts: 3,
    delay: 1000, // 1 second
  },
});
```

### Advanced Retry (v2 only)

```typescript
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

const auth = createAuthFlowV2({
  // ... other config
  retry: {
    attempts: 5,
    delay: 1000,
    strategy: 'exponential-jitter', // 'fixed' | 'exponential' | 'exponential-jitter'
    maxDelay: 30000,
    jitterFactor: 0.1,
    conditions: ['network', '5xx', 'timeout', 'circuit-open'],
  },
});
```

## Security Configuration

### Token Encryption (v2)

```typescript
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

const auth = createAuthFlowV2({
  // ... other config
  security: {
    encryptTokens: true,
    encryptionKey: 'your-32-character-encryption-key',
  },
});
```

### CSRF Protection (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  security: {
    csrf: {
      enabled: true,
      tokenEndpoint: '/api/csrf-token',
      headerName: 'X-CSRF-Token',
      cookieName: 'csrf-token',
    },
  },
});
```

### Request Signing (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  security: {
    requestSigning: {
      enabled: true,
      algorithm: 'HMAC-SHA256',
      secretKey: 'your-signing-secret',
      includeHeaders: ['authorization', 'content-type'],
    },
  },
});
```

## Caching Configuration

### Basic Caching (v2)

```typescript
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

const auth = createAuthFlowV2({
  // ... other config
  caching: {
    enabled: true,
    defaultTTL: 300000, // 5 minutes
    maxSize: 100,
  },
});
```

### Advanced Caching with Strategies (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  caching: {
    enabled: true,
    defaultTTL: 300000,
    maxSize: 200,
    strategies: new Map([
      ['/api/users/*', { ttl: 600000 }], // 10 minutes
      ['/api/static/*', { ttl: 3600000 }], // 1 hour
      ['/api/realtime/*', { enabled: false }], // No caching
    ]),
  },
});
```

## Monitoring Configuration

### Performance Monitoring (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  monitoring: {
    enabled: true,
    sampleRate: 0.1, // 10% sampling
    maxSamples: 1000,
    aggregationInterval: 60000, // 1 minute
    slowThreshold: 3000, // 3 seconds
    onMetrics: (metrics) => {
      console.log('Performance metrics:', metrics);
    },
  },
});
```

### Analytics (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  analytics: {
    enabled: true,
    endpoint: '/api/analytics',
    sampleRate: 0.05, // 5% sampling
    customEvents: {
      userAgent: navigator.userAgent,
      version: '1.0.0',
    },
  },
});
```

## Circuit Breaker Configuration

### Basic Circuit Breaker (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  circuitBreaker: {
    threshold: 5, // Open after 5 failures
    resetTimeout: 60000, // Try to reset after 1 minute
    monitoringPeriod: 300000, // 5 minute monitoring window
    minimumRequests: 10, // Minimum requests before circuit can open
  },
});
```

## Health Monitoring

### Health Check Configuration (v2)

```typescript
const auth = createAuthFlowV2({
  // ... other config
  health: {
    enabled: true,
    endpoint: '/health',
    interval: 30000, // Check every 30 seconds
    timeout: 5000, // 5 second timeout
    onStatusChange: (isHealthy) => {
      console.log('API health status:', isHealthy);
    },
  },
});
```

## Environment-Specific Settings

### Development Configuration

```typescript
const auth = createAuthFlow({
  baseURL:
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://api.example.com',

  storage: {
    type: 'cookies',
    options: {
      secure: process.env.NODE_ENV === 'production',
      debugMode: process.env.NODE_ENV === 'development',
    },
  },

  timeout: process.env.NODE_ENV === 'development' ? 30000 : 10000,
});
```

### Production Configuration

```typescript
const auth = createAuthFlowV2({
  baseURL: process.env.API_BASE_URL,

  storage: {
    type: 'cookies',
    options: {
      secure: true,
      sameSite: 'strict',
      httpOnly: true,
    },
  },

  security: {
    encryptTokens: true,
    encryptionKey: process.env.ENCRYPTION_KEY,
    csrf: { enabled: true },
  },

  monitoring: {
    enabled: true,
    sampleRate: 0.01, // 1% sampling for production
  },

  circuitBreaker: {
    threshold: 5,
    resetTimeout: 60000,
  },
});
```

## Framework Integration

### Next.js App Router

```typescript
// app/lib/auth.ts
import { cookies } from 'next/headers';
import { createAuthFlow } from '@jmndao/auth-flow';

export async function getServerAuth() {
  const cookieStore = await cookies();

  return createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL!,
      tokenSource: 'cookies',
      storage: { type: 'cookies' },
      tokens: { access: 'accessToken', refresh: 'refreshToken' },
      endpoints: { login: '/login', refresh: '/refresh' },
    },
    {
      cookies: () => cookieStore,
      cookieSetter: (name, value, options) => {
        cookieStore.set(name, value, options);
      },
    }
  );
}
```

### Express.js

```typescript
// middleware/auth.js
const auth = createAuthFlow({
  baseURL: process.env.API_BASE_URL,
  tokenSource: 'cookies',
  storage: { type: 'memory' }, // Use memory in middleware
  tokens: { access: 'authToken', refresh: 'refreshToken' },
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
});

app.use((req, res, next) => {
  req.auth = createAuthFlow(config, { req, res });
  next();
});
```

### React Client

```typescript
// hooks/useAuth.ts
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

export function useAuth() {
  const auth = useMemo(
    () =>
      createAuthFlowV2({
        baseURL: process.env.REACT_APP_API_URL,
        caching: { enabled: true },
        monitoring: { enabled: true },
      }),
    []
  );

  return auth;
}
```

## Configuration Validation

AuthFlow automatically validates configuration and provides helpful error messages:

```typescript
// This will throw a configuration error
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  // Missing required endpoints and tokens
});
```

## Debugging Configuration

Enable debug mode to troubleshoot configuration issues:

```typescript
const auth = createAuthFlow({
  // ... your config
  storage: {
    type: 'cookies',
    options: {
      debugMode: true, // Enable detailed logging
    },
  },
});
```

For more examples and use cases, see the [Examples Guide](./examples.md).
