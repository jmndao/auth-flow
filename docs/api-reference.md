# API Reference

## Factory Functions

### createAuthFlow(config, context?)

Creates a v1.x compatible AuthFlow client.

**Parameters:**

- `config` (string | AuthFlowConfig) - Base URL or configuration object
- `context` (AuthContext, optional) - Server-side context

**Returns:** AuthClient

```typescript
const auth = createAuthFlow('https://api.example.com');
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

Creates a production-ready AuthFlow instance with monitoring and security features.

```typescript
const auth = createProductionAuthFlow('https://api.example.com');
```

#### createPerformantAuthFlow(baseURL)

Creates a high-performance AuthFlow instance with aggressive caching.

```typescript
const auth = createPerformantAuthFlow('https://api.example.com');
```

#### createSecureAuthFlow(baseURL, encryptionKey, signingKey)

Creates a security-focused AuthFlow instance with encryption and signing.

```typescript
const auth = createSecureAuthFlow('https://api.example.com', 'encryption-key', 'signing-key');
```

#### createResilientAuthFlow(baseURL)

Creates a resilient AuthFlow instance for unreliable networks.

```typescript
const auth = createResilientAuthFlow('https://api.example.com');
```

#### createDevAuthFlow(baseURL)

Creates a development-friendly AuthFlow instance with debugging enabled.

```typescript
const auth = createDevAuthFlow('https://api.example.com');
```

## AuthFlowV2Client Interface

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
- `config` (V2RequestConfig, optional) - Request configuration

**Returns:** Promise<T>

```typescript
const users = await auth.get('/api/users');
const user = await auth.get('/api/users/1', {
  headers: { 'Custom-Header': 'value' },
  cache: { ttl: 60000 },
});
```

#### post<T>(url, data?, config?)

Makes a POST request.

**Parameters:**

- `url` (string) - Request URL
- `data` (any, optional) - Request body
- `config` (V2RequestConfig, optional) - Request configuration

**Returns:** Promise<T>

```typescript
const newUser = await auth.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

#### put<T>(url, data?, config?)

Makes a PUT request.

**Parameters:**

- `url` (string) - Request URL
- `data` (any, optional) - Request body
- `config` (V2RequestConfig, optional) - Request configuration

**Returns:** Promise<T>

```typescript
const updatedUser = await auth.put('/api/users/1', {
  name: 'Jane Doe',
});
```

#### patch<T>(url, data?, config?)

Makes a PATCH request.

**Parameters:**

- `url` (string) - Request URL
- `data` (any, optional) - Request body
- `config` (V2RequestConfig, optional) - Request configuration

**Returns:** Promise<T>

```typescript
const patchedUser = await auth.patch('/api/users/1', {
  status: 'active',
});
```

#### delete<T>(url, config?)

Makes a DELETE request.

**Parameters:**

- `url` (string) - Request URL
- `config` (V2RequestConfig, optional) - Request configuration

**Returns:** Promise<T>

```typescript
await auth.delete('/api/users/1');
```

### Performance Monitoring

#### getPerformanceMetrics()

Returns aggregated performance metrics.

**Returns:** AggregatedMetrics

```typescript
const metrics = auth.getPerformanceMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  averageResponseTime: metrics.averageResponseTime,
  successRate: metrics.successRate,
  p95ResponseTime: metrics.p95ResponseTime,
  p99ResponseTime: metrics.p99ResponseTime,
  cacheHitRate: metrics.cacheHitRate,
});
```

#### clearPerformanceMetrics()

Clears all performance metrics.

**Returns:** void

```typescript
auth.clearPerformanceMetrics();
```

### Cache Management

#### getCacheStats()

Returns cache statistics.

**Returns:** CacheStats

```typescript
const stats = auth.getCacheStats();
console.log({
  size: stats.size,
  maxSize: stats.maxSize,
  hitRate: stats.hitRate,
  expired: stats.expired,
  valid: stats.valid,
});
```

#### clearCache(pattern?)

Clears cache entries, optionally by pattern.

**Parameters:**

- `pattern` (string, optional) - URL pattern to match

**Returns:** void

```typescript
// Clear all cache
auth.clearCache();

// Clear specific pattern
auth.clearCache('/api/users/*');
```

### Security Features

#### validateToken(token)

Validates a JWT token.

**Parameters:**

- `token` (string) - Token to validate

**Returns:** TokenValidation

```typescript
const validation = auth.validateToken(token);
console.log({
  isValid: validation.isValid,
  isExpired: validation.isExpired,
  expiresAt: validation.expiresAt,
  payload: validation.payload,
});
```

#### encryptToken(token)

Encrypts a token using the configured encryption key.

**Parameters:**

- `token` (string) - Token to encrypt

**Returns:** string

```typescript
const encrypted = auth.encryptToken('sensitive-token');
```

#### decryptToken(encryptedToken)

Decrypts a token using the configured encryption key.

**Parameters:**

- `encryptedToken` (string) - Encrypted token to decrypt

**Returns:** string

```typescript
const decrypted = auth.decryptToken(encryptedToken);
```

### Health Monitoring

#### getHealthStatus()

Returns current health status.

**Returns:** HealthStatus

```typescript
const health = auth.getHealthStatus();
console.log({
  isHealthy: health.isHealthy,
  lastCheckTime: health.lastCheckTime,
  responseTime: health.responseTime,
});
```

#### checkHealth()

Performs an immediate health check.

**Returns:** Promise<HealthStatus>

```typescript
const health = await auth.checkHealth();
```

### Circuit Breaker

#### getCircuitBreakerStats()

Returns circuit breaker statistics.

**Returns:** CircuitBreakerStats

```typescript
const stats = auth.getCircuitBreakerStats();
console.log({
  state: stats.state,
  failures: stats.failures,
  successes: stats.successes,
  nextRetryTime: stats.nextRetryTime,
});
```

#### resetCircuitBreaker()

Manually resets the circuit breaker to closed state.

**Returns:** void

```typescript
auth.resetCircuitBreaker();
```

### Multi-Provider Support

#### switchProvider(providerName)

Switches to a different authentication provider.

**Parameters:**

- `providerName` (string) - Name of the provider to switch to

**Returns:** Promise<void>

```typescript
await auth.switchProvider('secondary');
```

#### getActiveProvider()

Gets the name of the currently active provider.

**Returns:** string

```typescript
const provider = auth.getActiveProvider();
```

### Offline Support

#### enableOfflineMode()

Enables offline mode.

**Returns:** void

```typescript
auth.enableOfflineMode();
```

#### disableOfflineMode()

Disables offline mode.

**Returns:** void

```typescript
auth.disableOfflineMode();
```

#### isOffline()

Checks if offline mode is enabled.

**Returns:** boolean

```typescript
const offline = auth.isOffline();
```

#### syncOfflineData()

Synchronizes offline data when connection is restored.

**Returns:** Promise<void>

```typescript
await auth.syncOfflineData();
```

### Developer Tools

#### enableDebugMode()

Enables debug mode with detailed logging.

**Returns:** void

```typescript
auth.enableDebugMode();
```

#### disableDebugMode()

Disables debug mode.

**Returns:** void

```typescript
auth.disableDebugMode();
```

#### getDebugInfo()

Returns comprehensive debug information.

**Returns:** DebugInfo

```typescript
const debug = auth.getDebugInfo();
console.log({
  config: debug.config,
  authState: debug.authState,
  performance: debug.performance,
  health: debug.health,
  circuitBreaker: debug.circuitBreaker,
  features: debug.features,
});
```

### Resource Management

#### destroy()

Cleans up resources and stops all monitoring.

**Returns:** void

```typescript
auth.destroy();
```

## Configuration Interfaces

### AuthFlowV2Config

```typescript
interface AuthFlowV2Config {
  baseURL: string;

  // Authentication
  endpoints?: {
    login: string;
    refresh: string;
    logout?: string;
  };
  tokens?: {
    access: string;
    refresh: string;
  };
  tokenSource?: 'body' | 'cookies';
  storage?: StorageType | StorageConfig;
  timeout?: number;

  // Performance
  caching?: Partial<CacheConfig>;
  monitoring?: Partial<PerformanceConfig>;

  // Security
  security?: Partial<SecurityConfig>;

  // Resilience
  retry?: Partial<V2RetryConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  health?: Partial<HealthConfig>;

  // Advanced
  providers?: MultiProviderConfig;
  sso?: SSOConfig;
  offline?: OfflineConfig;
  debugMode?: boolean;
  analytics?: AnalyticsConfig;
}
```

### V2RequestConfig

```typescript
interface V2RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  baseURL?: string;
  cache?: {
    enabled?: boolean;
    ttl?: number;
    key?: string;
  };
  retry?: Partial<V2RetryConfig>;
  bypassCircuitBreaker?: boolean;
  offlineCache?: boolean;
  analytics?: Record<string, any>;
}
```

### CacheConfig

```typescript
interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxSize: number;
  strategies: Map<string, CacheStrategy>;
}
```

### PerformanceConfig

```typescript
interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number;
  maxSamples: number;
  aggregationInterval: number;
  slowThreshold: number;
  onMetrics?: (metrics: AggregatedMetrics) => void;
}
```

### SecurityConfig

```typescript
interface SecurityConfig {
  encryptTokens: boolean;
  encryptionKey?: string;
  csrf: {
    enabled: boolean;
    tokenEndpoint?: string;
    headerName?: string;
    cookieName?: string;
  };
  requestSigning: {
    enabled: boolean;
    algorithm?: 'HMAC-SHA256';
    secretKey?: string;
    includeHeaders?: string[];
  };
}
```

### CircuitBreakerConfig

```typescript
interface CircuitBreakerConfig {
  threshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  minimumRequests: number;
}
```

### HealthConfig

```typescript
interface HealthConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  timeout?: number;
  onStatusChange?: (isHealthy: boolean) => void;
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
- `FORBIDDEN` - Request is forbidden
- `SERVER_ERROR` - Server-side error occurred

## Testing Utilities

### mockAuthClient(overrides?)

Creates a mock AuthFlow client for testing.

**Parameters:**

- `overrides` (object, optional) - Properties to override

**Returns:** Mock AuthFlowV2Client

```typescript
import { mockAuthClient } from '@jmndao/auth-flow/testing';

const mockAuth = mockAuthClient({
  isAuthenticated: () => true,
  getTokens: () =>
    Promise.resolve({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    }),
});
```
