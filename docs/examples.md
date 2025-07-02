# Examples & Use Cases

Real-world examples for common scenarios.

## React Application

```typescript
// hooks/useAuth.ts
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [auth] = useState(() =>
    createAuthFlowV2('https://api.example.com')
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

## Next.js Application

```typescript
// lib/auth.ts
import { createAuthFlow } from '@jmndao/auth-flow';

export const createServerAuth = (req, res) => {
  return createAuthFlow(
    {
      baseURL: process.env.API_URL,
      tokenSource: 'cookies',
      storage: {
        type: 'cookies',
        options: {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        },
      },
    },
    { req, res }
  );
};

export const clientAuth = createAuthFlow({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  tokenSource: 'cookies',
});

// pages/api/profile.ts
export default async function handler(req, res) {
  const auth = createServerAuth(req, res);

  if (!auth.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const profile = await auth.get('/api/user/profile');
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

// pages/profile.tsx
export async function getServerSideProps({ req, res }) {
  const auth = createServerAuth(req, res);

  if (!auth.isAuthenticated()) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const profile = await auth.get('/api/user/profile');
  return { props: { profile } };
}
```

## Express.js Backend

```typescript
// middleware/auth.js
import { createAuthFlow } from '@jmndao/auth-flow';

export const authMiddleware = (req, res, next) => {
  const auth = createAuthFlow({
    baseURL: process.env.API_URL,
    storage: 'memory',
  });

  // Add auth to request object
  req.auth = auth;
  next();
};

// routes/users.js
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await req.auth.get('/api/users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Vue.js Application

```typescript
// composables/useAuth.ts
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';
import { ref, onMounted } from 'vue';

export function useAuth() {
  const auth = createAuthFlowV2('https://api.example.com');
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
```

## High-Performance Dashboard

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
setInterval(() => {
  const metrics = auth.getPerformanceMetrics();
  console.log({
    totalRequests: metrics.totalRequests,
    cacheHitRate: metrics.cacheHitRate,
    averageResponseTime: metrics.averageResponseTime,
  });
}, 60000); // Every minute
```

## Microservices Architecture

```typescript
// For calling multiple services
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

class APIClient {
  private userService: AuthFlowV2Client;
  private orderService: AuthFlowV2Client;
  private paymentService: AuthFlowV2Client;

  constructor() {
    const baseConfig = {
      caching: { enabled: true },
      monitoring: { enabled: true },
      circuitBreaker: { threshold: 3 },
    };

    this.userService = createAuthFlowV2({
      baseURL: 'https://users.api.example.com',
      ...baseConfig,
    });

    this.orderService = createAuthFlowV2({
      baseURL: 'https://orders.api.example.com',
      ...baseConfig,
    });

    this.paymentService = createAuthFlowV2({
      baseURL: 'https://payments.api.example.com',
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

## Mobile App (React Native)

```typescript
// For React Native applications
import { createAuthFlow } from '@jmndao/auth-flow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom storage adapter for React Native
class AsyncStorageAdapter {
  async get(key: string) {
    return await AsyncStorage.getItem(key);
  }

  async set(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  }

  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  }

  async clear() {
    await AsyncStorage.clear();
  }
}

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: new AsyncStorageAdapter(),
});

// Use in your React Native components
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const hasTokens = await auth.hasValidTokens();
    setIsAuthenticated(hasTokens);
  };

  return { auth, isAuthenticated };
}
```

## Security-Critical Application

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

## Development & Testing

```typescript
// For development with debugging
import { createDevAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createDevAuthFlow('https://api.example.com');
// Automatically enables debug mode and detailed logging

// For testing
import { mockAuthClient } from '@jmndao/auth-flow/testing';

const mockAuth = mockAuthClient({
  isAuthenticated: () => true,
  getTokens: () =>
    Promise.resolve({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    }),
  get: jest.fn().mockResolvedValue({ data: 'mock-data' }),
});

// Use mockAuth in your tests
```

## Error Handling Patterns

```typescript
// Comprehensive error handling
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
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

## Performance Monitoring

```typescript
// Set up comprehensive monitoring
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  monitoring: {
    enabled: true,
    sampleRate: 0.1, // Monitor 10% of requests
    onMetrics: (metrics) => {
      // Send to your analytics service
      analytics.track('api_performance', {
        averageResponseTime: metrics.averageResponseTime,
        successRate: metrics.successRate,
        cacheHitRate: metrics.cacheHitRate,
      });
    },
  },
});

// Get detailed performance insights
const getPerformanceReport = () => {
  const metrics = auth.getPerformanceMetrics();
  const health = auth.getHealthStatus();
  const cache = auth.getCacheStats();

  return {
    performance: {
      totalRequests: metrics.totalRequests,
      successRate: (metrics.successRate * 100).toFixed(1) + '%',
      avgResponseTime: metrics.averageResponseTime + 'ms',
      p95ResponseTime: metrics.p95ResponseTime + 'ms',
    },
    caching: {
      hitRate: (cache.hitRate * 100).toFixed(1) + '%',
      cacheSize: cache.size + '/' + cache.maxSize,
    },
    health: {
      status: health.isHealthy ? 'Healthy' : 'Unhealthy',
      lastCheck: new Date(health.lastCheckTime).toLocaleString(),
    },
  };
};
```
