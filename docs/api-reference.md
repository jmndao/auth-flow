# API Reference

## Factory Functions

### createAuthFlow(config, context?)

Creates a new AuthClient instance with cookie timing fixes and automatic token refresh.

```typescript
function createAuthFlow(config: AuthFlowConfig | string, context?: AuthContext): AuthClient;
```

**Parameters:**

- `config`: Configuration object or base URL string
- `context`: Optional server context (req/res objects)

**Example:**

```typescript
// Simple setup
const auth = createAuthFlow('https://api.example.com');

// Full configuration
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: { type: 'cookies', options: { debugMode: true } },
});

// Server-side with context
const auth = createAuthFlow(config, { req, res });
```

### createSingleTokenAuth(config)

Creates a SingleTokenAuthClient for APIs that only provide access tokens.

```typescript
function createSingleTokenAuth(config: SingleTokenConfig): SingleTokenAuthClient;
```

**Example:**

```typescript
const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'accessToken' },
  endpoints: { login: 'auth/login' },
  sessionManagement: { renewBeforeExpiry: 300 },
});
```

## AuthClient

Main authentication client that handles token management and HTTP requests.

### Authentication Methods

#### login<TUser, TCredentials>(credentials)

```typescript
async login<TUser = any, TCredentials = LoginCredentials>(
  credentials: TCredentials
): Promise<TUser>
```

Authenticates user and stores tokens with cookie timing retry logic.

#### logout()

```typescript
async logout(): Promise<void>
```

Clears tokens and calls logout endpoint if configured.

#### isAuthenticated()

```typescript
isAuthenticated(): boolean
```

Synchronous check for token presence.

#### hasValidTokens()

```typescript
async hasValidTokens(): Promise<boolean>
```

Asynchronous validation of stored tokens.

### HTTP Methods

All HTTP methods return a `LoginResponse<T>` with automatic token refresh:

```typescript
interface LoginResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}
```

#### get<T>(url, config?)

```typescript
async get<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>>
```

#### post<T>(url, data?, config?)

```typescript
async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>>
```

#### put<T>(url, data?, config?)

```typescript
async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>>
```

#### patch<T>(url, data?, config?)

```typescript
async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<LoginResponse<T>>
```

#### delete<T>(url, config?)

```typescript
async delete<T = any>(url: string, config?: RequestConfig): Promise<LoginResponse<T>>
```

### Token Management

#### getTokens()

```typescript
async getTokens(): Promise<TokenPair | null>
```

Retrieves stored token pair.

#### setTokens(tokens)

```typescript
async setTokens(tokens: TokenPair): Promise<void>
```

Stores token pair with fallback support.

#### clearTokens()

```typescript
async clearTokens(): Promise<void>
```

Removes all stored tokens.

## SingleTokenAuthClient

Authentication client for single token (access-only) APIs.

### Methods

Has the same interface as AuthClient but optimized for single token workflows:

- Automatic JWT expiry detection
- Session management with credential persistence
- Background token renewal

```typescript
// Usage is identical to AuthClient
const user = await auth.login(credentials);
const data = await auth.get('/protected');
```

## Configuration Types

### AuthFlowConfig

```typescript
interface AuthFlowConfig {
  baseURL?: string;
  endpoints?: {
    login?: string; // Default: '/api/auth/login'
    refresh?: string; // Default: '/api/auth/refresh'
    logout?: string; // Default: '/api/auth/logout'
  };
  tokens?: {
    access?: string; // Default: 'accessToken'
    refresh?: string; // Default: 'refreshToken'
  };
  tokenSource?: 'body' | 'cookies';
  storage?: StorageType | StorageConfig;
  environment?: 'client' | 'server' | 'auto';
  timeout?: number;
  retry?: {
    attempts?: number;
    delay?: number;
  };
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

### StorageConfig

```typescript
interface StorageConfig {
  type?: 'localStorage' | 'cookies' | 'memory' | 'auto';
  options?: {
    // Cookie options
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    domain?: string;
    path?: string;
    httpOnly?: boolean;

    // Cookie timing fixes
    waitForCookies?: number; // Wait time for cookie propagation
    fallbackToBody?: boolean; // Use response body as fallback
    retryCount?: number; // Number of retry attempts
    debugMode?: boolean; // Enable detailed logging
  };
}
```

### SingleTokenConfig

```typescript
interface SingleTokenConfig {
  baseURL: string;
  token: { access: string };
  endpoints: {
    login: string;
    logout?: string;
  };
  sessionManagement?: {
    checkInterval?: number; // Session check interval (ms)
    renewBeforeExpiry?: number; // Renew before expiry (seconds)
    persistCredentials?: boolean; // Store credentials for auto-renewal
    onSessionExpired?: () => void;
  };
  timeout?: number;
  onTokenRefresh?: (token: string) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

### AuthContext

```typescript
interface AuthContext {
  req?: any; // Request object (server-side)
  res?: any; // Response object (server-side)
  cookies?: () => any; // Next.js cookies function
}
```

## Utility Functions

### diagnoseCookieIssues(credentials, config)

Diagnostic utility for troubleshooting cookie timing issues:

```typescript
async function diagnoseCookieIssues(credentials: any, config: AuthFlowConfig): Promise<void>;
```

**Example:**

```typescript
await diagnoseCookieIssues(
  { username: 'test', password: 'test' },
  {
    baseURL: 'https://api.example.com',
    tokenSource: 'cookies',
    storage: { type: 'cookies', options: { debugMode: true } },
  }
);
```

### Configuration Helpers

#### createCookieConfig(baseURL, options?)

Creates optimized cookie configuration:

```typescript
function createCookieConfig(
  baseURL: string,
  options?: {
    tokenNames?: { access: string; refresh: string };
    cookieOptions?: CookieOptions;
  }
): AuthFlowConfig;
```

#### Presets for Single Token Auth

```typescript
const singleTokenPresets = {
  jwtOnly: (baseURL: string, tokenField?: string) => SingleTokenConfig;
  sessionBased: (baseURL: string) => SingleTokenConfig;
  apiKey: (baseURL: string, keyField?: string) => SingleTokenConfig;
};
```

**Example:**

```typescript
const config = singleTokenPresets.jwtOnly('https://api.example.com');
const auth = createSingleTokenAuth(config);
```

## Error Types

### AuthError

```typescript
interface AuthError {
  status: number; // HTTP status code
  message: string; // Error message
  code?: string; // Error code
  originalError?: any; // Original error object
}
```

### Common Error Codes

- `TOKEN_EXPIRED`: Access token has expired
- `REFRESH_TOKEN_EXPIRED`: Refresh token has expired
- `NETWORK_ERROR`: Network connectivity issue
- `VALIDATION_ERROR`: Configuration validation failed

## Storage Adapters

### Built-in Adapters

- `LocalStorageAdapter`: Browser localStorage
- `CookieStorageAdapter`: HTTP cookies (legacy)
- `CookieManager`: Enhanced cookie adapter with timing fixes
- `MemoryStorageAdapter`: In-memory storage

### Custom Storage Adapter

```typescript
interface StorageAdapter {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

class CustomAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    // Implementation
  }

  async set(key: string, value: string): Promise<void> {
    // Implementation
  }

  // ... other methods
}
```

## Migration Guide

### From v1.1.x to v1.2.x

No breaking changes. New features:

1. **Cookie Timing Fixes**: Automatic retry and fallback for cookie issues
2. **Single Token Support**: New `createSingleTokenAuth` for access-only APIs
3. **Enhanced Storage Options**: New cookie management options

### Upgrading Cookie Configuration

```typescript
// Old (v1.1.x) - may have timing issues
const auth = createAuthFlow({
  tokenSource: 'cookies',
  storage: 'cookies',
});

// New (v1.2.x) - automatically handles timing issues
const auth = createAuthFlow({
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
