# API Reference

## Factory Functions

### createAuthFlow(config, context?)

Creates a standard AuthFlow client.

**Parameters:**

- `config` (AuthFlowConfig) - Configuration object
- `context` (AuthContext, optional) - Server-side context

**Returns:** AuthClient

```typescript
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
```

### createAuthFlowV2(config, context?)

Creates a v2.0 AuthFlow client with enhanced features.

**Parameters:**

- `config` (string | AuthFlowV2Config) - Base URL or configuration object
- `context` (AuthContext, optional) - Server-side context

**Returns:** AuthFlowV2Client

```typescript
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  caching: { enabled: true },
  monitoring: { enabled: true },
});
```

### Preset Factory Functions

#### createProductionAuthFlow(baseURL, config?)

Creates a production-ready AuthFlow instance.

```typescript
const auth = createProductionAuthFlow('https://api.example.com');
```

#### createPerformantAuthFlow(baseURL)

Creates a high-performance AuthFlow instance with caching.

```typescript
const auth = createPerformantAuthFlow('https://api.example.com');
```

#### createSecureAuthFlow(baseURL, encryptionKey, signingKey)

Creates a security-focused AuthFlow instance.

```typescript
const auth = createSecureAuthFlow('https://api.example.com', 'encryption-key', 'signing-key');
```

#### createResilientAuthFlow(baseURL)

Creates a resilient AuthFlow instance for unreliable networks.

```typescript
const auth = createResilientAuthFlow('https://api.example.com');
```

#### createDevAuthFlow(baseURL)

Creates a development-friendly AuthFlow instance.

```typescript
const auth = createDevAuthFlow('https://api.example.com');
```

## AuthClient Interface

### Authentication Methods

#### login<TUser, TCredentials>(credentials)

Authenticates a user with the provided credentials.

**Parameters:**

- `credentials` (TCredentials) - Login credentials

**Returns:** Promise<TUser>

```typescript
const user = await auth.login({
  email: 'user@example.com',
  password: 'password',
});
```

#### logout()

Logs out the current user and clears tokens.

**Returns:** Promise<void>

```typescript
await auth.logout();
```

#### isAuthenticated()

Checks if the user is currently authenticated (synchronous).

**Returns:** boolean

```typescript
const isAuth = auth.isAuthenticated();
```

#### hasValidTokens()

Checks if valid tokens are available (asynchronous).

**Returns:** Promise<boolean>

```typescript
const hasTokens = await auth.hasValidTokens();
```

### Token Management

#### getTokens()

Retrieves the current token pair.

**Returns:** Promise<TokenPair | null>

```typescript
const tokens = await auth.getTokens();
if (tokens) {
  console.log(tokens.accessToken);
  console.log(tokens.refreshToken);
}
```

#### setTokens(tokens)

Sets the token pair.

**Parameters:**

- `tokens` (TokenPair) - Access and refresh tokens

**Returns:** Promise<void>

```typescript
await auth.setTokens({
  accessToken: 'new-access-token',
  refreshToken: 'new-refresh-token',
});
```

#### clearTokens()

Clears all stored tokens.

**Returns:** Promise<void>

```typescript
await auth.clearTokens();
```

### HTTP Methods

#### get<T>(url, config?)

Makes a GET request.

**Parameters:**

- `url` (string) - Request URL
- `config` (RequestConfig, optional) - Request configuration

**Returns:** Promise<LoginResponse<T>>

```typescript
const users = await auth.get('/api/users');
```

#### post<T>(url, data?, config?)

Makes a POST request.

**Parameters:**

- `url` (string) - Request URL
- `data` (any, optional) - Request body
- `config` (RequestConfig, optional) - Request configuration

**Returns:** Promise<LoginResponse<T>>

```typescript
const newUser = await auth.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

#### put<T>(url, data?, config?)

Makes a PUT request.

**Returns:** Promise<LoginResponse<T>>

#### patch<T>(url, data?, config?)

Makes a PATCH request.

**Returns:** Promise<LoginResponse<T>>

#### delete<T>(url, config?)

Makes a DELETE request.

**Returns:** Promise<LoginResponse<T>>

#### head<T>(url, config?)

Makes a HEAD request.

**Returns:** Promise<LoginResponse<T>>

#### options<T>(url, config?)

Makes an OPTIONS request.

**Returns:** Promise<LoginResponse<T>>

## AuthFlowV2Client Interface

### Additional V2 Features

#### getPerformanceMetrics()

Returns aggregated performance metrics.

**Returns:** AggregatedMetrics

```typescript
const metrics = auth.getPerformanceMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  averageResponseTime: metrics.averageResponseTime,
  successRate: metrics.successRate,
});
```

#### clearPerformanceMetrics()

Clears all performance metrics.

```typescript
auth.clearPerformanceMetrics();
```

#### getCacheStats()

Returns cache statistics.

**Returns:** CacheStats

```typescript
const stats = auth.getCacheStats();
console.log({
  size: stats.size,
  hitRate: stats.hitRate,
});
```

#### clearCache(pattern?)

Clears cache entries, optionally by pattern.

**Parameters:**

- `pattern` (string, optional) - URL pattern to match

```typescript
// Clear all cache
auth.clearCache();

// Clear specific pattern
auth.clearCache('/api/users/*');
```

#### getHealthStatus()

Returns current health status.

```typescript
const health = auth.getHealthStatus();
```

#### checkHealth()

Performs an immediate health check.

**Returns:** Promise<HealthStatus>

```typescript
const health = await auth.checkHealth();
```

#### getCircuitBreakerStats()

Returns circuit breaker statistics.

```typescript
const stats = auth.getCircuitBreakerStats();
```

#### resetCircuitBreaker()

Manually resets the circuit breaker.

```typescript
auth.resetCircuitBreaker();
```

#### enableDebugMode() / disableDebugMode()

Controls debug mode.

```typescript
auth.enableDebugMode();
auth.disableDebugMode();
```

#### getDebugInfo()

Returns comprehensive debug information.

**Returns:** DebugInfo

```typescript
const debug = auth.getDebugInfo();
```

#### destroy()

Cleans up resources and stops monitoring.

```typescript
auth.destroy();
```

## Middleware Functions

### createAuthMiddleware(authFlow, config?)

Creates authentication middleware for Next.js.

**Parameters:**

- `authFlow` (AuthFlowInstance) - AuthFlow client instance
- `config` (MiddlewareConfig, optional) - Middleware configuration

**Returns:** Next.js middleware function

```typescript
import { createAuthMiddleware } from '@jmndao/auth-flow/middleware';

export default createAuthMiddleware(authFlow, {
  redirectUrl: '/login',
  publicPaths: ['/login', '/register'],
  protectedPaths: ['/dashboard/*'],
});
```

### createServerAuthChecker(authFlow)

Creates server-side authentication checker.

**Parameters:**

- `authFlow` (AuthFlowInstance) - AuthFlow client instance

**Returns:** Promise<Function>

```typescript
const checkAuth = await createServerAuthChecker(authFlow);
const result = await checkAuth();

if (result.isAuthenticated) {
  console.log('User:', result.user);
}
```

### createServerActionWrapper(authFlow)

Creates wrapper for server actions with authentication.

**Parameters:**

- `authFlow` (AuthFlowInstance) - AuthFlow client instance

**Returns:** Function wrapper

```typescript
const withAuth = createServerActionWrapper(authFlow);

export const updateProfile = withAuth(async (formData) => {
  // Protected server action
});
```

## Configuration Interfaces

### AuthFlowConfig

```typescript
interface AuthFlowConfig {
  baseURL?: string;
  endpoints: {
    login: string;
    refresh: string;
    logout?: string;
  };
  tokens: {
    access: string;
    refresh: string;
  };
  tokenSource?: 'body' | 'cookies';
  storage?: StorageType | StorageConfig;
  timeout?: number;
  retry?: RetryConfig;
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

### AuthFlowV2Config

```typescript
interface AuthFlowV2Config extends AuthFlowConfig {
  caching?: Partial<CacheConfig>;
  monitoring?: Partial<PerformanceConfig>;
  security?: Partial<SecurityConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  health?: Partial<HealthConfig>;
  debugMode?: boolean;
  analytics?: AnalyticsConfig;
}
```

### MiddlewareConfig

```typescript
interface MiddlewareConfig {
  redirectUrl?: string;
  publicPaths?: string[];
  protectedPaths?: string[];
  skipValidation?: (path: string) => boolean;
  includeCallbackUrl?: boolean;
}
```

## Error Handling

### AuthError

```typescript
interface AuthError {
  status: number;
  message: string;
  code?: string;
  originalError?: any;
}
```

Common error codes:

- `NETWORK_ERROR` - Network connectivity issues
- `TOKEN_EXPIRED` - Access token has expired
- `REFRESH_TOKEN_EXPIRED` - Refresh token has expired
- `INVALID_CREDENTIALS` - Login credentials are invalid
- `UNAUTHORIZED` - Request lacks valid authentication

## Type Definitions

### TokenPair

```typescript
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
```

### AuthContext

```typescript
interface AuthContext {
  req?: any;
  res?: any;
  cookies?: () => Promise<any> | any;
  headers?: () => Promise<any> | any;
  cookieSetter?: (name: string, value: string, options?: any) => Promise<void> | void;
}
```

### LoginResponse

```typescript
interface LoginResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}
```
