# AuthFlow

Universal authentication client for JavaScript applications with production-ready features.

[![npm version](https://img.shields.io/npm/v/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![downloads](https://img.shields.io/npm/dm/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![license](https://img.shields.io/npm/l/@jmndao/auth-flow)](https://github.com/jmndao/auth-flow/blob/main/LICENSE)

## Features

- **Universal Compatibility** - Works in browsers, Node.js, React Native, and SSR environments
- **Framework Agnostic** - Integrates with Next.js, React, Vue, Express, and more
- **Multiple Storage Options** - localStorage, cookies, memory, or custom adapters
- **Token Management** - Automatic refresh, secure storage, and validation
- **Production Ready** - Caching, monitoring, retry logic, and circuit breakers
- **TypeScript First** - Complete type safety and intellisense
- **Zero Dependencies** - Lightweight core with optional enhancements

## Installation

```bash
npm install @jmndao/auth-flow
```

## Quick Start

### Basic Usage

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
});

// Login
const user = await auth.login({
  email: 'user@example.com',
  password: 'password',
});

// Make authenticated requests
const data = await auth.get('/api/profile');

// Check authentication
const isAuthenticated = auth.isAuthenticated();
```

### Cookie-Based Authentication

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      secure: true,
      sameSite: 'lax',
    },
  },
  tokens: { access: 'authToken', refresh: 'refreshToken' },
  endpoints: { login: '/login', refresh: '/refresh' },
});
```

### Next.js Server Actions

```typescript
import { cookies } from 'next/headers';
import { createAuthFlow } from '@jmndao/auth-flow';

export async function loginAction(credentials) {
  const cookieStore = await cookies();

  const auth = createAuthFlow(config, {
    cookies: () => cookieStore,
    cookieSetter: (name, value, options) => {
      cookieStore.set(name, value, options);
    },
  });

  return await auth.login(credentials);
}
```

## Advanced Features

### Enhanced Client (v2)

```typescript
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  caching: { enabled: true, defaultTTL: 300000 },
  monitoring: { enabled: true },
  circuitBreaker: { threshold: 5 },
  retry: { attempts: 3, strategy: 'exponential' },
});
```

### Middleware (Optional)

```typescript
import { createNextJSMiddleware } from '@jmndao/auth-flow/middleware';

export const middleware = createNextJSMiddleware({
  tokenName: 'accessToken',
  redirectUrl: '/login',
  publicPaths: ['/login', '/register'],
});
```

## HTTP Methods

```typescript
// All standard HTTP methods
const users = await auth.get('/api/users');
const newUser = await auth.post('/api/users', userData);
const updated = await auth.put('/api/users/1', updates);
const patched = await auth.patch('/api/users/1', { status: 'active' });
await auth.delete('/api/users/1');
```

## Token Management

```typescript
// Get current tokens
const tokens = await auth.getTokens();

// Set tokens manually
await auth.setTokens({
  accessToken: 'token',
  refreshToken: 'refresh',
});

// Clear tokens
await auth.clearTokens();

// Check authentication status
const isAuth = auth.isAuthenticated();
```

## Framework Integration

AuthFlow works seamlessly with popular frameworks:

- **Next.js** - App Router and Pages Router support
- **React** - Client and server components
- **Vue** - Composition and Options API
- **Express** - Middleware and route handlers
- **React Native** - AsyncStorage support

## Configuration

For detailed configuration options, see [Configuration Guide](./docs/configuration.md).

Common configurations:

- [Cookie Setup](./docs/configuration.md#cookie-storage)
- [Security Options](./docs/configuration.md#security)
- [Retry Logic](./docs/configuration.md#retry-configuration)
- [Caching Strategies](./docs/configuration.md#caching)

## Error Handling

```typescript
try {
  await auth.login(credentials);
} catch (error) {
  if (error.status === 401) {
    console.log('Invalid credentials');
  } else if (error.status === 0) {
    console.log('Network error');
  }
}
```

## TypeScript

Full TypeScript support with comprehensive type definitions:

```typescript
import type { AuthFlowConfig, TokenPair, LoginResponse } from '@jmndao/auth-flow';
```

## Environment Support

- **Browsers** - All modern browsers
- **Node.js** - Version 16 and above
- **React Native** - With AsyncStorage
- **Edge Runtime** - Vercel, Cloudflare Workers

## Documentation

- [Configuration Guide](./docs/configuration.md)
- [API Reference](./docs/api-reference.md)
- [Migration Guide](./docs/migration-guide.md)
- [Examples](./docs/examples.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/jmndao/auth-flow/issues)
- [Discussions](https://github.com/jmndao/auth-flow/discussions)
- [Documentation](https://github.com/jmndao/auth-flow/tree/main/docs)
