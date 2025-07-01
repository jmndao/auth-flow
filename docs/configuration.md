# Configuration Guide

## Quick Setup

### Minimal Configuration

The simplest way to get started:

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

// Just pass your API base URL
const auth = createAuthFlow('https://api.example.com');
```

This uses smart defaults:

- **Endpoints**: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- **Tokens**: `accessToken`, `refreshToken`
- **Storage**: Auto-selected based on environment
- **Environment**: Auto-detected

### Basic Configuration

Customize the essentials:

```typescript
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
```

## Complete Configuration Options

```typescript
interface AuthFlowConfig {
  // Optional: API endpoints (smart defaults provided)
  endpoints?: {
    login?: string; // Default: '/api/auth/login'
    refresh?: string; // Default: '/api/auth/refresh'
    logout?: string; // Default: '/api/auth/logout'
  };

  // Optional: Token field names (smart defaults provided)
  tokens?: {
    access?: string; // Default: 'accessToken'
    refresh?: string; // Default: 'refreshToken'
  };

  // Optional: General settings
  baseURL?: string; // Base URL for all requests
  timeout?: number; // Request timeout in milliseconds (default: 10000)
  environment?: Environment; // 'client' | 'server' | 'auto' (default: 'auto')

  // Optional: Token source configuration
  tokenSource?: TokenSource; // 'body' | 'cookies' (default: 'body')

  // Optional: Storage configuration
  storage?: StorageType | StorageConfig; // Default: 'auto'

  // Optional: Retry configuration
  retry?: {
    attempts?: number; // Number of retry attempts (default: 3)
    delay?: number; // Delay between retries in ms (default: 1000)
  };

  // Optional: Event callbacks
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

## Default Values

AuthFlow provides sensible defaults so you need minimal configuration:

### Default Endpoints

```typescript
{
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout'
}
```

### Default Token Names

```typescript
{
  access: 'accessToken',
  refresh: 'refreshToken'
}
```

### Other Defaults

```typescript
{
  environment: 'auto',        // Auto-detect client/server
  tokenSource: 'body',        // Extract tokens from response body
  storage: 'auto',           // Auto-select best storage
  timeout: 10000,            // 10 second timeout
  retry: {
    attempts: 3,             // 3 retry attempts
    delay: 1000             // 1 second base delay
  }
}
```

## Storage Configuration

### Simple Storage Types

```typescript
// Use browser localStorage
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'localStorage',
});

// Use HTTP cookies
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'cookies',
});

// Use memory storage (temporary)
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'memory',
});

// Auto-select best storage for environment (default)
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'auto',
});
```

### Advanced Storage Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: {
    type: 'cookies',
    options: {
      secure: true, // Require HTTPS
      sameSite: 'strict', // CSRF protection
      maxAge: 86400, // 24 hours in seconds
      domain: '.example.com', // Cookie domain
      path: '/', // Cookie path
      httpOnly: true, // Server-side only (server environments)
    },
  },
});
```

## Environment-Specific Configurations

### Client-Side (Browser)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'localStorage',
  environment: 'client',
  timeout: 10000,
});
```

### Server-Side (Node.js/Next.js)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://internal-api.example.com',
  storage: {
    type: 'cookies',
    options: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    },
  },
  environment: 'server',
  tokenSource: 'cookies',
});
```

### Universal (SSR)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'auto', // Automatically selects appropriate storage
  environment: 'auto', // Automatically detects environment
  tokenSource: 'body',
});
```

## Token Source Configuration

### Body-Based Tokens (Default)

Tokens are extracted from the response body:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'body',
  tokens: {
    access: 'accessToken', // Response: { accessToken: "...", refreshToken: "..." }
    refresh: 'refreshToken',
  },
});
```

### Cookie-Based Tokens

Tokens are stored and retrieved from HTTP cookies:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  tokens: {
    access: 'auth_token', // Cookie names
    refresh: 'refresh_token',
  },
  storage: 'cookies',
});
```

## Retry Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  retry: {
    attempts: 3, // Number of retry attempts for failed requests
    delay: 1000, // Base delay between retries (exponential backoff applied)
  },
});
```

Retry behavior:

- Retries network errors and 5xx server errors
- Does not retry authentication errors (401, 403)
- Uses exponential backoff: delay \* 2^attempt

## Event Callbacks

### Token Refresh Callback

Called when tokens are refreshed:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed:', tokens);
    // Store in external system, analytics, etc.
  },
});
```

### Authentication Error Callback

Called for authentication-related errors:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onAuthError: (error) => {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
  },
});
```

### Logout Callback

Called when user logs out:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onLogout: () => {
    // Clear user data, redirect, analytics, etc.
    clearUserData();
    router.push('/login');
  },
});
```

## Framework-Specific Examples

### React Application

```typescript
// src/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';

export const auth = createAuthFlow({
  baseURL: process.env.REACT_APP_API_URL || 'https://api.example.com',
  onAuthError: (error) => {
    if (error.status === 401) {
      window.location.href = '/login';
    }
  },
});
```

### Next.js API Route

```typescript
// pages/api/protected.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL || 'https://api.example.com',
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    const data = await auth.get('/protected-data');
    res.json(data.data);
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### Express.js Middleware

```typescript
// middleware/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import { Request, Response, NextFunction } from 'express';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL || 'https://api.example.com',
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    const isAuthenticated = await auth.hasValidTokens();
    if (!isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as any).auth = auth;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

## Configuration Examples by Use Case

### Simple SPA (Single Page Application)

```typescript
const auth = createAuthFlow('https://api.example.com');
```

### Complex Enterprise Application

```typescript
const auth = createAuthFlow({
  baseURL: 'https://enterprise-api.example.com',
  endpoints: {
    login: '/oauth/token',
    refresh: '/oauth/refresh',
    logout: '/oauth/revoke',
  },
  tokens: {
    access: 'access_token',
    refresh: 'refresh_token',
  },
  storage: {
    type: 'localStorage',
    options: {
      secure: true,
    },
  },
  timeout: 30000,
  retry: {
    attempts: 5,
    delay: 2000,
  },
  onTokenRefresh: (tokens) => {
    analytics.track('token_refresh', { userId: getCurrentUserId() });
  },
  onAuthError: (error) => {
    if (error.status === 401) {
      showModal('Session expired. Please login again.');
      redirectToLogin();
    }
  },
});
```

### Development vs Production

```typescript
const auth = createAuthFlow({
  baseURL:
    process.env.NODE_ENV === 'production' ? 'https://api.example.com' : 'http://localhost:3001',
  storage:
    process.env.NODE_ENV === 'production'
      ? { type: 'cookies', options: { secure: true, sameSite: 'strict' } }
      : 'localStorage',
  timeout: process.env.NODE_ENV === 'production' ? 10000 : 30000,
});
```

## Validation Rules

The configuration is validated on creation with the following rules:

- `endpoints.login` and `endpoints.refresh` are required (or defaults are used)
- `tokens.access` and `tokens.refresh` are required (or defaults are used)
- `timeout` must be a positive number
- `retry.attempts` must be non-negative
- `retry.delay` must be non-negative
- URLs must be valid relative or absolute URLs
- Storage options must be valid for the selected storage type

## Migration Guide

### Upgrading to v2.x

No breaking changes. Your existing configuration will continue to work. New features available:

1. **String Configuration**: Pass just a baseURL string for quick setup
2. **Smart Defaults**: Minimal configuration required
3. **Better Error Messages**: Shows your configured token names in errors
4. **Improved Types**: Better TypeScript support

### Before (v1.x)

```typescript
const auth = createAuthFlow({
  endpoints: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
});
```

### After (v2.x)

```typescript
// Still works exactly the same
const auth = createAuthFlow({
  endpoints: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
});

// Or use the new simplified syntax
const auth = createAuthFlow('https://api.example.com');
```
