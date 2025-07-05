# Examples & Use Cases

Real-world examples for common scenarios using the cleaned AuthFlow implementation.

## React Application

```typescript
// hooks/useAuth.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [auth] = useState(() =>
    createAuthFlow({
      baseURL: 'https://api.example.com',
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'accessToken',
        refresh: 'refreshToken',
      },
    })
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const hasTokens = await auth.hasValidTokens();
      setIsAuthenticated(hasTokens);
      setLoading(false);
    };
    checkAuth();
  }, [auth]);

  const login = async (credentials) => {
    const user = await auth.login(credentials);
    setIsAuthenticated(true);
    return user;
  };

  const logout = async () => {
    await auth.logout();
    setIsAuthenticated(false);
  };

  return { auth, isAuthenticated, loading, login, logout };
}

// App.tsx
function App() {
  const { auth, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div>
      <button onClick={logout}>Logout</button>
      <UserProfile auth={auth} />
    </div>
  );
}
```

## Next.js App Router

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
    },
  },
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
};

export const createServerAuth = (context = {}) => createAuthFlow(authConfig, context);

// app/profile/page.tsx
import { cookies } from 'next/headers';
import { createServerAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const cookieStore = await cookies();

  const auth = createServerAuth({
    cookies: () => cookieStore,
  });

  if (!auth.isAuthenticated()) {
    redirect('/login');
  }

  const profile = await auth.get('/api/user/profile');

  return (
    <div>
      <h1>Profile</h1>
      <p>Welcome, {profile.name}</p>
    </div>
  );
}

// app/actions.ts
import { cookies } from 'next/headers';
import { createServerAuth } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const cookieStore = await cookies();

  const auth = createServerAuth({
    cookies: () => cookieStore,
    cookieSetter: (name, value, options) => {
      cookieStore.set(name, value, options);
    },
  });

  const credentials = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  try {
    const user = await auth.login(credentials);
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Express.js Backend

```typescript
// middleware/auth.js
import { createAuthFlow } from '@jmndao/auth-flow';

export const createAuthMiddleware = () => {
  return (req, res, next) => {
    const auth = createAuthFlow({
      baseURL: process.env.API_URL,
      storage: 'memory',
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'accessToken',
        refresh: 'refreshToken',
      },
    });

    req.auth = auth;
    next();
  };
};

// routes/users.js
import express from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();
const authMiddleware = createAuthMiddleware();

router.get('/api/users', authMiddleware, async (req, res) => {
  try {
    if (!req.auth.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const users = await req.auth.get('/api/users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Vue.js Application

```typescript
// composables/useAuth.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import { ref, onMounted } from 'vue';

export function useAuth() {
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

  const isAuthenticated = ref(false);
  const loading = ref(true);

  const checkAuth = async () => {
    const hasTokens = await auth.hasValidTokens();
    isAuthenticated.value = hasTokens;
    loading.value = false;
  };

  onMounted(checkAuth);

  const login = async (credentials) => {
    const user = await auth.login(credentials);
    isAuthenticated.value = true;
    return user;
  };

  const logout = async () => {
    await auth.logout();
    isAuthenticated.value = false;
  };

  return { auth, isAuthenticated, loading, login, logout };
}

// components/Dashboard.vue
<template>
  <div v-if="!loading">
    <div v-if="isAuthenticated">
      <h1>Dashboard</h1>
      <button @click="logout">Logout</button>
    </div>
    <LoginForm v-else @login="login" />
  </div>
</template>

<script setup>
import { useAuth } from '@/composables/useAuth';
import LoginForm from './LoginForm.vue';

const { auth, isAuthenticated, loading, login, logout } = useAuth();
</script>
```

## High-Performance Dashboard (V2)

```typescript
// For apps with many API calls
import { createPerformantAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createPerformantAuthFlow('https://api.example.com');

// Fetch dashboard data (automatically cached)
const fetchDashboardData = async () => {
  const [users, analytics, reports] = await Promise.all([
    auth.get('/api/users'), // Cached for 10 minutes
    auth.get('/api/analytics'), // Cached for 5 minutes
    auth.get('/api/reports'), // Cached for 30 minutes
  ]);

  return { users, analytics, reports };
};

// Monitor performance
const setupMonitoring = () => {
  setInterval(() => {
    const metrics = auth.getPerformanceMetrics();
    console.log({
      totalRequests: metrics.totalRequests,
      cacheHitRate: metrics.cacheHitRate,
      averageResponseTime: metrics.averageResponseTime,
    });
  }, 60000); // Every minute
};

// Clear cache when needed
const refreshData = () => {
  auth.clearCache('/api/users/*');
  fetchDashboardData();
};
```

## Microservices Architecture

```typescript
// For calling multiple services
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

class APIClient {
  private userService;
  private orderService;
  private paymentService;

  constructor() {
    const baseConfig = {
      caching: { enabled: true },
      monitoring: { enabled: true },
      circuitBreaker: { threshold: 3 },
    };

    this.userService = createAuthFlowV2({
      baseURL: 'https://users.api.example.com',
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: { access: 'accessToken', refresh: 'refreshToken' },
      ...baseConfig,
    });

    this.orderService = createAuthFlowV2({
      baseURL: 'https://orders.api.example.com',
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: { access: 'accessToken', refresh: 'refreshToken' },
      ...baseConfig,
    });
  }

  async getUserOrders(userId: string) {
    const [user, orders] = await Promise.all([
      this.userService.get(`/users/${userId}`),
      this.orderService.get(`/orders?userId=${userId}`),
    ]);

    return { user, orders };
  }
}
```

## Cookie-Based Authentication

```typescript
// Complete cookie setup
import { createAuthFlow } from '@jmndao/auth-flow';

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
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tokens: {
    access: 'authToken',
    refresh: 'refreshToken',
  },
});

// Your API should set cookies like this:
// res.setHeader('Set-Cookie', [
//   `authToken=${accessToken}; Path=/; SameSite=Lax; Secure`,
//   `refreshToken=${refreshToken}; Path=/; SameSite=Lax; Secure; HttpOnly`,
// ]);
```

## Security-Critical Application (V2)

```typescript
// For applications requiring maximum security
import { createSecureAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createSecureAuthFlow(
  'https://api.example.com',
  process.env.ENCRYPTION_KEY, // For token encryption
  process.env.SIGNING_KEY // For request signing
);

// All requests are automatically:
// - Signed with HMAC-SHA256
// - Include CSRF tokens
// - Have encrypted token storage
// - Include security headers

const secureData = await auth.get('/api/sensitive-data');
```

## Error Handling Patterns

```typescript
// Comprehensive error handling
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  endpoints: { login: '/auth/login', refresh: '/auth/refresh' },
  tokens: { access: 'accessToken', refresh: 'refreshToken' },
  onAuthError: (error) => {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.status === 403) {
      // Show access denied message
      showError('Access denied');
    }
  },
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed successfully');
  },
});

// Handle specific errors
try {
  const data = await auth.get('/api/data');
} catch (error) {
  if (error.status === 0) {
    console.log('Network error - check connection');
  } else if (error.status >= 500) {
    console.log('Server error - try again later');
  } else {
    console.log('Request error:', error.message);
  }
}
```

## Testing Examples

```typescript
// Mock for testing
const createMockAuth = () => ({
  login: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
  logout: jest.fn().mockResolvedValue(undefined),
  isAuthenticated: jest.fn().mockReturnValue(true),
  hasValidTokens: jest.fn().mockResolvedValue(true),
  getTokens: jest.fn().mockResolvedValue({
    accessToken: 'mock-access',
    refreshToken: 'mock-refresh',
  }),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

// Use in tests
describe('UserProfile', () => {
  const mockAuth = createMockAuth();

  test('should fetch user profile', async () => {
    mockAuth.get.mockResolvedValue({ name: 'John Doe' });

    const profile = await fetchUserProfile(mockAuth);

    expect(mockAuth.get).toHaveBeenCalledWith('/api/profile');
    expect(profile.name).toBe('John Doe');
  });
});
```

## Development & Debugging

```typescript
// For development with debugging
import { createDevAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createDevAuthFlow('https://api.example.com');
// Automatically enables debug mode and detailed logging

// Manual debug info
const debugInfo = auth.getDebugInfo();
console.log({
  isAuthenticated: debugInfo.authState.isAuthenticated,
  performance: debugInfo.performance,
  cacheStats: auth.getCacheStats(),
  healthStatus: auth.getHealthStatus(),
});

// Performance monitoring
const metrics = auth.getPerformanceMetrics();
console.log({
  requests: metrics.totalRequests,
  successRate: (metrics.successRate * 100).toFixed(1) + '%',
  avgTime: metrics.averageResponseTime + 'ms',
});
```

## Cleanup and Resource Management

```typescript
// Proper cleanup
useEffect(() => {
  const auth = createAuthFlow(config);

  return () => {
    // Cleanup when component unmounts
    if (auth.destroy) {
      auth.destroy(); // V2 only
    }
  };
}, []);

// Or for V2 clients
const auth = createAuthFlowV2(config);

// When app closes or user logs out
window.addEventListener('beforeunload', () => {
  auth.destroy();
});
```
