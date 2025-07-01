# AuthFlow

A universal authentication client for modern JavaScript applications with seamless token management, automatic refresh, and cookie timing issue resolution.

## Features

- **Universal Compatibility**: Works in browser, Node.js, and SSR environments
- **Cookie Timing Fix**: Solves cookie propagation delays with retry logic and fallbacks
- **Single Token Support**: Works with APIs that only provide access tokens
- **Automatic Token Refresh**: Handles expiration and refresh automatically
- **Request Queuing**: Prevents race conditions during token refresh
- **Smart Storage**: Auto-selects optimal storage (localStorage, cookies, memory)
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install @jmndao/auth-flow
```

## Quick Start

### Minimal Setup

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

// Login
const user = await auth.login({
  username: 'user@example.com',
  password: 'password',
});

// Make authenticated requests
const data = await auth.get('/protected-resource');
```

### Cookie-Based Auth (Fixes Cookie Timing Issues)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      waitForCookies: 500, // Wait for cookie propagation
      fallbackToBody: true, // Use response body as fallback
      retryCount: 3, // Retry cookie reads
      debugMode: false, // Enable for troubleshooting
    },
  },
});
```

### Single Token Auth (No Refresh Token)

```typescript
import { createSingleTokenAuth } from '@jmndao/auth-flow';

const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'accessToken' },
  endpoints: { login: 'auth/login' },
  sessionManagement: {
    renewBeforeExpiry: 300, // Renew 5 min before expiry
    persistCredentials: true, // Auto-renew using stored credentials
  },
});
```

## Configuration

### Default Settings

AuthFlow provides smart defaults requiring minimal configuration:

```typescript
// Default endpoints
{
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout'
}

// Default token names
{
  access: 'accessToken',
  refresh: 'refreshToken'
}

// Other defaults
{
  tokenSource: 'body',
  storage: 'auto',
  timeout: 10000,
  retry: { attempts: 3, delay: 1000 }
}
```

### Common Configurations

```typescript
// Basic setup with custom endpoints
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  endpoints: {
    login: '/auth/signin',
    refresh: '/auth/refresh-token',
  },
  tokens: {
    access: 'access_token',
    refresh: 'refresh_token',
  },
});

// Server-side with cookies
const auth = createAuthFlow(
  {
    baseURL: 'https://api.example.com',
    tokenSource: 'cookies',
    storage: 'cookies',
    environment: 'server',
  },
  { req, res }
);
```

## Framework Examples

### React

```typescript
const auth = createAuthFlow('https://api.example.com');

function useAuth() {
  const [user, setUser] = useState(null);

  const login = async (credentials) => {
    const userData = await auth.login(credentials);
    setUser(userData);
  };

  return { user, login };
}
```

### Next.js Server-Side

```typescript
// API route
export default async function handler(req, res) {
  const auth = createAuthFlow('https://api.example.com', { req, res });

  if (!(await auth.hasValidTokens())) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const data = await auth.get('/protected-data');
  res.json(data.data);
}
```

### Express Middleware

```typescript
const authMiddleware = async (req, res, next) => {
  const auth = createAuthFlow(
    {
      baseURL: 'https://api.example.com',
      storage: 'cookies',
    },
    { req, res }
  );

  if (await auth.hasValidTokens()) {
    req.auth = auth;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

## API Reference

### Authentication Methods

- `login<TUser>(credentials): Promise<TUser>` - Authenticate and store tokens
- `logout(): Promise<void>` - Clear tokens and logout
- `isAuthenticated(): boolean` - Check if authenticated (sync)
- `hasValidTokens(): Promise<boolean>` - Validate tokens (async)

### HTTP Methods

- `get<T>(url, config?): Promise<Response<T>>`
- `post<T>(url, data?, config?): Promise<Response<T>>`
- `put<T>(url, data?, config?): Promise<Response<T>>`
- `patch<T>(url, data?, config?): Promise<Response<T>>`
- `delete<T>(url, config?): Promise<Response<T>>`

### Token Management

- `getTokens(): Promise<TokenPair | null>` - Get stored tokens
- `setTokens(tokens): Promise<void>` - Store token pair
- `clearTokens(): Promise<void>` - Remove all tokens

## Browser Support

- Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- Node.js 16+

## Documentation

- [Complete API Reference](docs/api-reference.md)
- [Configuration Guide](docs/configuration.md)
- [Framework Examples](docs/examples.md)
- [Advanced Usage](docs/advanced.md)

## License

MIT License
