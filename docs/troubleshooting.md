# Troubleshooting Guide

## Common Issues

### Authentication Errors

#### Login Fails with "Tokens not found in response"

**Problem:** The API response doesn't contain the expected token fields.

**Solution:**

1. Check your API response format
2. Configure custom token field names:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokens: {
    access: 'access_token', // Match your API response
    refresh: 'refresh_token',
  },
});
```

#### Token Refresh Fails

**Problem:** Automatic token refresh is not working.

**Solutions:**

1. Verify refresh endpoint is correct
2. Check refresh token is being stored
3. Ensure refresh token hasn't expired

```typescript
// Check token status
const tokens = await auth.getTokens();
if (tokens) {
  console.log('Has tokens:', Boolean(tokens));
  // Manual token validation (for JWT)
  console.log('Access token expired:', auth.tokenManager?.isTokenExpired(tokens.accessToken));
}
```

### Storage Issues

#### Tokens Not Persisting

**Problem:** Tokens are lost on page refresh.

**Solutions:**

1. Check storage configuration:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'browser', // Use localStorage instead of memory
});
```

2. For server-side rendering, use cookies:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'cookies',
});
```

#### Cookie Storage Not Working

**Problem:** Cookies are not being set in server environments.

**Solutions:**

1. Ensure you're in the right context for Next.js:

```typescript
// In server actions
'use server';
import { createServerActionAuth } from '@jmndao/auth-flow/frameworks/nextjs';

const auth = createServerActionAuth({
  baseURL: 'https://api.example.com',
});
```

2. Use diagnostic tools:

```typescript
import { diagnose } from '@jmndao/auth-flow/diagnostics';

const report = await diagnose({
  baseURL: 'https://api.example.com',
  storage: 'cookies',
});
console.log('Issues:', report.issues);
console.log('Fixes:', report.fixes);
```

### Next.js Specific Issues

#### Cookies Not Set in Server Components

**Problem:** Cannot set cookies directly in Next.js server components.

**Solution:** Use server actions instead:

```typescript
// Wrong: Direct cookie setting in server component
export default async function Page() {
  const auth = createAuthFlow({ storage: 'cookies' });
  // This won't work
}

// Correct: Use server actions
('use server');
async function loginAction(formData: FormData) {
  const auth = createServerActionAuth({
    baseURL: 'https://api.example.com',
  });
  await auth.login(credentials);
}
```

#### Middleware Authentication Issues

**Problem:** Middleware is not properly authenticating requests.

**Solution:**

```typescript
// middleware.ts
import { createAuthMiddleware } from '@jmndao/auth-flow/frameworks/nextjs';

export default createAuthMiddleware({
  publicPaths: ['/login', '/register', '/api/public/*'],
  loginUrl: '/login',
});

// Make sure matcher is configured
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Network Issues

#### CORS Errors

**Problem:** Cross-origin requests are being blocked.

**Solutions:**

1. Configure CORS on your API server
2. Use a proxy in development
3. Check your API endpoints

#### Request Timeouts

**Problem:** Requests are timing out.

**Solution:**

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  timeout: 30000, // Increase timeout to 30 seconds
  retry: {
    attempts: 5, // Increase retry attempts
    delay: 2000, // Increase delay between retries
  },
});
```

## Diagnostic Tools

### Built-in Diagnostics

Use the diagnostic tools to identify issues:

```typescript
import { diagnose, healthCheck, validateConfig } from '@jmndao/auth-flow/diagnostics';

// Full diagnostic
const report = await diagnose({
  baseURL: 'https://api.example.com',
});

// Quick health check
const health = await healthCheck({
  baseURL: 'https://api.example.com',
});

// Configuration validation
const issues = validateConfig({
  baseURL: 'https://api.example.com',
  storage: 'invalid', // This would be caught
});
```

### Manual Debugging

#### Check Authentication State

```typescript
// Check if user is authenticated
console.log('Authenticated:', auth.isAuthenticated());

// Check stored tokens
const tokens = await auth.getTokens();
console.log('Tokens:', tokens);

// Check token expiration (for JWT tokens)
if (tokens?.accessToken) {
  const isExpired = auth.tokenManager?.isTokenExpired(tokens.accessToken);
  console.log('Access token expired:', isExpired);
}
```

#### Test Storage

```typescript
// Test storage functionality
try {
  await auth.setTokens({
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
  });

  const retrieved = await auth.getTokens();
  console.log('Storage working:', retrieved !== null);

  await auth.clearTokens();
} catch (error) {
  console.error('Storage error:', error);
}
```

#### Test API Connectivity

```typescript
// Test basic connectivity
try {
  const response = await fetch('https://api.example.com/health');
  console.log('API reachable:', response.ok);
} catch (error) {
  console.error('API connectivity error:', error);
}
```

## Environment-Specific Solutions

### Browser Applications

```typescript
// Recommended configuration for SPAs
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'browser', // Uses localStorage with sessionStorage fallback
  timeout: 10000,
  retry: {
    attempts: 3,
    delay: 1000,
  },
});
```

### Server-Side Applications

```typescript
// Recommended configuration for SSR
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'cookies', // Persistent across requests
  timeout: 15000,
  retry: {
    attempts: 2,
    delay: 2000,
  },
});
```

### Development Environment

```typescript
// Use development preset with verbose logging
import { createDevAuth } from '@jmndao/auth-flow/presets';

const auth = createDevAuth('https://api.example.com');
// Automatically includes:
// - Extended timeouts
// - More retry attempts
// - Console logging of token refresh and errors
```

### Production Environment

```typescript
// Use production preset with optimized settings
import { createProductionAuth } from '@jmndao/auth-flow/presets';

const auth = createProductionAuth('https://api.example.com');
// Automatically includes:
// - Shorter timeouts
// - Fewer retry attempts
// - No console logging
```

## Getting Help

### Check Configuration

Run the configuration validator to catch common issues:

```typescript
import { validateConfig } from '@jmndao/auth-flow/diagnostics';

const issues = validateConfig({
  baseURL: 'https://api.example.com',
  // ... your configuration
});

if (issues.length > 0) {
  console.log('Configuration issues found:');
  issues.forEach((issue) => {
    console.log(`${issue.severity}: ${issue.description}`);
    console.log(`Solution: ${issue.solution}`);
  });
}
```

### Enable Debug Mode

For development, you can enable verbose logging:

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed:', new Date().toISOString());
  },
  onAuthError: (error) => {
    console.error('Auth error:', error);
  },
  onLogout: () => {
    console.log('User logged out:', new Date().toISOString());
  },
});
```

### Report Issues

If you encounter issues not covered in this guide:

1. Run the diagnostic tool and include the output
2. Provide your configuration (without sensitive data)
3. Include browser/Node.js version information
4. Describe the expected vs actual behavior

```typescript
// Generate debug information
const debugInfo = await diagnose(yourConfig);
console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
```
