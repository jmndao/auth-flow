# Migration Guide

Simple guide for upgrading to AuthFlow v2.0.

## Zero Breaking Changes

**Important**: All existing v1.x code continues to work exactly the same. No changes required.

## Migration Options

### Option 1: Keep Using v1.x (No Changes)

Your existing code continues to work:

```typescript
// This still works exactly the same
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
});
```

### Option 2: Gradual Upgrade to v2.x

Add v2.x features gradually:

```typescript
// Change import and add v2.x features
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';

const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
  // Add v2.x features
  caching: { enabled: true },
  monitoring: { enabled: true },
});
```

### Option 3: Use Production Preset

Get all v2.x benefits with one line:

```typescript
import { createProductionAuthFlow } from '@jmndao/auth-flow/v2';

// Replace your existing createAuthFlow call
const auth = createProductionAuthFlow('https://api.example.com');
```

## Framework-Specific Migration

### React Apps

**Before (v1.x):**

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';

const auth = createAuthFlow('https://api.example.com');
```

**After (v2.x):**

```typescript
import { createPerformantAuthFlow } from '@jmndao/auth-flow/v2';

const auth = createPerformantAuthFlow('https://api.example.com');
```

### Next.js Apps

**Before:**

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies',
});
```

**After:**

```typescript
const auth = createProductionAuthFlow('https://api.example.com', {
  tokenSource: 'cookies',
});
```

### Node.js/Express Apps

**Before:**

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  storage: 'memory',
});
```

**After:**

```typescript
const auth = createResilientAuthFlow('https://api.example.com');
```

## New Features You Get

When you upgrade to v2.x, you automatically get:

- **Request Caching** - Faster response times
- **Performance Monitoring** - Built-in metrics
- **Circuit Breaker** - Better error handling
- **Health Monitoring** - API status tracking
- **Enhanced Security** - Optional encryption and signing
- **Debug Tools** - Better troubleshooting

## Configuration Migration

### v1.x Configuration

```typescript
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
  retry: { attempts: 3, delay: 1000 },
});
```

### v2.x Enhanced Configuration

```typescript
const auth = createAuthFlowV2({
  baseURL: 'https://api.example.com',
  endpoints: {
    login: '/auth/login',
    refresh: '/auth/refresh',
  },
  tokens: {
    access: 'accessToken',
    refresh: 'refreshToken',
  },
  // Enhanced retry with more options
  retry: {
    attempts: 3,
    delay: 1000,
    strategy: 'exponential',
    conditions: ['network', '5xx', 'timeout'],
  },
  // New v2.x features
  caching: { enabled: true, defaultTTL: 300000 },
  monitoring: { enabled: true, sampleRate: 0.1 },
  circuitBreaker: { threshold: 5, resetTimeout: 60000 },
});
```

## Testing Your Migration

Use the built-in diagnostic tool to verify everything works:

```typescript
import { testAuthFlowFeatures } from '@jmndao/auth-flow/v2';

const results = await testAuthFlowFeatures(config, testCredentials);
console.log('Migration test results:', results);
```

## Getting Help

If you encounter any issues:

1. Check that your existing v1.x code still works (it should)
2. Use the diagnostic tools in v2.x
3. Review the [troubleshooting section](./troubleshooting.md)
4. Open an issue on GitHub with your configuration
