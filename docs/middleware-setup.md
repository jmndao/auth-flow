# Middleware Setup Guide

This guide shows how to set up AuthFlow middleware for route protection in Next.js applications.

## Prerequisites

- Next.js 13+ with App Router or Pages Router
- AuthFlow installed and configured
- Next.js middleware file (`middleware.ts`)

## Basic Setup

### 1. Create AuthFlow Instance

First, create your AuthFlow instance with cookie-based authentication:

```typescript
// lib/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';

export const authConfig = {
  baseURL: process.env.API_URL || 'https://api.example.com',
  tokenSource: 'cookies' as const,
  storage: {
    type: 'cookies' as const,
    options: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    },
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
};

export const createServerAuth = () => createAuthFlow(authConfig);
```

### 2. Create Middleware

Create `middleware.ts` in your project root:

```typescript
// middleware.ts
import { createAuthMiddleware } from '@jmndao/auth-flow/middleware';
import { createServerAuth } from './lib/auth';

const authFlow = createServerAuth();

export default createAuthMiddleware(authFlow, {
  redirectUrl: '/login',
  publicPaths: [
    '/login',
    '/register',
    '/forgot-password',
    '/api/auth/*',
    '/_next/*',
    '/favicon.ico',
  ],
  protectedPaths: ['/dashboard/*', '/profile/*', '/admin/*'],
  includeCallbackUrl: true,
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

## Configuration Options

### MiddlewareConfig Interface

```typescript
interface MiddlewareConfig {
  // URL to redirect to when authentication fails
  redirectUrl?: string;

  // Paths that don't require authentication
  publicPaths?: string[];

  // Paths that require authentication (if specified, others are public)
  protectedPaths?: string[];

  // Custom validation function
  skipValidation?: (path: string) => boolean;

  // Include current URL as callback parameter
  includeCallbackUrl?: boolean;
}
```

### Advanced Configuration

```typescript
// middleware.ts
export default createAuthMiddleware(authFlow, {
  redirectUrl: '/auth/login',
  publicPaths: [
    '/',
    '/about',
    '/contact',
    '/login',
    '/register',
    '/api/public/*',
    '/_next/*',
    '/images/*',
  ],
  protectedPaths: ['/dashboard/*', '/profile/*', '/settings/*', '/api/protected/*'],
  skipValidation: (path) => {
    // Skip validation for API health checks
    return path === '/api/health';
  },
  includeCallbackUrl: true,
});
```

## Path Matching

The middleware supports wildcard patterns:

```typescript
publicPaths: [
  '/login', // Exact match
  '/api/public/*', // Matches /api/public/anything
  '/docs/*', // Matches /docs/anything/nested
  '/images/*', // Matches /images/photo.jpg
];
```

## Server Components Integration

For server components, use the server auth checker:

```typescript
// app/dashboard/page.tsx
import { createServerAuthChecker } from '@jmndao/auth-flow/middleware';
import { createServerAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const authFlow = createServerAuth();
  const checkAuth = await createServerAuthChecker(authFlow);
  const authResult = await checkAuth();

  if (!authResult.isAuthenticated) {
    redirect('/login');
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {authResult.user?.name}</p>
    </div>
  );
}
```

## Server Actions Protection

Protect server actions with the auth wrapper:

```typescript
// app/actions.ts
import { createServerActionWrapper } from '@jmndao/auth-flow/middleware';
import { createServerAuth } from '@/lib/auth';

const authFlow = createServerAuth();
const withAuth = createServerActionWrapper(authFlow);

export const updateProfile = withAuth(async (formData: FormData) => {
  // This action is now protected
  const name = formData.get('name') as string;

  // Access the auth instance if needed
  const profile = await authFlow.patch('/api/profile', { name });

  return profile;
});
```

## API Routes Protection

For API routes, use the server auth checker:

```typescript
// app/api/profile/route.ts
import { createServerAuthChecker } from '@jmndao/auth-flow/middleware';
import { createServerAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const authFlow = createServerAuth();
  const checkAuth = await createServerAuthChecker(authFlow);
  const authResult = await checkAuth();

  if (!authResult.isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await authFlow.get('/api/user/profile');
  return NextResponse.json(profile);
}
```

## Error Handling

The middleware handles common authentication scenarios:

- **No refresh token**: Redirects to login
- **Expired refresh token**: Clears tokens and redirects to login
- **Valid refresh token**: Allows access to continue
- **Missing access token**: Redirects to login for token refresh

## Important Notes

### Token Refresh Limitation

⚠️ **Important**: Token refresh in middleware is complex and not recommended for production. The middleware will redirect users to login when access tokens are expired, allowing your login page or API routes to handle token refresh properly.

### Cookie Configuration

Ensure your API sets cookies correctly:

```typescript
// Your API should set cookies like this:
res.setHeader('Set-Cookie', [
  `accessToken=${accessToken}; Path=/; SameSite=Lax; ${secure}`,
  `refreshToken=${refreshToken}; Path=/; SameSite=Lax; ${secure}; HttpOnly`,
]);
```

### Environment Variables

```bash
# .env.local
API_URL=https://your-api.com
NEXT_PUBLIC_API_URL=https://your-api.com
NODE_ENV=production
```

## Debugging

Enable debug mode during development:

```typescript
// lib/auth.ts (development)
export const authConfig = {
  // ... other config
  storage: {
    type: 'cookies' as const,
    options: {
      // ... other options
      debugMode: process.env.NODE_ENV === 'development',
    },
  },
};
```

## Troubleshooting

### Common Issues

1. **Middleware not running**: Check your `matcher` configuration
2. **Infinite redirects**: Ensure login page is in `publicPaths`
3. **Cookies not working**: Verify `tokenSource: 'cookies'` and cookie options
4. **API calls failing**: Check token field names match your API response

### Debug Middleware

Add logging to debug middleware behavior:

```typescript
// middleware.ts
export default createAuthMiddleware(authFlow, {
  // ... config
  skipValidation: (path) => {
    console.log('Checking path:', path);
    return false;
  },
});
```

For more troubleshooting, see the [Troubleshooting Guide](./troubleshooting.md).

## Next Steps

- [API Reference](./api-reference.md) - Complete API documentation
- [Examples](./examples.md) - Real-world usage examples
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
