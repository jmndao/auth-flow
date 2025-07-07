# AuthFlow

Universal authentication client with automatic token refresh and framework integrations.

## Features

- Automatic token refresh with queue management
- Universal storage (localStorage, cookies, memory)
- Framework integrations (React, Vue, Next.js)
- Built-in diagnostics and troubleshooting
- Works in browser, server, and mobile environments
- TypeScript first with full type safety

## Quick Start

```bash
npm install @jmndao/auth-flow@3.0.0
```

### Basic Usage

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

// Login
await auth.login({ email: 'user@example.com', password: 'password' });

// Make authenticated requests
const profile = await auth.get('/user/profile');
const posts = await auth.get('/posts');

// Logout
await auth.logout();
```

### Configuration

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'cookies', // 'localStorage', 'cookies', 'memory', 'auto'
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  onTokenRefresh: (tokens) => console.log('Tokens refreshed'),
  onAuthError: (error) => console.error('Auth error:', error),
});
```

## Framework Integrations

### Next.js

```typescript
// Server Actions
import { createServerActionAuth, loginAction } from '@jmndao/auth-flow/frameworks/nextjs';

const auth = createServerActionAuth({ baseURL: 'https://api.example.com' });

export async function login(formData: FormData) {
  'use server';
  const credentials = {
    email: formData.get('email'),
    password: formData.get('password'),
  };
  return loginAction(auth, credentials);
}
```

```typescript
// Middleware
import { createAuthMiddleware } from '@jmndao/auth-flow/frameworks/nextjs';

export default createAuthMiddleware({
  publicPaths: ['/login', '/register'],
  loginUrl: '/login',
});
```

### React

```typescript
// Copy the implementation from the library documentation
import { AuthProvider, useAuth } from './auth'; // Your implementation

function App() {
  return (
    <AuthProvider config={{ baseURL: 'https://api.example.com' }}>
      <Dashboard />
    </AuthProvider>
  );
}

function Dashboard() {
  const { isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return <div>Welcome! <button onClick={logout}>Logout</button></div>;
}
```

### Vue 3

```typescript
// Copy the implementation from the library documentation
import { createAuth } from './auth'; // Your implementation

const { provide } = createAuth({ baseURL: 'https://api.example.com' });
provide(); // In your main component
```

## Presets

Quick configurations for common scenarios:

```typescript
import {
  createSimpleAuth, // localStorage
  createServerAuth, // cookies for SSR
  createNextJSAuth, // Next.js optimized
  createDevAuth, // development with logging
  createProductionAuth, // production optimized
} from '@jmndao/auth-flow/presets';

const auth = createNextJSAuth('https://api.example.com');
```

## Diagnostics

Built-in troubleshooting tools:

```typescript
import { diagnose } from '@jmndao/auth-flow/diagnostics';

const report = await diagnose({ baseURL: 'https://api.example.com' });
console.log(report.issues);
console.log(report.fixes);
```

## Error Handling

AuthFlow handles common authentication errors automatically:

- **401 Unauthorized**: Automatically attempts token refresh
- **Token Expiration**: Refreshes tokens before they expire
- **Network Errors**: Retries requests with exponential backoff
- **Storage Failures**: Falls back to alternative storage methods

## TypeScript Support

Full TypeScript support with type inference:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

const user = await auth.login<User, LoginCredentials>(credentials);
const profile = await auth.get<User>('/user/profile');
```

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+
- Node.js 16+

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- Documentation: https://github.com/jmndao/auth-flow/wiki
- Issues: https://github.com/jmndao/auth-flow/issues
- Discussions: https://github.com/jmndao/auth-flow/discussions
