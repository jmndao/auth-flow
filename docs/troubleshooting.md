# Troubleshooting Guide

Common issues and solutions for AuthFlow.

## Cookie Issues

### Problem: Cookies not being set or read

**Solution**: Use the diagnostic tool:

```typescript
import { diagnoseCookieIssues } from '@jmndao/auth-flow';

await diagnoseCookieIssues(
  { email: 'test@example.com', password: 'password' },
  {
    baseURL: 'https://api.example.com',
    tokenSource: 'cookies',
  }
);
```

**Common fixes**:

- Set `waitForCookies: 500` to allow cookie propagation time
- Enable `fallbackToBody: true` for immediate token access
- Use `debugMode: true` to see detailed cookie operations

### Problem: Cookies work in browser but not in SSR

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      retryCount: 3,
    },
  },
});
```

## Token Refresh Issues

### Problem: Token refresh failing

**Check these**:

1. Verify refresh endpoint returns new tokens
2. Check token field names match your API
3. Ensure refresh token is being stored

```typescript
// Debug token refresh
const auth = createAuthFlow({
  // ... config
  onTokenRefresh: (tokens) => console.log('New tokens:', tokens),
  onAuthError: (error) => console.error('Auth error:', error),
});
```

### Problem: Race conditions during token refresh

AuthFlow automatically handles this, but if you're still seeing issues:

```typescript
// Use v2.x with enhanced request queuing
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';
const auth = createAuthFlowV2(config);
```

## Network Issues

### Problem: Requests failing in unreliable networks

**Solution**: Use resilient configuration:

```typescript
import { createResilientAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createResilientAuthFlow('https://api.example.com');
// Includes retry logic, circuit breaker, and health monitoring
```

### Problem: Slow API responses

**Solution**: Enable caching and monitoring:

```typescript
import { createPerformantAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createPerformantAuthFlow('https://api.example.com');

// Monitor performance
const metrics = auth.getPerformanceMetrics();
console.log('Average response time:', metrics.averageResponseTime);
```

## Configuration Issues

### Problem: "Endpoints configuration is required" error

**Old way** (requires manual config):

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
  tokens: { access: 'accessToken', refresh: 'refreshToken' },
});
```

**Easy way** (automatic defaults):

```typescript
const auth = createAuthFlow('https://api.example.com');
// Automatically uses /auth/login, /auth/refresh, accessToken, refreshToken
```

### Problem: TypeScript errors

Make sure you're importing from the correct path:

```typescript
// v1.x
import { createAuthFlow } from '@jmndao/auth-flow';

// v2.x
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

// Testing
import { mockAuthClient } from '@jmndao/auth-flow/testing';
```

## Performance Issues

### Problem: Too many requests being made

**Solution**: Enable caching in v2.x:

```typescript
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  caching: {
    enabled: true,
    defaultTTL: 300000, // 5 minutes
    strategies: new Map([
      ['/api/users', { ttl: 600000 }], // 10 minutes for user data
    ]),
  },
});
```

### Problem: Memory leaks

**Solution**: Clean up when done:

```typescript
// When component unmounts or app closes
auth.destroy();
```

## Debugging Tools

### Get debug information (v2.x only)

```typescript
const debugInfo = auth.getDebugInfo();
console.log({
  isAuthenticated: debugInfo.authState.isAuthenticated,
  cacheHitRate: debugInfo.performance.cacheHitRate,
  healthStatus: debugInfo.health.isHealthy,
  activeFeatures: debugInfo.features,
});
```

### Monitor request performance

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
});
```

## Environment-Specific Issues

### Next.js

```typescript
// pages/api/auth/[...nextauth].ts
const auth = createAuthFlow(
  {
    baseURL: process.env.API_URL,
    tokenSource: 'cookies',
    storage: {
      type: 'cookies',
      options: {
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  { req, res }
);
```

### React Native

```typescript
// Use memory storage for React Native
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'memory',
});
```

### Electron

```typescript
// Works the same as browser
const auth = createAuthFlow('https://api.example.com');
```

## Still Having Issues?

1. **Enable debug mode** to see detailed logs
2. **Check the console** for error messages
3. **Verify your API** returns tokens in the expected format
4. **Test with a simple setup** first, then add complexity
5. **Open an issue** on GitHub with your configuration and error details

## Common API Response Formats

AuthFlow expects these token formats:

**Body tokens** (default):

```json
{
  "accessToken": "jwt-token-here",
  "refreshToken": "refresh-token-here",
  "user": { "id": 1, "name": "User" }
}
```

**Custom field names**:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokens: {
    access: 'access_token', // matches your API
    refresh: 'refresh_token',
  },
});
```

**Cookies**: Tokens should be set as httpOnly cookies with the configured names.
