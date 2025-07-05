# AuthFlow

Universal authentication client for JavaScript applications with production-ready features.

[![npm version](https://img.shields.io/npm/v/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![downloads](https://img.shields.io/npm/dm/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![license](https://img.shields.io/npm/l/@jmndao/auth-flow)](https://github.com/jmndao/auth-flow/blob/main/LICENSE)

## Features

- **Framework Agnostic** - Works with Next.js, React, Vue, Express, and more
- **Multiple Storage Options** - localStorage, cookies, memory, or custom adapters
- **Automatic Token Refresh** - Handles expired tokens seamlessly
- **Production Ready** - Caching, monitoring, retry logic, and circuit breakers
- **TypeScript First** - Complete type safety and intellisense
- **Zero Dependencies** - Lightweight core with optional features# AuthFlow

Universal authentication client for JavaScript applications with production-ready features.

[![npm version](https://img.shields.io/npm/v/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![downloads](https://img.shields.io/npm/dm/@jmndao/auth-flow)](https://www.npmjs.com/package/@jmndao/auth-flow)
[![license](https://img.shields.io/npm/l/@jmndao/auth-flow)](https://github.com/jmndao/auth-flow/blob/main/LICENSE)

## Features

- **Framework Agnostic** - Works with Next.js, React, Vue, Express, and more
- **Multiple Storage Options** - localStorage, cookies, memory, or custom adapters
- **Automatic Token Refresh** - Handles expired tokens seamlessly
- **Production Ready** - Caching, monitoring, retry logic, and circuit breakers
- **TypeScript First** - Complete type safety and intellisense
- **Zero Dependencies** - Lightweight core with optional features

## Installation

```bash
npm install @jmndao/auth-flow
```

## Quick Start

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

// Login
const user = await auth.login({
  email: 'user@example.com',
  password: 'password',
});

// Make authenticated requests
const data = await auth.get('/api/profile');

// Check authentication
const isAuth = auth.isAuthenticated();
```

## Cookie-Based Authentication

```typescript
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

## Next.js Server Components

```typescript
import { cookies } from 'next/headers';
import { createAuthFlow } from '@jmndao/auth-flow';

export async function getProfile() {
  const cookieStore = await cookies();

  const auth = createAuthFlow(config, {
    cookies: () => cookieStore,
    cookieSetter: (name, value, options) => {
      cookieStore.set(name, value, options);
    },
  });

  return await auth.get('/api/profile');
}
```

## Enhanced Client (v2)

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

## HTTP Methods

```typescript
// All HTTP methods supported
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

## Framework Compatibility

AuthFlow works with all major JavaScript frameworks:

- **✅ Next.js** - App Router and Pages Router support
- **✅ React** - Client and server components
- **✅ Vue/Nuxt** - Composition and Options API
- **✅ Express** - Middleware and route handlers
- **✅ SvelteKit** - Server and client-side
- **✅ Vanilla JS** - Browser and Node.js environments

## Configuration Presets

```typescript
import {
  createProductionAuthFlow,
  createPerformantAuthFlow,
  createSecureAuthFlow,
  createResilientAuthFlow,
} from '@jmndao/auth-flow/v2';

// Production-ready with monitoring
const prodAuth = createProductionAuthFlow('https://api.example.com');

// High-performance with caching
const fastAuth = createPerformantAuthFlow('https://api.example.com');

// Security-focused with encryption
const secureAuth = createSecureAuthFlow('https://api.example.com', 'encryption-key', 'signing-key');

// Resilient for unreliable networks
const resilientAuth = createResilientAuthFlow('https://api.example.com');
```

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

## Documentation

- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Examples](./docs/examples.md) - Real-world usage examples
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
- [Middleware Setup](./docs/middleware-setup.md) - Next.js middleware configuration

## Environment Support

- **Browsers** - All modern browsers
- **Node.js** - Version 16 and above
- **React Native** - With AsyncStorage
- **Edge Runtime** - Vercel, Cloudflare Workers

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) file for details.
