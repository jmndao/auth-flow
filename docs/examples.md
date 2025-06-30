# Usage Examples

## Basic Usage

### Simple Authentication Flow

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const authClient = createAuthFlow({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
});

// Login
try {
  const user = await authClient.login({
    username: 'user@example.com',
    password: 'password',
  });
  console.log('Logged in user:', user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Make authenticated requests
try {
  const response = await authClient.get('/user/profile');
  console.log('User profile:', response.data);
} catch (error) {
  console.error('Request failed:', error.message);
}

// Logout
await authClient.logout();
```

### Check Authentication Status

```typescript
// Synchronous check (fast, but less reliable)
if (authClient.isAuthenticated()) {
  console.log('User appears to be authenticated');
}

// Asynchronous check (validates tokens)
if (await authClient.hasValidTokens()) {
  console.log('User has valid tokens');
} else {
  console.log('User needs to login');
}
```

## React Integration

### React Hook for Authentication

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { authClient } from '../auth';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const hasTokens = await authClient.hasValidTokens();
      setIsAuthenticated(hasTokens);

      if (hasTokens) {
        const profile = await authClient.get('/user/profile');
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
      const userData = await authClient.login(credentials);
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await authClient.logout();
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
```

## Next.js Integration

### API Route with Authentication

```typescript
// pages/api/protected-data.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authClient = createAuthFlow(
    {
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'accessToken',
        refresh: 'refreshToken',
      },
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    // Check if user is authenticated
    if (!(await authClient.hasValidTokens())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Make authenticated request to backend
    const data = await authClient.get('/protected-resource');
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
  const authClient = createAuthFlow({
    endpoints: {
      login: '/auth/login',
      refresh: '/auth/refresh'
    },
    tokens: {
      access: 'accessToken',
      refresh: 'refreshToken'
    },
    baseURL: process.env.API_BASE_URL,
    storage: 'cookies',
    environment: 'server'
  }, { req, res });

  try {
    if (!(await authClient.hasValidTokens())) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    const [userResponse, dataResponse] = await Promise.all([
      authClient.get('/user/profile'),
      authClient.get('/dashboard-data')
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

## Express.js Integration

### Authentication Middleware

```typescript
// middleware/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  authClient?: any;
  user?: any;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authClient = createAuthFlow(
    {
      endpoints: {
        login: '/auth/login',
        refresh: '/auth/refresh',
      },
      tokens: {
        access: 'access_token',
        refresh: 'refresh_token',
      },
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
      environment: 'server',
    },
    { req, res }
  );

  try {
    if (!(await authClient.hasValidTokens())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attach auth client to request for use in routes
    req.authClient = authClient;

    // Optionally fetch user data
    const userResponse = await authClient.get('/user/profile');
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
    const dashboardData = await req.authClient.get('/dashboard-stats');

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
import { authClient } from '../auth';

const user = ref(null);
const loading = ref(false);

export const useAuth = () => {
  const isAuthenticated = computed(() => !!user.value);

  const login = async (credentials: any) => {
    loading.value = true;
    try {
      const userData = await authClient.login(credentials);
      user.value = userData;
      return userData;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    await authClient.logout();
    user.value = null;
  };

  const checkAuthStatus = async () => {
    if (await authClient.hasValidTokens()) {
      const profile = await authClient.get('/user/profile');
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
const authClient = createAuthFlow({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  storage: new RedisStorageAdapter(redisClient),
});
```

### Request Interceptor for API Keys

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const authClient = createAuthFlow({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
});

// Add custom headers to all requests
authClient.axiosInstance.interceptors.request.use((config) => {
  config.headers['X-API-Key'] = process.env.API_KEY;
  config.headers['X-Client-Version'] = '1.0.0';
  return config;
});
```

### Error Handling with Toast Notifications

```typescript
const authClient = createAuthFlow({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
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
const mainApiClient = createAuthFlow({
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  baseURL: 'https://api.example.com',
});

const analyticsApiClient = createAuthFlow({
  endpoints: {
    login: '/analytics/auth/login',
    refresh: '/analytics/auth/refresh',
  },
  tokens: {
    access: 'token',
    refresh: 'refreshToken',
  },
  baseURL: 'https://analytics.example.com',
  storage: 'memory', // Separate storage
});

// Use different clients for different purposes
const userData = await mainApiClient.get('/user/profile');
const analytics = await analyticsApiClient.get('/user/analytics');
```
