# Configuration Guide

## Quick Setup

### Minimal Configuration

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

// Just pass your API URL - uses smart defaults
const auth = createAuthFlow('https://api.example.com');
```

### Cookie-Based Authentication

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      waitForCookies: 500, // Wait for cookie propagation
      fallbackToBody: true, // Use response as fallback
      retryCount: 3, // Retry attempts
      secure: true,
      sameSite: 'lax',
    },
  },
});
```

### Single Token Authentication

```typescript
import { createSingleTokenAuth } from '@jmndao/auth-flow';

const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'accessToken' },
  endpoints: { login: 'auth/login' },
  sessionManagement: {
    renewBeforeExpiry: 300, // Renew 5 min before expiry
    persistCredentials: true, // Enable auto-renewal
  },
});
```

## Default Configuration

AuthFlow provides smart defaults requiring minimal setup:

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

// Default settings
{
  tokenSource: 'body',        // Extract from response body
  storage: 'auto',           // Auto-select best storage
  environment: 'auto',       // Auto-detect client/server
  timeout: 10000,           // 10 second timeout
  retry: { attempts: 3, delay: 1000 }
}
```

## Complete Configuration Options

### AuthFlowConfig Interface

```typescript
interface AuthFlowConfig {
  // API Configuration
  baseURL?: string;
  timeout?: number; // Request timeout (ms)

  // Endpoints (optional - defaults provided)
  endpoints?: {
    login?: string; // Default: '/api/auth/login'
    refresh?: string; // Default: '/api/auth/refresh'
    logout?: string; // Default: '/api/auth/logout'
  };

  // Token Configuration (optional - defaults provided)
  tokens?: {
    access?: string; // Default: 'accessToken'
    refresh?: string; // Default: 'refreshToken'
  };

  // Token Source
  tokenSource?: 'body' | 'cookies'; // Where to extract tokens from

  // Storage Configuration
  storage?: StorageType | StorageConfig;

  // Environment
  environment?: 'client' | 'server' | 'auto';

  // Retry Configuration
  retry?: {
    attempts?: number; // Retry attempts
    delay?: number; // Delay between retries (ms)
  };

  // Event Callbacks
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

### StorageConfig Interface

```typescript
interface StorageConfig {
  type?: 'localStorage' | 'cookies' | 'memory' | 'auto';
  options?: {
    // Standard cookie options
    secure?: boolean; // Require HTTPS
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number; // Cookie expiry (seconds)
    domain?: string; // Cookie domain
    path?: string; // Cookie path
    httpOnly?: boolean; // Server-side only

    // Cookie timing fixes (v1.2.x)
    waitForCookies?: number; // Wait time for propagation (ms)
    fallbackToBody?: boolean; // Use response body as fallback
    retryCount?: number; // Number of retry attempts
    debugMode?: boolean; // Enable detailed logging
  };
}
```

## Storage Options

### Auto Storage (Recommended)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'auto', // Automatically selects best option
});
```

### Local Storage

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'localStorage', // Browser only
});
```

### Cookie Storage

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: {
    type: 'cookies',
    options: {
      secure: true,
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
      waitForCookies: 500, // Wait for server to set cookies
      fallbackToBody: true, // Use response body during delays
      retryCount: 3, // Retry cookie reads
    },
  },
});
```

### Memory Storage

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'memory', // Temporary, lost on page refresh
});
```

## Environment-Specific Configuration

### Client-Side (Browser)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'localStorage',
  environment: 'client',
});
```

### Server-Side (Node.js/Next.js)

```typescript
const auth = createAuthFlow(
  {
    baseURL: 'https://api.example.com',
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
  },
  { req, res }
);
```

### Universal (SSR)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'auto', // Auto-selects appropriate storage
  environment: 'auto', // Auto-detects environment
  tokenSource: 'body',
});
```

## Token Source Configuration

### Body-Based Tokens (Default)

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

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  tokens: {
    access: 'auth_token', // Cookie names
    refresh: 'refresh_token',
  },
  storage: {
    type: 'cookies',
    options: {
      waitForCookies: 500, // Critical for cookie timing issues
      fallbackToBody: true,
      retryCount: 3,
    },
  },
});
```

## Cookie Timing Issue Solutions

### Problem: Cookie Propagation Delays

When using `tokenSource: 'cookies'`, cookies may not be immediately available after login, causing authentication failures.

### Solution: Enhanced Cookie Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      waitForCookies: 500, // Wait 500ms for cookies to propagate
      fallbackToBody: true, // Use login response body as fallback
      retryCount: 3, // Retry cookie reads 3 times
      debugMode: true, // Enable logging for troubleshooting
    },
  },
});
```

### Troubleshooting Cookie Issues

```typescript
import { diagnoseCookieIssues } from '@jmndao/auth-flow';

// Run diagnostic to identify problems
await diagnoseCookieIssues(
  { username: 'test', password: 'test' },
  {
    baseURL: 'https://api.example.com',
    tokenSource: 'cookies',
    storage: { type: 'cookies', options: { debugMode: true } },
  }
);
```

## Single Token Configuration

### JWT-Only Backend

```typescript
import { createSingleTokenAuth, singleTokenPresets } from '@jmndao/auth-flow';

// Using preset
const config = singleTokenPresets.jwtOnly('https://api.example.com');
const auth = createSingleTokenAuth(config);

// Custom configuration
const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'accessToken' },
  endpoints: { login: 'auth/login' },
  sessionManagement: {
    renewBeforeExpiry: 300, // Renew 5 minutes before expiry
    persistCredentials: true, // Store credentials for auto-renewal
    checkInterval: 60000, // Check token expiry every minute
  },
});
```

### Session-Based Authentication

```typescript
const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'sessionToken' },
  endpoints: {
    login: 'auth/login',
    logout: 'auth/logout',
  },
  sessionManagement: {
    onSessionExpired: () => {
      window.location.href = '/login';
    },
  },
});
```

## Error Handling Configuration

### Global Error Handlers

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onAuthError: (error) => {
    switch (error.status) {
      case 401:
        window.location.href = '/login';
        break;
      case 403:
        showNotification('Access denied');
        break;
      case 429:
        showNotification('Rate limited');
        break;
    }
  },
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed successfully');
    analytics.track('token_refresh');
  },
  onLogout: () => {
    clearUserData();
    showNotification('Logged out successfully');
  },
});
```

### Retry Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  retry: {
    attempts: 3, // Retry failed requests 3 times
    delay: 1000, // Base delay of 1 second (exponential backoff)
  },
});
```

## Framework-Specific Configurations

### React Configuration

```typescript
// src/auth.ts
export const auth = createAuthFlow({
  baseURL: process.env.REACT_APP_API_URL,
  onAuthError: (error) => {
    if (error.status === 401) {
      window.location.href = '/login';
    }
  },
});
```

### Next.js Configuration

```typescript
// lib/auth.ts
export const createAuthForContext = (context) =>
  createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
      environment: 'server',
    },
    context
  );

// Usage in API routes
const auth = createAuthForContext({ req, res });
```

### Express.js Configuration

```typescript
// middleware/auth.ts
export const authConfig = {
  baseURL: process.env.API_BASE_URL,
  storage: {
    type: 'cookies',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  },
  environment: 'server',
};
```

## Configuration Helpers

### Cookie Configuration Helper

```typescript
import { createCookieConfig } from '@jmndao/auth-flow';

const config = createCookieConfig('https://api.example.com', {
  tokenNames: { access: 'auth_token', refresh: 'refresh_token' },
  cookieOptions: {
    waitForCookies: 1000,
    retryCount: 5,
    debugMode: true,
  },
});

const auth = createAuthFlow(config);
```

### Environment-Based Configuration

```typescript
const getAuthConfig = () => {
  const isDev = process.env.NODE_ENV === 'development';
  const isProd = process.env.NODE_ENV === 'production';

  return createAuthFlow({
    baseURL: isDev ? 'http://localhost:3001' : 'https://api.example.com',

    storage: isProd
      ? {
          type: 'cookies',
          options: { secure: true, sameSite: 'strict' },
        }
      : 'localStorage',

    timeout: isDev ? 30000 : 10000,

    retry: {
      attempts: isProd ? 3 : 1,
      delay: isProd ? 1000 : 500,
    },
  });
};

export const auth = getAuthConfig();
```

## Validation Rules

Configuration is automatically validated with these rules:

- `endpoints.login` and `endpoints.refresh` are required (or defaults used)
- `tokens.access` and `tokens.refresh` are required (or defaults used)
- `timeout` must be positive number
- `retry.attempts` must be non-negative
- `retry.delay` must be non-negative
- URLs must be valid relative or absolute URLs
- Storage options must be valid for selected storage type

## Migration Guide

### From v1.1.x to v1.2.x

**No breaking changes.** Existing configurations continue to work.

#### Before (v1.1.x)

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: 'cookies',
});
```

#### After (v1.2.x) - With Cookie Timing Fixes

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      waitForCookies: 500,
      fallbackToBody: true,
      retryCount: 3,
    },
  },
});
```

### New Features Available

1. **Automatic Cookie Timing Fixes**: Resolves cookie propagation delays
2. **Single Token Support**: For APIs without refresh tokens
3. **Enhanced Storage Options**: More granular cookie configuration
4. **Debug Mode**: Detailed logging for troubleshooting

### Recommended Upgrades

If experiencing cookie timing issues, update your configuration:

```typescript
// Add timing fixes to existing cookie configuration
const auth = createAuthFlow({
  ...existingConfig,
  storage: {
    type: 'cookies',
    options: {
      ...existingConfig.storage?.options,
      waitForCookies: 500,
      fallbackToBody: true,
      retryCount: 3,
      debugMode: false, // Set to true for troubleshooting
    },
  },
});
```
