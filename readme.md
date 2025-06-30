# AuthFlow

A universal authentication client for modern JavaScript applications that provides seamless token management, automatic refresh, and request queuing across different environments.

## Features

- **Universal Compatibility**: Works in browser, Node.js, and server-side rendering environments
- **Automatic Token Refresh**: Handles token expiration and refresh automatically
- **Request Queuing**: Queues requests during token refresh to prevent race conditions
- **Multiple Storage Adapters**: localStorage, cookies, and memory storage options
- **TypeScript Support**: Full TypeScript definitions included
- **Retry Logic**: Configurable retry mechanism for failed requests
- **Error Handling**: Comprehensive error handling with customizable callbacks

## Installation

```bash
npm install @jmndao/auth-flow
```

## Quick Start

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const authClient = createAuthFlow({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
  storage: 'localStorage',
});

// Login
const user = await authClient.login({
  username: 'user@example.com',
  password: 'password',
});

// Make authenticated requests
const data = await authClient.get('/protected-resource');

// Logout
await authClient.logout();
```

## Configuration

### Basic Configuration

```typescript
interface AuthFlowConfig {
  endpoints: {
    login: string;
    refresh: string;
    logout?: string;
  };
  tokens: {
    access: string;
    refresh: string;
  };
  baseURL?: string;
  timeout?: number;
  storage?: StorageType | StorageConfig;
  tokenSource?: 'body' | 'cookies';
  environment?: 'client' | 'server' | 'auto';
  retry?: {
    attempts?: number;
    delay?: number;
  };
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

### Storage Options

- **localStorage**: Browser localStorage (client-side only)
- **cookies**: HTTP cookies (works in both client and server)
- **memory**: In-memory storage (temporary, lost on page refresh)
- **auto**: Automatically selects best option based on environment

### Server-Side Usage

```typescript
// Next.js API route example
import { createAuthFlow } from '@jmndao/auth-flow';

export default async function handler(req, res) {
  const authClient = createAuthFlow(
    {
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'accessToken',
        refresh: 'refreshToken',
      },
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  const data = await authClient.get('/protected-data');
  res.json(data);
}
```

## API Reference

### Authentication Methods

- `login<TUser>(credentials): Promise<TUser>` - Authenticate user and store tokens
- `logout(): Promise<void>` - Clear tokens and optionally call logout endpoint
- `isAuthenticated(): boolean` - Synchronous check for token presence
- `hasValidTokens(): Promise<boolean>` - Asynchronous token validation

### HTTP Methods

- `get<T>(url, config?): Promise<LoginResponse<T>>`
- `post<T>(url, data?, config?): Promise<LoginResponse<T>>`
- `put<T>(url, data?, config?): Promise<LoginResponse<T>>`
- `patch<T>(url, data?, config?): Promise<LoginResponse<T>>`
- `delete<T>(url, config?): Promise<LoginResponse<T>>`
- `head<T>(url, config?): Promise<LoginResponse<T>>`
- `options<T>(url, config?): Promise<LoginResponse<T>>`

### Token Management

- `getTokens(): Promise<TokenPair | null>` - Retrieve stored tokens
- `setTokens(tokens): Promise<void>` - Store token pair
- `clearTokens(): Promise<void>` - Remove all stored tokens

## Error Handling

AuthFlow provides comprehensive error handling with normalized error objects:

```typescript
interface AuthError {
  status: number;
  message: string;
  code?: string;
  originalError?: any;
}
```

Custom error handling:

```typescript
const authClient = createAuthFlow({
  // ... config
  onAuthError: (error) => {
    if (error.status === 401) {
      // Handle unauthorized access
      redirectToLogin();
    }
  },
});
```

## Advanced Usage

### Custom Storage Adapter

```typescript
import { StorageAdapter } from '@jmndao/auth-flow';

class CustomStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    // Custom get implementation
  }

  async set(key: string, value: string): Promise<void> {
    // Custom set implementation
  }

  async remove(key: string): Promise<void> {
    // Custom remove implementation
  }

  async clear(): Promise<void> {
    // Custom clear implementation
  }
}
```

### Token Refresh Callback

```typescript
const authClient = createAuthFlow({
  // ... config
  onTokenRefresh: (tokens) => {
    // Store tokens in external system
    analytics.track('token_refreshed');
  },
});
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Node.js 16+

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.
