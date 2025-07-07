# API Reference

## Core API

### createAuthFlow(config)

Creates a new AuthFlow instance.

**Parameters:**

- `config` (string | AuthConfig): API base URL or configuration object

**Returns:** AuthClient instance

```typescript
// Simple usage
const auth = createAuthFlow('https://api.example.com');

// With configuration
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'cookies',
  timeout: 10000,
});
```

## AuthClient

### Authentication Methods

#### login(credentials)

Authenticates user with provided credentials.

**Parameters:**

- `credentials` (object): Login credentials

**Returns:** Promise<User>

```typescript
const user = await auth.login({
  email: 'user@example.com',
  password: 'password',
});
```

#### logout()

Logs out user and clears stored tokens.

**Returns:** Promise<void>

```typescript
await auth.logout();
```

#### isAuthenticated()

Checks if user is currently authenticated.

**Returns:** boolean

```typescript
if (auth.isAuthenticated()) {
  // User is logged in
}
```

### HTTP Methods

All HTTP methods automatically include authentication headers.

#### get(url, config?)

Makes authenticated GET request.

**Parameters:**

- `url` (string): Request URL
- `config` (object, optional): Request configuration

**Returns:** Promise<Response>

```typescript
const users = await auth.get('/users');
const user = await auth.get('/users/123');
```

#### post(url, data?, config?)

Makes authenticated POST request.

**Parameters:**

- `url` (string): Request URL
- `data` (any, optional): Request body data
- `config` (object, optional): Request configuration

**Returns:** Promise<Response>

```typescript
const newUser = await auth.post('/users', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

#### put(url, data?, config?)

Makes authenticated PUT request.

#### patch(url, data?, config?)

Makes authenticated PATCH request.

#### delete(url, config?)

Makes authenticated DELETE request.

### Token Management

#### getTokens()

Retrieves stored token pair.

**Returns:** Promise<TokenPair | null>

```typescript
const tokens = await auth.getTokens();
if (tokens) {
  console.log('Access token:', tokens.accessToken);
  console.log('Refresh token:', tokens.refreshToken);
}
```

#### setTokens(tokens)

Manually sets token pair.

**Parameters:**

- `tokens` (TokenPair): Token pair to store

**Returns:** Promise<void>

```typescript
await auth.setTokens({
  accessToken: 'your-access-token',
  refreshToken: 'your-refresh-token',
});
```

#### clearTokens()

Clears all stored tokens.

**Returns:** Promise<void>

```typescript
await auth.clearTokens();
```

## Configuration

### AuthConfig

```typescript
interface AuthConfig {
  baseURL: string;
  endpoints?: {
    login?: string; // Default: '/auth/login'
    refresh?: string; // Default: '/auth/refresh'
    logout?: string; // Default: '/auth/logout'
  };
  tokens?: {
    access?: string; // Default: 'accessToken'
    refresh?: string; // Default: 'refreshToken'
  };
  storage?: 'auto' | 'memory' | 'browser' | 'cookies'; // Default: 'auto'
  timeout?: number; // Default: 10000
  retry?: {
    attempts?: number; // Default: 3
    delay?: number; // Default: 1000
  };
  onTokenRefresh?: (tokens: TokenPair) => void;
  onAuthError?: (error: AuthError) => void;
  onLogout?: () => void;
}
```

### Storage Options

- **auto**: Automatically selects best storage for environment
- **memory**: In-memory storage (session-based)
- **browser**: localStorage with sessionStorage fallback
- **cookies**: Universal cookie storage (works in server/client)

## Presets

Quick configurations for common scenarios.

### createSimpleAuth(baseURL)

Browser-optimized configuration with localStorage.

```typescript
import { createSimpleAuth } from '@jmndao/auth-flow/presets';
const auth = createSimpleAuth('https://api.example.com');
```

### createServerAuth(baseURL)

Server-side configuration with cookies.

```typescript
import { createServerAuth } from '@jmndao/auth-flow/presets';
const auth = createServerAuth('https://api.example.com');
```

### createNextJSAuth(baseURL)

Next.js optimized configuration.

```typescript
import { createNextJSAuth } from '@jmndao/auth-flow/presets';
const auth = createNextJSAuth('https://api.example.com');
```

### createDevAuth(baseURL)

Development configuration with verbose logging.

```typescript
import { createDevAuth } from '@jmndao/auth-flow/presets';
const auth = createDevAuth('https://api.example.com');
```

### createProductionAuth(baseURL)

Production-optimized configuration.

```typescript
import { createProductionAuth } from '@jmndao/auth-flow/presets';
const auth = createProductionAuth('https://api.example.com');
```

## Diagnostics

### diagnose(config)

Runs comprehensive diagnostic check.

**Parameters:**

- `config` (AuthConfig): Configuration to diagnose

**Returns:** Promise<DiagnosticResult>

```typescript
import { diagnose } from '@jmndao/auth-flow/diagnostics';

const report = await diagnose({
  baseURL: 'https://api.example.com',
});

console.log('Issues found:', report.issues);
console.log('Suggested fixes:', report.fixes);
```

### healthCheck(config)

Performs health check on configuration.

**Parameters:**

- `config` (AuthConfig): Configuration to check

**Returns:** Promise<HealthReport>

```typescript
import { healthCheck } from '@jmndao/auth-flow/diagnostics';

const health = await healthCheck({
  baseURL: 'https://api.example.com',
});

if (!health.healthy) {
  console.log('Health issues:', health.issues);
  console.log('Recommendations:', health.recommendations);
}
```

### validateConfig(config)

Validates configuration without runtime checks.

**Parameters:**

- `config` (AuthConfig): Configuration to validate

**Returns:** HealthIssue[]

```typescript
import { validateConfig } from '@jmndao/auth-flow/diagnostics';

const issues = validateConfig({
  baseURL: 'https://api.example.com',
  storage: 'invalid', // This would be caught
});

if (issues.length > 0) {
  console.log('Configuration issues:', issues);
}
```

## Error Handling

### AuthError

```typescript
interface AuthError {
  status: number;
  message: string;
  code?: string;
  originalError?: any;
}
```

### Common Error Codes

- **NETWORK_ERROR**: Network connectivity issues
- **TOKEN_EXPIRED**: Access token has expired
- **REFRESH_TOKEN_EXPIRED**: Refresh token has expired
- **INVALID_CREDENTIALS**: Login credentials are invalid
- **STORAGE_ERROR**: Storage operation failed

### Error Handling Example

```typescript
try {
  await auth.login(credentials);
} catch (error) {
  if (error.status === 401) {
    console.log('Invalid credentials');
  } else if (error.code === 'NETWORK_ERROR') {
    console.log('Network issue, please try again');
  } else {
    console.log('Login failed:', error.message);
  }
}
```
