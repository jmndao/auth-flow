# Advanced Usage

## Custom Storage Adapters

### Redis Storage Adapter

```typescript
import { StorageAdapter } from '@jmndao/auth-flow';

class RedisStorageAdapter implements StorageAdapter {
  private redis: any;

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value, 'EX', 86400); // 24 hour expiry
  }

  async remove(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }
}

// Usage
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: new RedisStorageAdapter(redisClient),
});
```

### Database Storage Adapter

```typescript
class DatabaseStorageAdapter implements StorageAdapter {
  private db: any;
  private userId: string;

  constructor(database: any, userId: string) {
    this.db = database;
    this.userId = userId;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.db.query(
      'SELECT value FROM user_tokens WHERE user_id = ? AND key = ?',
      [this.userId, key]
    );
    return result[0]?.value || null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.query(
      'INSERT INTO user_tokens (user_id, key, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [this.userId, key, value, value]
    );
  }

  async remove(key: string): Promise<void> {
    await this.db.query('DELETE FROM user_tokens WHERE user_id = ? AND key = ?', [
      this.userId,
      key,
    ]);
  }

  async clear(): Promise<void> {
    await this.db.query('DELETE FROM user_tokens WHERE user_id = ?', [this.userId]);
  }
}
```

## Multiple Authentication Clients

### Multi-API Configuration

```typescript
// Main application API
const mainAuth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'localStorage',
  onAuthError: (error) => {
    if (error.status === 401) {
      // Clear all auth clients and redirect
      analyticsAuth.clearTokens();
      paymentsAuth.clearTokens();
      window.location.href = '/login';
    }
  },
});

// Analytics API with different auth
const analyticsAuth = createAuthFlow({
  baseURL: 'https://analytics.example.com',
  endpoints: {
    login: '/analytics/auth/login',
    refresh: '/analytics/auth/refresh',
  },
  tokens: {
    access: 'token',
    refresh: 'refreshToken',
  },
  storage: 'memory', // Separate storage
});

// Payments API with API key
const paymentsAuth = createSingleTokenAuth({
  baseURL: 'https://payments.example.com',
  token: { access: 'apiKey' },
  endpoints: { login: '/auth/api-key' },
});

// Usage
const userData = await mainAuth.get('/user/profile');
const analytics = await analyticsAuth.get('/user/analytics');
const transactions = await paymentsAuth.get('/transactions');
```

### Cross-Client Token Sharing

```typescript
class SharedTokenManager {
  private clients: Map<string, any> = new Map();

  register(name: string, client: any) {
    this.clients.set(name, client);
  }

  async loginAll(credentials: any) {
    const results = new Map();

    for (const [name, client] of this.clients) {
      try {
        const result = await client.login(credentials);
        results.set(name, result);
      } catch (error) {
        console.error(`Login failed for ${name}:`, error);
      }
    }

    return results;
  }

  async logoutAll() {
    for (const [name, client] of this.clients) {
      try {
        await client.logout();
      } catch (error) {
        console.error(`Logout failed for ${name}:`, error);
      }
    }
  }
}

// Usage
const tokenManager = new SharedTokenManager();
tokenManager.register('main', mainAuth);
tokenManager.register('analytics', analyticsAuth);

await tokenManager.loginAll(credentials);
```

## Request Interceptors

### Global Request Headers

```typescript
const auth = createAuthFlow('https://api.example.com');

// Add custom headers to all requests
auth.axiosInstance.interceptors.request.use((config) => {
  config.headers['X-API-Version'] = '2.0';
  config.headers['X-Client-ID'] = getClientId();
  config.headers['X-Request-ID'] = generateRequestId();
  config.headers['X-Timestamp'] = Date.now().toString();

  return config;
});
```

### Request/Response Logging

```typescript
auth.axiosInstance.interceptors.request.use((config) => {
  console.log(`[REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

auth.axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`[RESPONSE] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`[ERROR] ${error.response?.status} ${error.config?.url}`);
    return Promise.reject(error);
  }
);
```

### Rate Limiting

```typescript
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.checkLimit();
    }

    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter(50, 60000); // 50 requests per minute

auth.axiosInstance.interceptors.request.use(async (config) => {
  await rateLimiter.checkLimit();
  return config;
});
```

## Advanced Error Handling

### Retry with Exponential Backoff

```typescript
class AdvancedRetryHandler {
  private maxRetries: number;
  private baseDelay: number;

  constructor(maxRetries: number = 3, baseDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on auth errors
        if (error.status === 401 || error.status === 403) {
          throw error;
        }

        // Don't retry on client errors (except timeout)
        if (error.status >= 400 && error.status < 500 && error.status !== 408) {
          throw error;
        }

        // Wait before retry
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

const retryHandler = new AdvancedRetryHandler();

// Wrap API calls with retry logic
const fetchUserData = () => retryHandler.execute(() => auth.get('/user/profile'));
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures: number = 0;
  private lastFailTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

const circuitBreaker = new CircuitBreaker();
const safeApiCall = (endpoint: string) => circuitBreaker.execute(() => auth.get(endpoint));
```

## Token Management

### Token Validation

```typescript
class TokenValidator {
  static isJWTExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  static getTokenExpiry(token: string): Date | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  }

  static getTokenPayload(token: string): any {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }
}

// Usage
const tokens = await auth.getTokens();
if (tokens) {
  const isExpired = TokenValidator.isJWTExpired(tokens.accessToken);
  const expiry = TokenValidator.getTokenExpiry(tokens.accessToken);
  const payload = TokenValidator.getTokenPayload(tokens.accessToken);

  console.log('Token expired:', isExpired);
  console.log('Token expires at:', expiry);
  console.log('User ID from token:', payload?.sub);
}
```

### Proactive Token Refresh

```typescript
class ProactiveTokenManager {
  private auth: any;
  private refreshTimer?: NodeJS.Timeout;

  constructor(authClient: any) {
    this.auth = authClient;
  }

  start() {
    this.scheduleNextRefresh();
  }

  stop() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  private async scheduleNextRefresh() {
    const tokens = await this.auth.getTokens();

    if (!tokens) return;

    const expiry = TokenValidator.getTokenExpiry(tokens.accessToken);
    if (!expiry) return;

    // Refresh 5 minutes before expiry
    const refreshTime = expiry.getTime() - Date.now() - 5 * 60 * 1000;

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.auth.refreshTokens();
          this.scheduleNextRefresh();
        } catch (error) {
          console.error('Proactive token refresh failed:', error);
        }
      }, refreshTime);
    }
  }
}

// Usage
const tokenManager = new ProactiveTokenManager(auth);
tokenManager.start();
```

## Performance Optimization

### Request Caching

```typescript
class RequestCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 300000) {
    // 5 minutes
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const requestCache = new RequestCache();

// Cached GET requests
const cachedGet = async (url: string, ttl?: number) => {
  const cached = requestCache.get(url);
  if (cached) return cached;

  const response = await auth.get(url);
  requestCache.set(url, response, ttl);

  return response;
};

// Usage
const userData = await cachedGet('/user/profile', 600000); // Cache for 10 minutes
```

### Request Deduplication

```typescript
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = operation().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

const deduplicator = new RequestDeduplicator();

// Deduplicated requests
const getProfile = () => deduplicator.execute('user-profile', () => auth.get('/user/profile'));

// Multiple calls will only make one request
Promise.all([getProfile(), getProfile(), getProfile()]);
```

## Security Enhancements

### Token Encryption

```typescript
import CryptoJS from 'crypto-js';

class EncryptedStorageAdapter implements StorageAdapter {
  private adapter: StorageAdapter;
  private secretKey: string;

  constructor(adapter: StorageAdapter, secretKey: string) {
    this.adapter = adapter;
    this.secretKey = secretKey;
  }

  async get(key: string): Promise<string | null> {
    const encrypted = await this.adapter.get(key);
    if (!encrypted) return null;

    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, this.secretKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const encrypted = CryptoJS.AES.encrypt(value, this.secretKey).toString();
    await this.adapter.set(key, encrypted);
  }

  async remove(key: string): Promise<void> {
    await this.adapter.remove(key);
  }

  async clear(): Promise<void> {
    await this.adapter.clear();
  }
}

// Usage
const encryptedStorage = new EncryptedStorageAdapter(
  new LocalStorageAdapter(),
  process.env.ENCRYPTION_KEY
);

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: encryptedStorage,
});
```

### CSRF Protection

```typescript
class CSRFTokenManager {
  private token: string | null = null;

  async getToken(): Promise<string> {
    if (!this.token) {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      this.token = data.csrfToken;
    }
    return this.token;
  }

  invalidate(): void {
    this.token = null;
  }
}

const csrfManager = new CSRFTokenManager();

auth.axiosInstance.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    const csrfToken = await csrfManager.getToken();
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Invalidate CSRF token on 403 responses
auth.axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      csrfManager.invalidate();
    }
    return Promise.reject(error);
  }
);
```

## Monitoring and Analytics

### Request Metrics

```typescript
class RequestMetrics {
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    responseTimeSamples: [] as number[],
  };

  recordRequest(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.responseTimeSamples.push(responseTime);

    // Keep only last 100 samples
    if (this.metrics.responseTimeSamples.length > 100) {
      this.metrics.responseTimeSamples.shift();
    }

    this.metrics.averageResponseTime =
      this.metrics.responseTimeSamples.reduce((a, b) => a + b, 0) /
      this.metrics.responseTimeSamples.length;
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulRequests / this.metrics.totalRequests,
    };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimeSamples: [],
    };
  }
}

const metrics = new RequestMetrics();

auth.axiosInstance.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  return config;
});

auth.axiosInstance.interceptors.response.use(
  (response) => {
    const responseTime = Date.now() - response.config.metadata.startTime;
    metrics.recordRequest(true, responseTime);
    return response;
  },
  (error) => {
    const responseTime = Date.now() - error.config?.metadata?.startTime;
    metrics.recordRequest(false, responseTime);
    return Promise.reject(error);
  }
);
```

### Health Monitoring

```typescript
class HealthMonitor {
  private isHealthy = true;
  private lastHealthCheck = Date.now();
  private healthCheckInterval: NodeJS.Timeout;

  constructor(
    private auth: any,
    private interval: number = 60000
  ) {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      await this.auth.get('/health');
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
    } catch (error) {
      this.isHealthy = false;
      console.warn('Health check failed:', error);
    }
  }

  getStatus() {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: new Date(this.lastHealthCheck),
      timeSinceLastCheck: Date.now() - this.lastHealthCheck,
    };
  }

  destroy(): void {
    clearInterval(this.healthCheckInterval);
  }
}

const healthMonitor = new HealthMonitor(auth);
```

## Testing Utilities

### Mock Auth Client

```typescript
class MockAuthClient {
  private tokens: TokenPair | null = null;
  private mockUser: any = null;

  async login(credentials: any): Promise<any> {
    if (credentials.username === 'test' && credentials.password === 'password') {
      this.tokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
      this.mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
      return this.mockUser;
    }
    throw new Error('Invalid credentials');
  }

  async logout(): Promise<void> {
    this.tokens = null;
    this.mockUser = null;
  }

  isAuthenticated(): boolean {
    return !!this.tokens;
  }

  async hasValidTokens(): Promise<boolean> {
    return !!this.tokens;
  }

  async getTokens(): Promise<TokenPair | null> {
    return this.tokens;
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    this.tokens = tokens;
  }

  async clearTokens(): Promise<void> {
    this.tokens = null;
  }

  async get<T>(url: string): Promise<{ data: T }> {
    if (!this.tokens) throw new Error('Unauthorized');

    // Mock responses based on URL
    if (url === '/user/profile') {
      return { data: this.mockUser as T };
    }

    return { data: { mockData: true } as T };
  }

  async post<T>(url: string, data?: any): Promise<{ data: T }> {
    if (!this.tokens) throw new Error('Unauthorized');
    return { data: { success: true, ...data } as T };
  }

  // Implement other HTTP methods similarly...
}

// Usage in tests
const mockAuth = new MockAuthClient();
```

### Integration Test Helpers

```typescript
class AuthTestHelper {
  private auth: any;

  constructor(baseURL: string) {
    this.auth = createAuthFlow({
      baseURL,
      storage: new MemoryStorageAdapter(),
      timeout: 5000,
    });
  }

  async loginAsUser(userType: 'admin' | 'user' | 'guest' = 'user'): Promise<any> {
    const credentials = {
      admin: { username: 'admin', password: 'admin123' },
      user: { username: 'user', password: 'user123' },
      guest: { username: 'guest', password: 'guest123' },
    };

    return await this.auth.login(credentials[userType]);
  }

  async setupAuthenticatedRequest(): Promise<any> {
    await this.loginAsUser();
    return this.auth;
  }

  async expectUnauthorized(operation: () => Promise<any>): Promise<void> {
    try {
      await operation();
      throw new Error('Expected unauthorized error');
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }
    }
  }

  async cleanup(): Promise<void> {
    await this.auth.logout();
    await this.auth.clearTokens();
  }
}

// Usage in tests
describe('API Integration Tests', () => {
  let testHelper: AuthTestHelper;

  beforeEach(() => {
    testHelper = new AuthTestHelper('http://localhost:3001');
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  it('should access protected resource when authenticated', async () => {
    const auth = await testHelper.setupAuthenticatedRequest();
    const response = await auth.get('/protected-resource');
    expect(response.data).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    await testHelper.expectUnauthorized(() => testHelper.auth.get('/protected-resource'));
  });
});
```

## Production Deployment

### Environment Configuration

```typescript
class EnvironmentConfig {
  static getAuthConfig() {
    const env = process.env.NODE_ENV;
    const isDev = env === 'development';
    const isTest = env === 'test';
    const isProd = env === 'production';

    return {
      baseURL:
        process.env.API_BASE_URL || (isDev ? 'http://localhost:3001' : 'https://api.example.com'),

      storage: isProd
        ? {
            type: 'cookies',
            options: {
              secure: true,
              sameSite: 'strict',
              httpOnly: true,
              waitForCookies: 1000,
              retryCount: 5,
            },
          }
        : 'localStorage',

      timeout: isProd ? 10000 : isDev ? 30000 : 5000,

      retry: {
        attempts: isProd ? 3 : 1,
        delay: isProd ? 1000 : 500,
      },

      onAuthError: isProd
        ? (error) => {
            // Production error handling
            analytics.track('auth_error', {
              status: error.status,
              code: error.code,
              url: window.location.pathname,
            });
          }
        : (error) => {
            console.warn('Auth error:', error);
          },
    };
  }
}

export const auth = createAuthFlow(EnvironmentConfig.getAuthConfig());
```

### Error Boundary Integration

```typescript
// React Error Boundary for auth errors
class AuthErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    if (error.status === 401 || error.status === 403) {
      return { hasError: true, error };
    }
    return null;
  }

  componentDidCatch(error, errorInfo) {
    if (error.status === 401) {
      // Clear auth state and redirect
      auth.clearTokens();
      window.location.href = '/login';
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Authentication Error</h2>
          <p>Please login again to continue.</p>
          <button onClick={() => window.location.href = '/login'}>
            Go to Login
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```
