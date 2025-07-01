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
- **Smart Defaults**: Minimal configuration required with sensible defaults

## Installation

```bash
npm install @jmndao/auth-flow
```

## Quick Start

### Minimal Setup

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

// Just pass your API base URL
const auth = createAuthFlow('https://api.example.com');

// Login
const user = await auth.login({
  username: 'user@example.com',
  password: 'password',
});

// Make authenticated requests
const data = await auth.get('/protected-resource');

// Logout
await auth.logout();
```

### With Configuration

```typescript
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
  storage: 'localStorage',
});
```

## Default Configuration

AuthFlow provides smart defaults so you need minimal configuration:

```typescript
// Default endpoints (customizable)
{
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout'
}

// Default token names (customizable)
{
  access: 'accessToken',
  refresh: 'refreshToken'
}

// Other defaults
{
  environment: 'auto',        // Auto-detect client/server
  tokenSource: 'body',        // Extract tokens from response body
  storage: 'auto',           // Auto-select best storage
  timeout: 10000,            // 10 second timeout
  retry: { attempts: 3, delay: 1000 }
}
```

## Configuration

### Complete Configuration Interface

```typescript
interface AuthFlowConfig {
  // Optional: API endpoints (defaults provided)
  endpoints?: {
    login?: string; // Default: '/api/auth/login'
    refresh?: string; // Default: '/api/auth/refresh'
    logout?: string; // Default: '/api/auth/logout'
  };

  // Optional: Token field names (defaults provided)
  tokens?: {
    access?: string; // Default: 'accessToken'
    refresh?: string; // Default: 'refreshToken'
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
  const auth = createAuthFlow(
    {
      baseURL: 'https://api.example.com',
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  const data = await auth.get('/protected-data');
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
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onAuthError: (error) => {
    if (error.status === 401) {
      // Handle unauthorized access
      redirectToLogin();
    }
  },
});
```

## Framework Examples

### React

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = async (credentials) => {
    try {
      const userData = await auth.login(credentials);
      setUser(userData);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div>
      {user ? (
        <Dashboard user={user} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}
```

### Next.js Server-Side

```typescript
// pages/api/profile.js
import { createAuthFlow } from '@jmndao/auth-flow';

export default async function handler(req, res) {
  const auth = createAuthFlow('https://api.example.com', { req, res });

  try {
    const profile = await auth.get('/user/profile');
    res.json(profile.data);
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### Express.js

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

app.get('/dashboard', async (req, res) => {
  const auth = createAuthFlow(
    {
      baseURL: 'https://api.example.com',
      storage: 'cookies',
    },
    { req, res }
  );

  if (await auth.hasValidTokens()) {
    const data = await auth.get('/dashboard-data');
    res.json(data);
  } else {
    res.redirect('/login');
  }
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
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onTokenRefresh: (tokens) => {
    // Store tokens in external system
    analytics.track('token_refreshed');
  },
});
```

## Migration from Previous Versions

### From v1.x to v2.x

No breaking changes. Your existing configuration will continue to work. New features:

- String baseURL support: `createAuthFlow('https://api.com')`
- Smart defaults for endpoints and tokens
- Improved TypeScript types
- Better error messages with configured token names

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Node.js 16+

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Documentation

- [Configuration Guide](docs/configuration.md) - Complete configuration options and examples
- [Usage Examples](docs/examples.md) - Framework-specific examples and advanced usage
- [API Reference](docs/api-reference.md) - Detailed API documentation

## License

MIT License - see LICENSE file for details.
