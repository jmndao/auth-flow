# Configuration Guide

## Basic Configuration

The minimum required configuration for AuthFlow:

```typescript
const config = {
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
};
```

## Complete Configuration Options

```typescript
interface AuthFlowConfig {
  // Required: API endpoints
  endpoints: {
    login: string; // Login endpoint
    refresh: string; // Token refresh endpoint
    logout?: string; // Optional logout endpoint
  };

  // Required: Token field names in API responses
  tokens: {
    access: string; // Access token field name
    refresh: string; // Refresh token field name
  };

  // Optional: General settings
  baseURL?: string; // Base URL for all requests
  timeout?: number; // Request timeout in milliseconds (default: 10000)
  environment?: Environment; // 'client' | 'server' | 'auto' (default: 'auto')

  // Optional: Token source configuration
  tokenSource?: TokenSource; // 'body' | 'cookies' (default: 'body')

  // Optional: Storage configuration
  storage?: StorageType | StorageConfig;

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

## Storage Configuration

### Simple Storage Types

```typescript
// Use browser localStorage
const config = {
  // ... other config
  storage: 'localStorage',
};

// Use HTTP cookies
const config = {
  // ... other config
  storage: 'cookies',
};

// Use memory storage (temporary)
const config = {
  // ... other config
  storage: 'memory',
};

// Auto-select best storage for environment
const config = {
  // ... other config
  storage: 'auto', // default
};
```

### Advanced Storage Configuration

```typescript
const config = {
  // ... other config
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
};
```

## Environment-Specific Configurations

### Client-Side (Browser)

```typescript
const clientConfig = {
  endpoints: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
  storage: 'localStorage',
  environment: 'client',
  timeout: 10000,
};
```

### Server-Side (Node.js/Next.js)

```typescript
const serverConfig = {
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'access_token',
    refresh: 'refresh_token',
  },
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
};
```

### Universal (SSR)

```typescript
const universalConfig = {
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  storage: 'auto', // Automatically selects appropriate storage
  environment: 'auto', // Automatically detects environment
  tokenSource: 'body',
};
```

## Token Source Configuration

### Body-Based Tokens (Default)

Tokens are extracted from the response body:

```typescript
const config = {
  // ... other config
  tokenSource: 'body',
  tokens: {
    access: 'accessToken', // Response: { accessToken: "...", refreshToken: "..." }
    refresh: 'refreshToken',
  },
};
```

### Cookie-Based Tokens

Tokens are stored and retrieved from HTTP cookies:

```typescript
const config = {
  // ... other config
  tokenSource: 'cookies',
  tokens: {
    access: 'auth_token', // Cookie names
    refresh: 'refresh_token',
  },
  storage: 'cookies',
};
```

## Retry Configuration

```typescript
const config = {
  // ... other config
  retry: {
    attempts: 3, // Number of retry attempts for failed requests
    delay: 1000, // Base delay between retries (exponential backoff applied)
  },
};
```

Retry behavior:

- Retries network errors and 5xx server errors
- Does not retry authentication errors (401, 403)
- Uses exponential backoff: delay \* 2^attempt

## Event Callbacks

### Token Refresh Callback

Called when tokens are refreshed:

```typescript
const config = {
  // ... other config
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed:', tokens);
    // Store in external system, analytics, etc.
  },
};
```

### Authentication Error Callback

Called for authentication-related errors:

```typescript
const config = {
  // ... other config
  onAuthError: (error) => {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
  },
};
```

### Logout Callback

Called when user logs out:

```typescript
const config = {
  // ... other config
  onLogout: () => {
    // Clear user data, redirect, analytics, etc.
    clearUserData();
    router.push('/login');
  },
};
```

## Framework-Specific Examples

### React Application

```typescript
// src/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';

export const authClient = createAuthFlow({
  endpoints: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: process.env.REACT_APP_API_URL,
  storage: 'localStorage',
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
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    const data = await authClient.get('/protected-data');
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
  const authClient = createAuthFlow(
    {
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'access_token',
        refresh: 'refresh_token',
      },
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    const isAuthenticated = await authClient.hasValidTokens();
    if (!isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.authClient = authClient;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

## Validation Rules

The configuration is validated on creation with the following rules:

- `endpoints.login` and `endpoints.refresh` are required
- `tokens.access` and `tokens.refresh` are required
- `timeout` must be a positive number
- `retry.attempts` must be non-negative
- `retry.delay` must be non-negative
- URLs must be valid relative or absolute URLs
- Storage options must be valid for the selected storage type
