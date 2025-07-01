# Usage Examples

## Basic Usage

### Simple Authentication Flow

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

// Minimal setup - just pass your API URL
const auth = createAuthFlow('https://api.example.com');

// Login
try {
  const user = await auth.login({
    username: 'user@example.com',
    password: 'password',
  });
  console.log('Logged in user:', user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Make authenticated requests
try {
  const response = await auth.get('/user/profile');
  console.log('User profile:', response.data);
} catch (error) {
  console.error('Request failed:', error.message);
}

// Logout
await auth.logout();
```

### Check Authentication Status

```typescript
// Synchronous check (fast, but less reliable)
if (auth.isAuthenticated()) {
  console.log('User appears to be authenticated');
}

// Asynchronous check (validates tokens)
if (await auth.hasValidTokens()) {
  console.log('User has valid tokens');
} else {
  console.log('User needs to login');
}
```

### Custom Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  endpoints: {
    login: '/auth/signin',
    refresh: '/auth/refresh-token',
  },
  tokens: {
    access: 'access_token',
    refresh: 'refresh_token',
  },
  storage: 'localStorage',
  timeout: 15000,
  onAuthError: (error) => {
    if (error.status === 401) {
      window.location.href = '/login';
    }
  },
});
```

## React Integration

### React Hook for Authentication

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const hasTokens = await auth.hasValidTokens();
      setIsAuthenticated(hasTokens);

      if (hasTokens) {
        const profile = await auth.get('/user/profile');
        setUser(profile.data);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const userData = await auth.login(credentials);
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await auth.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isAuthenticated,
    loading,
    user,
    login,
    logout,
    checkAuthStatus,
  };
};
```

### Login Component

```typescript
// components/LoginForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginForm = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(credentials);
      // Redirect or update UI
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={credentials.username}
        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={credentials.password}
        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

export default LoginForm;
```

### Protected Route Component

```typescript
// components/ProtectedRoute.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please login to access this page</div>;
  }

  return children;
};

export default ProtectedRoute;
```

## Next.js Integration

### API Route with Authentication

```typescript
// pages/api/protected-data.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL || 'https://api.example.com',
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    // Check if user is authenticated
    if (!(await auth.hasValidTokens())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Make authenticated request to backend
    const data = await auth.get('/protected-resource');
    res.json(data.data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Server-Side Rendering with Authentication

```typescript
// pages/dashboard.tsx
import { GetServerSideProps } from 'next';
import { createAuthFlow } from '@jmndao/auth-flow';

interface DashboardProps {
  user: any;
  data: any;
}

const Dashboard = ({ user, data }: DashboardProps) => {
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const auth = createAuthFlow({
    baseURL: process.env.API_BASE_URL || 'https://api.example.com',
    storage: 'cookies',
    environment: 'server'
  }, { req, res });

  try {
    if (!(await auth.hasValidTokens())) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    const [userResponse, dataResponse] = await Promise.all([
      auth.get('/user/profile'),
      auth.get('/dashboard-data')
    ]);

    return {
      props: {
        user: userResponse.data,
        data: dataResponse.data,
      },
    };
  } catch (error) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }
};

export default Dashboard;
```

### Next.js App Router (13+)

```typescript
// app/dashboard/page.tsx
import { createAuthFlow } from '@jmndao/auth-flow';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const auth = createAuthFlow({
    baseURL: process.env.API_BASE_URL || 'https://api.example.com',
    storage: 'cookies',
    environment: 'server'
  }, { cookies });

  try {
    if (!(await auth.hasValidTokens())) {
      redirect('/login');
    }

    const userData = await auth.get('/user/profile');
    const dashboardData = await auth.get('/dashboard-data');

    return (
      <div>
        <h1>Welcome, {userData.data.name}</h1>
        <pre>{JSON.stringify(dashboardData.data, null, 2)}</pre>
      </div>
    );
  } catch (error) {
    redirect('/login');
  }
}
```

## Express.js Integration

### Authentication Middleware

```typescript
// middleware/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  auth?: any;
  user?: any;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL || 'https://api.example.com',
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    if (!(await auth.hasValidTokens())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attach auth client to request for use in routes
    req.auth = auth;

    // Optionally fetch user data
    const userResponse = await auth.get('/user/profile');
    req.user = userResponse.data;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

### Protected Route

```typescript
// routes/dashboard.ts
import express from 'express';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.get('/dashboard', authMiddleware, async (req: any, res) => {
  try {
    // Use the authenticated client from middleware
    const dashboardData = await req.auth.get('/dashboard-stats');

    res.json({
      user: req.user,
      data: dashboardData.data,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
```

## Vue.js Integration

### Vue Composition API

```typescript
// composables/useAuth.ts
import { ref, computed } from 'vue';
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

const user = ref(null);
const loading = ref(false);

export const useAuth = () => {
  const isAuthenticated = computed(() => !!user.value);

  const login = async (credentials: any) => {
    loading.value = true;
    try {
      const userData = await auth.login(credentials);
      user.value = userData;
      return userData;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    await auth.logout();
    user.value = null;
  };

  const checkAuthStatus = async () => {
    if (await auth.hasValidTokens()) {
      const profile = await auth.get('/user/profile');
      user.value = profile.data;
    }
  };

  return {
    user: computed(() => user.value),
    isAuthenticated,
    loading: computed(() => loading.value),
    login,
    logout,
    checkAuthStatus,
  };
};
```

### Vue Component

```vue
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else-if="isAuthenticated">
      <h1>Welcome, {{ user.name }}</h1>
      <button @click="logout">Logout</button>
    </div>
    <LoginForm v-else @login="handleLogin" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import LoginForm from '@/components/LoginForm.vue';

const { isAuthenticated, loading, user, login, logout, checkAuthStatus } = useAuth();

const handleLogin = async (credentials) => {
  try {
    await login(credentials);
  } catch (error) {
    console.error('Login failed:', error);
  }
};

onMounted(() => {
  checkAuthStatus();
});
</script>
```

## Advanced Examples

### Custom Storage Adapter

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
    try {
      await this.redis.set(key, value, 'EX', 86400); // 24 hour expiry
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis remove error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
}

// Usage
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: new RedisStorageAdapter(redisClient),
});
```

### Error Handling with Toast Notifications

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onAuthError: (error) => {
    switch (error.status) {
      case 401:
        toast.error('Session expired. Please login again.');
        router.push('/login');
        break;
      case 403:
        toast.error('Access denied. You do not have permission.');
        break;
      case 429:
        toast.warning('Too many requests. Please try again later.');
        break;
      default:
        toast.error('An authentication error occurred.');
    }
  },
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed successfully');
    analytics.track('token_refresh');
  },
  onLogout: () => {
    toast.info('You have been logged out.');
    clearUserData();
  },
});
```

### Multiple Auth Clients

```typescript
// Different clients for different APIs
const mainAuth = createAuthFlow('https://api.example.com');

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

// Use different clients for different purposes
const userData = await mainAuth.get('/user/profile');
const analytics = await analyticsAuth.get('/user/analytics');
```

### Environment-Based Configuration

```typescript
// config/auth.ts
const getAuthConfig = () => {
  const isDev = process.env.NODE_ENV === 'development';
  const isProd = process.env.NODE_ENV === 'production';

  return createAuthFlow({
    baseURL: isDev ? 'http://localhost:3001' : 'https://api.example.com',

    storage: isProd
      ? { type: 'cookies', options: { secure: true, sameSite: 'strict' } }
      : 'localStorage',

    timeout: isDev ? 30000 : 10000,

    retry: {
      attempts: isProd ? 3 : 1,
      delay: isProd ? 1000 : 500,
    },

    onAuthError: (error) => {
      if (isDev) {
        console.warn('Auth error:', error);
      } else {
        analytics.track('auth_error', { status: error.status, code: error.code });
      }
    },
  });
};

export const auth = getAuthConfig();
```

### Interceptors for Additional Headers

```typescript
const auth = createAuthFlow('https://api.example.com');

// Add custom headers to all requests
auth.axiosInstance.interceptors.request.use((config) => {
  config.headers['X-API-Key'] = process.env.API_KEY;
  config.headers['X-Client-Version'] = '1.0.0';
  config.headers['X-Device-ID'] = getDeviceId();
  return config;
});

// Add response logging
auth.axiosInstance.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.status);
    return Promise.reject(error);
  }
);
```

### Testing with Mock Storage

```typescript
// test/auth.test.ts
import { createAuthFlow, MemoryStorageAdapter } from '@jmndao/auth-flow';

describe('Authentication', () => {
  let auth;

  beforeEach(() => {
    auth = createAuthFlow({
      baseURL: 'https://api.test.com',
      storage: new MemoryStorageAdapter(), // Use memory storage for tests
    });
  });

  it('should login successfully', async () => {
    // Mock axios response
    jest.spyOn(auth.axiosInstance, 'post').mockResolvedValue({
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: { id: 1, name: 'Test User' },
      },
    });

    const user = await auth.login({ username: 'test', password: 'test' });

    expect(user.name).toBe('Test User');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('should handle logout', async () => {
    // Set tokens first
    await auth.setTokens({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    });

    await auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(await auth.getTokens()).toBeNull();
  });
});
```

### Real-time Token Status

```typescript
// utils/authStatus.ts
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

// Check token status periodically
const startTokenMonitoring = () => {
  setInterval(async () => {
    try {
      const hasValid = await auth.hasValidTokens();
      if (!hasValid && auth.isAuthenticated()) {
        // Tokens expired but user thinks they're logged in
        console.warn('Tokens expired, redirecting to login');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Token monitoring error:', error);
    }
  }, 60000); // Check every minute
};

// Start monitoring when app loads
startTokenMonitoring();

export { auth };
```

### Progressive Web App Integration

```typescript
// sw.js (Service Worker)
import { createAuthFlow } from '@jmndao/auth-flow';

// Handle auth in service worker for offline scenarios
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'memory', // Use memory in service worker
  onAuthError: (error) => {
    // Send message to main thread
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'AUTH_ERROR',
          error: error,
        });
      });
    });
  },
});

// Cache authenticated requests
self.addEventListener('fetch', async (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      caches.match(event.request).then(async (response) => {
        if (response) {
          return response;
        }

        // Make authenticated request
        try {
          const authResponse = await auth.get(event.request.url);
          const cache = await caches.open('api-cache');
          cache.put(event.request, authResponse.clone());
          return authResponse;
        } catch (error) {
          // Return cached version if available
          return caches.match(event.request);
        }
      })
    );
  }
});
```
