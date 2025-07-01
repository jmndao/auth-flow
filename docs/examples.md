# Framework Examples

## React

### Basic Authentication Hook

```typescript
import { useState, useEffect } from 'react';
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      if (await auth.hasValidTokens()) {
        const profile = await auth.get('/user/profile');
        setUser(profile.data);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    const userData = await auth.login(credentials);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuthStatus,
  };
};
```

### Login Component

```typescript
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginForm = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={credentials.username}
        onChange={(e) => setCredentials({...credentials, username: e.target.value})}
      />
      <input
        type="password"
        placeholder="Password"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
};
```

### Protected Route

```typescript
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please login</div>;

  return children;
};
```

## Next.js

### API Route

```typescript
// pages/api/protected.ts
import { createAuthFlow } from '@jmndao/auth-flow';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
    },
    { req, res }
  );

  try {
    if (!(await auth.hasValidTokens())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = await auth.get('/protected-data');
    res.json(data.data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Server-Side Props

```typescript
// pages/dashboard.tsx
import { GetServerSideProps } from 'next';
import { createAuthFlow } from '@jmndao/auth-flow';

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const auth = createAuthFlow({
    baseURL: process.env.API_BASE_URL,
    storage: 'cookies'
  }, { req, res });

  try {
    if (!(await auth.hasValidTokens())) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const userData = await auth.get('/user/profile');
    return { props: { user: userData.data } };
  } catch (error) {
    return { redirect: { destination: '/login', permanent: false } };
  }
};

const Dashboard = ({ user }) => {
  return <h1>Welcome, {user.name}</h1>;
};
```

### App Router (Next.js 13+)

```typescript
// app/dashboard/page.tsx
import { createAuthFlow } from '@jmndao/auth-flow';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const auth = createAuthFlow({
    baseURL: process.env.API_BASE_URL,
    storage: 'cookies'
  }, { cookies });

  if (!(await auth.hasValidTokens())) {
    redirect('/login');
  }

  const userData = await auth.get('/user/profile');
  return <h1>Welcome, {userData.data.name}</h1>;
}
```

## Express.js

### Authentication Middleware

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

export const authMiddleware = async (req, res, next) => {
  const auth = createAuthFlow(
    {
      baseURL: process.env.API_BASE_URL,
      storage: 'cookies',
    },
    { req, res }
  );

  try {
    if (!(await auth.hasValidTokens())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.auth = auth;
    const userResponse = await auth.get('/user/profile');
    req.user = userResponse.data;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

### Protected Route

```typescript
import express from 'express';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const dashboardData = await req.auth.get('/dashboard-stats');
    res.json({
      user: req.user,
      data: dashboardData.data,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});
```

## Vue.js

### Composition API

```typescript
// composables/useAuth.ts
import { ref, computed } from 'vue';
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');
const user = ref(null);

export const useAuth = () => {
  const login = async (credentials) => {
    const userData = await auth.login(credentials);
    user.value = userData;
    return userData;
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
    isAuthenticated: computed(() => !!user.value),
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
    <div v-if="isAuthenticated">
      <h1>Welcome, {{ user.name }}</h1>
      <button @click="logout">Logout</button>
    </div>
    <LoginForm v-else @login="handleLogin" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { isAuthenticated, user, login, logout, checkAuthStatus } = useAuth();

const handleLogin = async (credentials) => {
  await login(credentials);
};

onMounted(() => {
  checkAuthStatus();
});
</script>
```

## Cookie Timing Issues

### Debugging Cookie Problems

```typescript
import { diagnoseCookieIssues } from '@jmndao/auth-flow';

// Run diagnostic to identify cookie issues
await diagnoseCookieIssues(
  { username: 'test', password: 'test' },
  {
    baseURL: 'https://api.example.com',
    tokenSource: 'cookies',
    storage: { type: 'cookies', options: { debugMode: true } },
  }
);
```

### Optimized Cookie Configuration

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  storage: {
    type: 'cookies',
    options: {
      waitForCookies: 500, // Wait for server to set cookies
      fallbackToBody: true, // Use response body if cookies delayed
      retryCount: 3, // Retry cookie reads
      debugMode: true, // Enable detailed logging
      secure: true,
      sameSite: 'lax',
      path: '/',
    },
  },
});
```

## Single Token Auth

### JWT-Only Backend

```typescript
import { createSingleTokenAuth } from '@jmndao/auth-flow';

const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'accessToken' },
  endpoints: { login: 'auth/login' },
  sessionManagement: {
    renewBeforeExpiry: 300, // Renew 5 minutes before expiry
    persistCredentials: true, // Store credentials for auto-renewal
  },
});

// Usage is the same
const user = await auth.login({ username: 'user', password: 'pass' });
const data = await auth.get('/protected');
```

### Session-Based Auth

```typescript
const auth = createSingleTokenAuth({
  baseURL: 'https://api.example.com',
  token: { access: 'sessionToken' },
  endpoints: {
    login: 'auth/login',
    logout: 'auth/logout',
  },
  sessionManagement: {
    checkInterval: 60000, // Check every minute
    onSessionExpired: () => {
      window.location.href = '/login';
    },
  },
});
```

## Error Handling

### Global Error Handler

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  onAuthError: (error) => {
    switch (error.status) {
      case 401:
        // Redirect to login
        window.location.href = '/login';
        break;
      case 403:
        // Show access denied message
        showNotification('Access denied');
        break;
      case 429:
        // Rate limited
        showNotification('Too many requests');
        break;
    }
  },
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed');
  },
  onLogout: () => {
    // Clear application state
    clearUserData();
  },
});
```

### Custom Error Handling

```typescript
try {
  const data = await auth.get('/protected');
} catch (error) {
  if (error.status === 401) {
    // Handle unauthorized
  } else if (error.status === 500) {
    // Handle server error
  } else {
    // Handle other errors
  }
}
```

## Testing

### Mock Storage for Tests

```typescript
import { createAuthFlow, MemoryStorageAdapter } from '@jmndao/auth-flow';

describe('Auth Tests', () => {
  let auth;

  beforeEach(() => {
    auth = createAuthFlow({
      baseURL: 'https://api.test.com',
      storage: new MemoryStorageAdapter(),
    });
  });

  it('should login successfully', async () => {
    // Mock the login response
    jest.spyOn(auth, 'login').mockResolvedValue({ id: 1, name: 'Test User' });

    const user = await auth.login({ username: 'test', password: 'test' });
    expect(user.name).toBe('Test User');
  });
});
```

## Environment Configuration

### Development vs Production

```typescript
const auth = createAuthFlow({
  baseURL:
    process.env.NODE_ENV === 'production' ? 'https://api.example.com' : 'http://localhost:3001',

  storage:
    process.env.NODE_ENV === 'production'
      ? { type: 'cookies', options: { secure: true, sameSite: 'strict' } }
      : 'localStorage',

  timeout: process.env.NODE_ENV === 'production' ? 10000 : 30000,
});
```
