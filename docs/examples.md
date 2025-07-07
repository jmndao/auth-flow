# Examples

## Basic Usage

### Simple Login/Logout

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');

// Login
async function login(email: string, password: string) {
  try {
    const user = await auth.login({ email, password });
    console.log('Logged in as:', user.name);
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

// Logout
async function logout() {
  await auth.logout();
  console.log('Logged out');
}

// Check authentication status
if (auth.isAuthenticated()) {
  console.log('User is logged in');
} else {
  console.log('User is not logged in');
}
```

### Making API Calls

```typescript
// GET request
const users = await auth.get('/users');
console.log('Users:', users.data);

// POST request
const newUser = await auth.post('/users', {
  name: 'John Doe',
  email: 'john@example.com',
});

// PUT request
const updatedUser = await auth.put('/users/123', {
  name: 'John Smith',
});

// DELETE request
await auth.delete('/users/123');
```

## Framework Integrations

### Next.js App Router

#### Server Actions

```typescript
// lib/auth.ts
import { createServerActionAuth } from '@jmndao/auth-flow/frameworks/nextjs';

export const auth = createServerActionAuth({
  baseURL: process.env.API_URL!,
});
```

```typescript
// app/login/actions.ts
'use server';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    await auth.login({ email, password });
    redirect('/dashboard');
  } catch (error) {
    return { error: 'Invalid credentials' };
  }
}
```

```tsx
// app/login/page.tsx
import { loginAction } from './actions';

export default function LoginPage() {
  return (
    <form action={loginAction}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  );
}
```

#### Middleware

```typescript
// middleware.ts
import { createAuthMiddleware } from '@jmndao/auth-flow/frameworks/nextjs';

export default createAuthMiddleware({
  publicPaths: ['/login', '/register', '/'],
  loginUrl: '/login',
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

#### Server Components

```tsx
// app/profile/page.tsx
import { auth } from '@/lib/auth';
import { getAuthTokens } from '@jmndao/auth-flow/frameworks/nextjs';

export default async function ProfilePage() {
  const tokens = await getAuthTokens();

  if (!tokens) {
    return <div>Please login to view your profile</div>;
  }

  // Use tokens to make API calls
  const profile = await fetch('/api/user/profile', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  });

  return <div>Welcome back!</div>;
}
```

### React

```tsx
// hooks/useAuth.tsx
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createAuthFlow } from '@jmndao/auth-flow';
import type { AuthContextType } from '@jmndao/auth-flow/frameworks/react';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth] = useState(() =>
    createAuthFlow({
      baseURL: process.env.REACT_APP_API_URL!,
    })
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const tokens = await auth.getTokens();
        setIsAuthenticated(Boolean(tokens));
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [auth]);

  const login = useCallback(
    async (credentials: any) => {
      setIsLoading(true);
      try {
        const userData = await auth.login(credentials);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [auth]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await auth.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  const refreshTokens = useCallback(async () => {
    try {
      const tokens = await auth.getTokens();
      setIsAuthenticated(Boolean(tokens));
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [auth]);

  const value = {
    auth,
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    refreshTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

```tsx
// App.tsx
import { AuthProvider, useAuth } from './hooks/useAuth';

function Dashboard() {
  const { isAuthenticated, login, logout, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          login({
            email: formData.get('email'),
            password: formData.get('password'),
          });
        }}
      >
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    );
  }

  return (
    <div>
      <h1>Welcome to Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
```

### Vue 3

```typescript
// composables/useAuth.ts
import { ref, computed, onMounted, provide, inject } from 'vue';
import { createAuthFlow } from '@jmndao/auth-flow';
import { AUTH_KEY } from '@jmndao/auth-flow/frameworks/vue';

export function createAuth(config: any) {
  const auth = createAuthFlow(config);
  const isAuthenticated = ref(false);
  const isLoading = ref(true);
  const user = ref(null);
  const error = ref<string | null>(null);

  const checkAuth = async () => {
    try {
      const tokens = await auth.getTokens();
      isAuthenticated.value = Boolean(tokens);
    } catch {
      isAuthenticated.value = false;
    } finally {
      isLoading.value = false;
    }
  };

  const login = async (credentials: any) => {
    isLoading.value = true;
    error.value = null;
    try {
      const userData = await auth.login(credentials);
      user.value = userData;
      isAuthenticated.value = true;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const logout = async () => {
    isLoading.value = true;
    try {
      await auth.logout();
      user.value = null;
      isAuthenticated.value = false;
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(checkAuth);

  return {
    auth,
    isAuthenticated: computed(() => isAuthenticated.value),
    isLoading: computed(() => isLoading.value),
    user: computed(() => user.value),
    error: computed(() => error.value),
    login,
    logout,
    checkAuth,
    provide: () =>
      provide(AUTH_KEY, {
        auth,
        isAuthenticated: isAuthenticated.value,
        isLoading: isLoading.value,
        user: user.value,
        error: error.value,
      }),
  };
}

export function useAuth() {
  const authState = inject(AUTH_KEY);
  if (!authState) {
    throw new Error('useAuth must be used within an auth provider');
  }
  return authState;
}
```

```vue
<!-- App.vue -->
<template>
  <div id="app">
    <div v-if="isLoading">Loading...</div>
    <LoginForm v-else-if="!isAuthenticated" @login="handleLogin" />
    <Dashboard v-else @logout="handleLogout" />
  </div>
</template>

<script setup lang="ts">
import { createAuth } from './composables/useAuth';

const { isAuthenticated, isLoading, login, logout, provide } = createAuth({
  baseURL: import.meta.env.VITE_API_URL,
});

provide();

const handleLogin = async (credentials: any) => {
  try {
    await login(credentials);
  } catch (error) {
    console.error('Login failed:', error);
  }
};

const handleLogout = async () => {
  await logout();
};
</script>
```

## Advanced Usage

### Custom Configuration

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',

  // Custom endpoints
  endpoints: {
    login: '/auth/signin',
    refresh: '/auth/token/refresh',
    logout: '/auth/signout',
  },

  // Custom token field names
  tokens: {
    access: 'access_token',
    refresh: 'refresh_token',
  },

  // Storage configuration
  storage: 'cookies',

  // Request timeout
  timeout: 15000,

  // Retry configuration
  retry: {
    attempts: 5,
    delay: 2000,
  },

  // Event handlers
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed at:', new Date());
  },

  onAuthError: (error) => {
    console.error('Authentication error:', error);
    // Could redirect to login page
  },

  onLogout: () => {
    console.log('User logged out');
    // Clear application state
  },
});
```

### Error Handling

```typescript
async function makeAuthenticatedRequest() {
  try {
    const data = await auth.get('/protected-data');
    return data;
  } catch (error) {
    if (error.status === 401) {
      // Token expired or invalid
      console.log('Please login again');
    } else if (error.status === 403) {
      // Insufficient permissions
      console.log('Access denied');
    } else if (error.code === 'NETWORK_ERROR') {
      // Network connectivity issue
      console.log('Check your internet connection');
    } else {
      // Other errors
      console.log('Request failed:', error.message);
    }
    throw error;
  }
}
```

### Using Presets

```typescript
import { createSimpleAuth, createNextJSAuth, createDevAuth } from '@jmndao/auth-flow/presets';

// For SPA applications
const spaAuth = createSimpleAuth('https://api.example.com');

// For Next.js applications
const nextjsAuth = createNextJSAuth('https://api.example.com');

// For development with logging
const devAuth = createDevAuth('https://api.example.com');
```

### Diagnostics

```typescript
import { diagnose } from '@jmndao/auth-flow/diagnostics';

async function troubleshootAuth() {
  const report = await diagnose({
    baseURL: 'https://api.example.com',
    storage: 'cookies',
  });

  if (report.issues.length > 0) {
    console.log('Found issues:');
    report.issues.forEach((issue) => {
      console.log(`- ${issue.description}`);
      console.log(`  Solution: ${issue.solution}`);
    });
  }

  if (report.fixes.length > 0) {
    console.log('\nSuggested fixes:');
    report.fixes.forEach((fix) => console.log(`- ${fix}`));
  }
}
```
