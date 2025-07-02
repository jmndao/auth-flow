# Quick Start Guide

Get up and running with AuthFlow v2.0 in minutes.

## Installation

```bash
npm install @jmndao/auth-flow
```

## Choose Your Version

**v1.x (Stable)** - Basic authentication with automatic token refresh

```typescript
import { createAuthFlow } from '@jmndao/auth-flow';
```

**v2.x (Production-Ready)** - All v1.x features + caching, monitoring, security

```typescript
import { createAuthFlowV2 } from '@jmndao/auth-flow/v2';
```

## Basic Setup (v1.x)

```typescript
// Minimal setup - just provide your API URL
const auth = createAuthFlow('https://api.example.com');

// Login and start making requests
const user = await auth.login({ email: 'user@example.com', password: 'password' });
const data = await auth.get('/api/profile');
```

## Production Setup (v2.x)

```typescript
// One-line production setup
const auth = createProductionAuthFlow('https://api.example.com');

// Everything works the same, but now with caching, monitoring, and resilience
const user = await auth.login({ email: 'user@example.com', password: 'password' });
const data = await auth.get('/api/profile'); // Automatically cached and monitored
```

## Common Patterns

### For React/Vue/Angular Apps

```typescript
const auth = createAuthFlowV2('https://api.example.com');

// Check if user is logged in
if (auth.isAuthenticated()) {
  // Make authenticated requests
  const profile = await auth.get('/api/profile');
}
```

### For Next.js/Server-Side

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  tokenSource: 'cookies', // Works with SSR
});
```

### For High-Performance Apps

```typescript
const auth = createPerformantAuthFlow('https://api.example.com');
// Aggressive caching and optimizations enabled
```

### For Security-Critical Apps

```typescript
const auth = createSecureAuthFlow('https://api.example.com', 'encryption-key', 'signing-key');
// All security features enabled
```

## That's It!

AuthFlow handles token refresh, request queuing, error handling, and (in v2.x) caching, monitoring, and resilience automatically. No additional configuration needed for most use cases.

See the [API Reference](./api-reference.md) for complete documentation.
