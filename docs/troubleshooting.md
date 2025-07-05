# Troubleshooting Guide

Common issues and solutions for AuthFlow.

## Configuration Issues

### Problem: "Login endpoint is required" error

**Cause**: Missing required configuration.

**Solution**: Provide complete configuration:

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

### Problem: "Both access and refresh token field names are required"

**Cause**: Missing tokens configuration.

**Solution**: Specify token field names that match your API:

```typescript
const auth = createAuthFlow({
  // ... other config
  tokens: {
    access: 'access_token', // matches your API response
    refresh: 'refresh_token',
  },
});
```

## Cookie Issues

### Problem: Cookies not being set or read

**Solution**: Use proper cookie configuration:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      waitForCookies: 500,
      retryCount: 3,
    },
  },
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
  tokens: { access: 'accessToken', refresh: 'refreshToken' },
});
```

**Common fixes**:

- Set `waitForCookies: 500` to allow cookie propagation time
- Use `retryCount: 3` for cookie reading retries
- Ensure your API sets cookies correctly

### Problem: Cookies work in browser but not in SSR

**Solution**: Provide server context for Next.js:

```typescript
// Server components
import { cookies } from 'next/headers';

const cookieStore = await cookies();
const auth = createAuthFlow(config, {
  cookies: () => cookieStore,
  cookieSetter: (name, value, options) => {
    cookieStore.set(name, value, options);
  },
});
```

### Problem: Next.js middleware requires context

**Cause**: Middleware needs Next.js environment.

**Solution**: Use the middleware helper:

```typescript
import { createAuthMiddleware } from '@jmndao/auth-flow/middleware';

export default createAuthMiddleware(authFlow, {
  redirectUrl: '/login',
  publicPaths: ['/login', '/register'],
});
```

See [Middleware Setup Guide](./middleware-setup.md) for complete instructions.

## Token Management Issues

### Problem: Token refresh failing

**Check these**:

1. Verify refresh endpoint returns correct token fields
2. Check token field names match your API
3. Ensure refresh token is being stored

```typescript
const auth = createAuthFlow({
  // ... config
  onTokenRefresh: (tokens) => console.log('New tokens:', tokens),
  onAuthError: (error) => console.error('Auth error:', error),
});
```

### Problem: "accessToken must be a non-empty string"

**Cause**: Trying to set empty or invalid tokens.

**Solution**: Ensure tokens are valid strings:

```typescript
// Correct
await auth.setTokens({
  accessToken: 'valid-token-string',
  refreshToken: 'valid-refresh-string',
});

// Incorrect - will throw error
await auth.setTokens({
  accessToken: '', // Empty string
  refreshToken: 'valid-refresh',
});
```

### Problem: hasValidTokens() always returns false

**Cause**: Token validation logic issues.

**Solution**: Check token format and expiration:

```typescript
// For JWT tokens, ensure they have proper structure
const tokens = await auth.getTokens();
console.log('Tokens:', tokens);

// For simple string tokens, ensure they're non-empty
const hasTokens = await auth.hasValidTokens();
console.log('Has valid tokens:', hasTokens);
```

## Network Issues

### Problem: Requests failing in unreliable networks

**Solution**: Use resilient configuration (V2):

```typescript
import { createResilientAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createResilientAuthFlow('https://api.example.com');
// Includes retry logic, circuit breaker, and health monitoring
```

### Problem: Slow API responses

**Solution**: Enable caching and monitoring (V2):

```typescript
import { createPerformantAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createPerformantAuthFlow('https://api.example.com');

// Monitor performance
const metrics = auth.getPerformanceMetrics();
console.log('Average response time:', metrics.averageResponseTime);
```

## Framework-Specific Issues

### Next.js App Router

**Problem**: Server components can't access cookies properly.

**Solution**: Use Next.js cookie helpers:

```typescript
// app/profile/page.tsx
import { cookies } from 'next/headers';
import { createAuthFlow } from '@jmndao/auth-flow';

export default async function ProfilePage() {
  const cookieStore = await cookies();

  const auth = createAuthFlow(config, {
    cookies: () => cookieStore,
  });

  if (!auth.isAuthenticated()) {
    redirect('/login');
  }

  // ... rest of component
}
```

**Problem**: Server actions not setting cookies.

**Solution**: Provide cookie setter:

```typescript
// app/actions.ts
import { cookies } from 'next/headers';

export async function loginAction(formData: FormData) {
  const cookieStore = await cookies();

  const auth = createAuthFlow(config, {
    cookies: () => cookieStore,
    cookieSetter: (name, value, options) => {
      cookieStore.set(name, value, options);
    },
  });

  return await auth.login(credentials);
}
```

### React Native

**Problem**: Storage not working.

**Solution**: Use memory storage or custom adapter:

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'memory', // Use memory storage
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
  tokens: { access: 'accessToken', refresh: 'refreshToken' },
});
```

### Express.js

**Problem**: Middleware not working with cookies.

**Solution**: Provide req/res context:

```typescript
app.use((req, res, next) => {
  const auth = createAuthFlow(config, { req, res });
  req.auth = auth;
  next();
});
```

## TypeScript Issues

### Problem: Type errors with imports

**Solution**: Use correct import paths:

```typescript
// V1 client
import { createAuthFlow } from '@jmndao/auth-flow';

// V2 client
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

// Middleware
import { createAuthMiddleware } from '@jmndao/auth-flow/middleware';

// Types
import type { AuthFlowConfig, TokenPair } from '@jmndao/auth-flow';
```

### Problem: Context type errors

**Solution**: Use proper typing:

```typescript
import type { AuthContext } from '@jmndao/auth-flow';

const context: AuthContext = {
  req: request,
  res: response,
  cookies: async () => await cookies(),
};
```

## Performance Issues

### Problem: Too many requests being made

**Solution**: Enable caching (V2):

```typescript
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  caching: {
    enabled: true,
    defaultTTL: 300000, // 5 minutes
  },
});

// Check cache stats
const stats = auth.getCacheStats();
console.log('Cache hit rate:', stats.hitRate);
```

### Problem: Memory leaks

**Solution**: Clean up properly:

```typescript
// For V2 clients
useEffect(() => {
  return () => {
    auth.destroy(); // Cleanup resources
  };
}, []);

// Or manually
auth.clearPerformanceMetrics();
auth.clearCache();
```

## API Response Format Issues

### Problem: Tokens not found in response

**Cause**: API response doesn't match expected format.

**Your API should return**:

```json
{
  "accessToken": "jwt-token-here",
  "refreshToken": "refresh-token-here",
  "user": { "id": 1, "name": "User" }
}
```

**If your API uses different field names**:

```typescript
const auth = createAuthFlow({
  // ... other config
  tokens: {
    access: 'access_token', // matches your API
    refresh: 'refresh_token',
  },
});
```

### Problem: Cookie-based auth not working

**Your API should set cookies**:

```javascript
// Server response
res.setHeader('Set-Cookie', [
  `accessToken=${accessToken}; Path=/; SameSite=Lax; Secure; Max-Age=3600`,
  `refreshToken=${refreshToken}; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=604800`,
]);
```

## Debugging Tools

### Get debug information (V2 only)

```typescript
const auth = createAuthFlowV2(config);

// Enable debug mode
auth.enableDebugMode();

// Get comprehensive debug info
const debugInfo = auth.getDebugInfo();
console.log({
  isAuthenticated: debugInfo.authState.isAuthenticated,
  hasTokens: debugInfo.authState.hasTokens,
  cacheHitRate: debugInfo.performance.cacheHitRate,
  healthStatus: debugInfo.health.isHealthy,
  activeFeatures: debugInfo.features,
});
```

### Monitor performance

```typescript
const metrics = auth.getPerformanceMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successRate: metrics.successRate,
  averageResponseTime: metrics.averageResponseTime,
});
```

### Check cache status

```typescript
const cacheStats = auth.getCacheStats();
console.log({
  cacheSize: cacheStats.size,
  hitRate: cacheStats.hitRate,
  maxSize: cacheStats.maxSize,
});
```

### Health monitoring

```typescript
const health = auth.getHealthStatus();
console.log({
  isHealthy: health.isHealthy,
  lastCheckTime: health.lastCheckTime,
  responseTime: health.responseTime,
});
```

## Environment-Specific Debugging

### Enable development logging

```typescript
// For V2 development
import { createDevAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createDevAuthFlow('https://api.example.com');
// Automatically enables detailed logging
```

### Test cookie functionality

```typescript
import { diagnoseCookieIssues } from '@jmndao/auth-flow';

// Test cookie setup
const result = await diagnoseCookieIssues(
  { email: 'test@example.com', password: 'password' },
  {
    baseURL: 'https://api.example.com',
    tokenSource: 'cookies',
    storage: { type: 'cookies' },
    endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
    tokens: { access: 'accessToken', refresh: 'refreshToken' },
  }
);

console.log('Cookie test result:', result);
```

## Common Error Messages

### "createAuthMiddleware requires Next.js environment"

**Cause**: Trying to use middleware outside Next.js.

**Solution**: Only use middleware in Next.js projects, or check environment:

```typescript
if (typeof window === 'undefined' && process.env.NEXT_RUNTIME) {
  // Safe to use Next.js middleware
  const middleware = createAuthMiddleware(authFlow, config);
}
```

### "No refresh token available"

**Cause**: Refresh token missing or expired.

**Solution**: Check token storage and API response:

```typescript
const tokens = await auth.getTokens();
console.log('Current tokens:', tokens);

if (!tokens?.refreshToken) {
  // Redirect to login
  window.location.href = '/login';
}
```

### "Storage error"

**Cause**: Storage adapter failing.

**Solution**: Handle storage errors gracefully:

```typescript
try {
  await auth.setTokens(tokens);
} catch (error) {
  console.error('Failed to store tokens:', error);
  // Fallback to memory storage
  const fallbackAuth = createAuthFlow({
    ...config,
    storage: 'memory',
  });
}
```

## Best Practices for Debugging

1. **Start simple**: Use basic configuration first, then add complexity
2. **Check network tab**: Verify API requests and responses
3. **Enable logging**: Use debug mode in development
4. **Test incrementally**: Test authentication, then requests, then advanced features
5. **Verify API format**: Ensure your API returns expected token format

## Getting Help

If you're still having issues:

1. **Enable debug mode** and check console logs
2. **Verify API responses** match expected format
3. **Test with minimal configuration** first
4. **Check framework-specific setup** in examples
5. **Open GitHub issue** with configuration and error details

## Environment Configuration Examples

### Development

```typescript
const auth = createAuthFlow({
  baseURL: 'http://localhost:3001',
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
  tokens: { access: 'accessToken', refresh: 'refreshToken' },
  // Add debug logging in development
  onAuthError: (error) => console.error('Auth error:', error),
  onTokenRefresh: (tokens) => console.log('Tokens refreshed:', !!tokens),
});
```

### Production

```typescript
const auth = createAuthFlow({
  baseURL: process.env.API_URL,
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      secure: true,
      sameSite: 'strict',
      httpOnly: false, // Allow client access if needed
    },
  },
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
  tokens: { access: 'accessToken', refresh: 'refreshToken' },
  timeout: 10000,
});
```
