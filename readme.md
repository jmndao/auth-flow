# AuthFlow v2.0

Universal authentication client with production-ready features: caching, monitoring, security, resilience, and more.

[![npm version](https://img.shields.io/npm/v/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![downloads](https://img.shields.io/npm/dm/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![license](https://img.shields.io/npm/l/@jmndao/auth-flow)](https://github.com/jmndao/auth-flow/blob/main/LICENSE)
[![build status](https://img.shields.io/github/actions/workflow/status/jmndao/auth-flow/ci.yml)](https://github.com/jmndao/auth-flow/actions)
[![coverage](https://img.shields.io/codecov/c/github/jmndao/auth-flow)](https://codecov.io/gh/jmndao/auth-flow)

## What's New in v2.0

AuthFlow v2.0 transforms the library from a basic authentication client into a comprehensive, production-ready solution with enterprise-grade features.

### Key Features

- **Zero Breaking Changes** - Full backward compatibility with v1.x
- **Request Caching** - Intelligent caching with LRU eviction and configurable strategies
- **Request Deduplication** - Automatic consolidation of identical concurrent requests
- **Performance Monitoring** - Real-time metrics with P95/P99 percentiles and aggregation
- **Circuit Breaker Pattern** - Prevents cascade failures with automatic recovery
- **Enhanced Security** - Token encryption, CSRF protection, request signing
- **Advanced Retry Logic** - Exponential backoff with jitter and conditional retry strategies
- **Health Monitoring** - Continuous API health checks with status change notifications
- **Production Presets** - One-line configurations for common scenarios

## Installation

```bash
npm install @jmndao/auth-flow
```

## Quick Start

### Basic Setup (v1.x Compatible)

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

// Login
const user = await auth.login({ email: 'user@example.com', password: 'password' });

// Make authenticated requests
const data = await auth.get('/api/profile');
```

### Production-Ready Setup (v2.0)

```typescript
import { createProductionAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createProductionAuthFlow('https://api.example.com');

// All v2.0 features enabled automatically
const user = await auth.login({ email: 'user@example.com', password: 'password' });
const data = await auth.get('/api/profile'); // Cached, monitored, resilient
```

## Configuration Presets

AuthFlow v2.0 includes predefined configurations for common scenarios:

```typescript
import { createAuthFlowWithPreset } from '@jmndao/auth-flow/v2';

// High-performance configuration with aggressive caching
const performantAuth = createAuthFlowWithPreset('performance', 'https://api.example.com');

// Security-focused configuration with all protections enabled
const secureAuth = createAuthFlowWithPreset('security', 'https://api.example.com');

// Resilient configuration for unreliable networks
const resilientAuth = createAuthFlowWithPreset('resilient', 'https://api.example.com');

// Development configuration with debugging enabled
const devAuth = createAuthFlowWithPreset('development', 'https://api.example.com');

// Production configuration with monitoring and security
const prodAuth = createAuthFlowWithPreset('production', 'https://api.example.com');

// Minimal configuration for simple use cases
const minimalAuth = createAuthFlowWithPreset('minimal', 'https://api.example.com');
```

## Custom Configuration

```typescript
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',

  // Caching configuration
  caching: {
    enabled: true,
    defaultTTL: 300000, // 5 minutes
    maxSize: 100,
    strategies: new Map([
      ['/api/users/*', { ttl: 600000 }], // 10 minutes for user data
      ['/api/static/*', { ttl: 3600000 }], // 1 hour for static data
    ]),
  },

  // Performance monitoring
  monitoring: {
    enabled: true,
    sampleRate: 0.1, // 10% sampling
    aggregationInterval: 60000, // 1 minute
  },

  // Security features
  security: {
    encryptTokens: true,
    encryptionKey: 'your-encryption-key',
    csrf: {
      enabled: true,
      tokenEndpoint: '/api/csrf-token',
    },
    requestSigning: {
      enabled: true,
      secretKey: 'your-signing-key',
    },
  },

  // Retry configuration
  retry: {
    attempts: 3,
    delay: 1000,
    strategy: 'exponential-jitter',
    conditions: ['network', '5xx', 'timeout'],
  },

  // Circuit breaker
  circuitBreaker: {
    threshold: 5,
    resetTimeout: 60000,
  },

  // Health monitoring
  health: {
    enabled: true,
    interval: 30000,
    endpoint: '/health',
  },
});
```

## API Reference

### Authentication Methods

```typescript
// Login with credentials
const user = await auth.login({ email: 'user@example.com', password: 'password' });

// Logout
await auth.logout();

// Check authentication status
const isAuth = auth.isAuthenticated();

// Token management
const tokens = await auth.getTokens();
await auth.setTokens({ accessToken: 'token', refreshToken: 'refresh' });
await auth.clearTokens();
```

### HTTP Methods

```typescript
// GET request
const data = await auth.get('/api/users');

// POST request
const newUser = await auth.post('/api/users', { name: 'John Doe' });

// PUT request
const updatedUser = await auth.put('/api/users/1', { name: 'Jane Doe' });

// PATCH request
const patchedUser = await auth.patch('/api/users/1', { status: 'active' });

// DELETE request
await auth.delete('/api/users/1');
```

### Performance Monitoring

```typescript
// Get performance metrics
const metrics = auth.getPerformanceMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  averageResponseTime: metrics.averageResponseTime,
  successRate: metrics.successRate,
  cacheHitRate: metrics.cacheHitRate,
});

// Clear metrics
auth.clearPerformanceMetrics();
```

### Cache Management

```typescript
// Get cache statistics
const cacheStats = auth.getCacheStats();

// Clear cache
auth.clearCache();

// Clear cache by pattern
auth.clearCache('/api/users/*');
```

### Health Monitoring

```typescript
// Get health status
const healthStatus = auth.getHealthStatus();

// Perform immediate health check
const health = await auth.checkHealth();
```

### Circuit Breaker

```typescript
// Get circuit breaker statistics
const cbStats = auth.getCircuitBreakerStats();

// Reset circuit breaker
auth.resetCircuitBreaker();
```

### Debug Information

```typescript
// Get comprehensive debug information
const debugInfo = auth.getDebugInfo();
console.log({
  config: debugInfo.config,
  authState: debugInfo.authState,
  performance: debugInfo.performance,
  health: debugInfo.health,
  features: debugInfo.features,
});
```

## Migration from v1.x

No code changes required! Your existing v1.x code works exactly the same:

```typescript
// v1.x code (still works)
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
});

// Upgrade to v2.x (gradual)
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  // Add v2.0 features
  caching: { enabled: true },
  monitoring: { enabled: true },
});
```

## Framework Integration

### Next.js

```typescript
// pages/api/auth/[...nextauth].ts
import { createAuthFlow } from '@jmndao/auth-flow';

export default function handler(req, res) {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_URL,
      tokenSource: 'cookies',
      storage: {
        type: 'cookies',
        options: {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        },
      },
    },
    { req, res }
  );

  // Handle authentication
}
```

### React

```typescript
// hooks/useAuth.ts
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [auth] = useState(() => createAuthFlowV2('https://api.example.com'));

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(auth.isAuthenticated());
  }, [auth]);

  return { auth, isAuthenticated };
}
```

### Vue

```typescript
// composables/useAuth.ts
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';
import { ref, onMounted } from 'vue';

export function useAuth() {
  const auth = createAuthFlowV2('https://api.example.com');
  const isAuthenticated = ref(false);

  onMounted(() => {
    isAuthenticated.value = auth.isAuthenticated();
  });

  return { auth, isAuthenticated };
}
```

## Environment Support

AuthFlow works in all JavaScript environments:

- **Browser** - localStorage, cookies, memory storage
- **Node.js** - Memory storage, file system
- **React Native** - AsyncStorage support
- **Server-Side Rendering** - Next.js, Nuxt.js compatible

## Error Handling

```typescript
try {
  const user = await auth.login(credentials);
} catch (error) {
  if (error.status === 401) {
    console.log('Invalid credentials');
  } else if (error.status === 0) {
    console.log('Network error');
  } else {
    console.log('Server error:', error.message);
  }
}
```

## TypeScript Support

AuthFlow is written in TypeScript and includes comprehensive type definitions:

```typescript
import type {
  AuthFlowV2Client,
  AuthFlowV2Config,
  TokenPair,
  LoginResponse,
} from '@jmndao/auth-flow/v2';

const auth: AuthFlowV2Client = createAuthFlowV2(config);
const tokens: TokenPair = await auth.getTokens();
```

## Testing

```typescript
import { mockAuthClient } from '@jmndao/auth-flow/testing';

// Create mock client for testing
const mockAuth = mockAuthClient({
  isAuthenticated: true,
  user: { id: 1, name: 'Test User' },
});

// Use in tests
expect(mockAuth.isAuthenticated()).toBe(true);

## Documentation

- **[Quick Start Guide](./docs/quick-start-guide.md)** - Get up and running in minutes
- **[API Reference](./docs/api-reference.md)** - Complete method documentation
- **[Migration Guide](./docs/migration-guide.md)** - Upgrade from v1.x to v2.x
- **[Examples & Use Cases](./docs/examples.md)** - Real-world code examples
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [Documentation](https://github.com/jmndao/auth-flow/tree/main/docs)
- [GitHub Issues](https://github.com/jmndao/auth-flow/issues)
- [Discussions](https://github.com/jmndao/auth-flow/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and breaking changes.
```
