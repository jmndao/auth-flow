# AuthFlow

Simple, clean authentication flow with separated permission system for client-side applications.

## Features

- JWT access + refresh token authentication
- Automatic token refresh on expiration
- Clean separation between authentication and permissions
- Component-wrappable permission system
- Custom validation support
- Lightweight with zero dependencies
- Client-side focused

## Installation

```bash
npm install @jmndao/auth-flow
```

## Architecture

AuthFlow uses a clean separation of concerns:

- **Auth**: Handles authentication (login, logout, token management)
- **Permissions**: Handles authorization (roles, permissions, guards)

## Quick Start

```typescript
import { createAuthFlow, Permissions } from '@jmndao/auth-flow';

// Create auth instance
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
});

// Login
await auth.login({
  email: 'user@example.com',
  password: 'password',
});

// Make authenticated requests
const profile = await auth.get('/user/profile');

// Check authentication (token validity)
if (auth.isAuthenticated()) {
  console.log('User is authenticated');
}

// Create permission checker
const permissions = Permissions.createPermissionChecker(auth);

// Check permissions separately
if (permissions.hasRole('admin')) {
  console.log('User is admin');
}

if (permissions.hasPermission('posts:write')) {
  console.log('User can write posts');
}
```

## Authentication with Custom Validation

### Configuration-Based Custom Validation

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  validateAuth: (tokens) => {
    // Custom business logic
    if (!tokens) return false;

    // Example: Check if user is in working hours
    const now = new Date();
    const isWorkingHours = now.getHours() >= 9 && now.getHours() < 17;

    return isWorkingHours && customBusinessLogic(tokens);
  },
});

// Uses custom validator
auth.isAuthenticated();
```

### Parameter-Based Override

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  validateAuth: () => false, // Config always denies
});

// Default behavior (uses config)
auth.isAuthenticated(); // false

// Override with parameter
auth.isAuthenticated(() => true); // true
auth.isAuthenticated(customValidator);
```

### Using Permission Validators in Auth

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  // Use permission validator as auth validator
  validateAuth: Permissions.RBAC.requireRole('admin'),
});

// Only admin users will be considered "authenticated"
auth.isAuthenticated();
```

## Permission System

### Permission Checker

```typescript
const permissions = Permissions.createPermissionChecker(auth);

// Role checks
permissions.hasRole('admin');
permissions.hasAnyRole('admin', 'moderator');
permissions.hasAllRoles('editor', 'reviewer');

// Permission checks
permissions.hasPermission('posts:write');
permissions.hasAnyPermission('posts:read', 'posts:write');
permissions.hasAllPermissions('posts:write', 'posts:publish');

// Attribute checks
permissions.hasAttribute('department', 'engineering');

// Get raw claims
const claims = permissions.getClaims();

// Custom validation
permissions.check((tokens) => customLogic(tokens));
```

### Permission Validators

Use as standalone validators or in auth configuration:

```typescript
// RBAC validators
const adminValidator = Permissions.RBAC.requireRole('admin');
const editorValidator = Permissions.RBAC.requireAnyRole('editor', 'author');

// ABAC validators
const writeValidator = Permissions.ABAC.requirePermission('posts:write');
const deptValidator = Permissions.ABAC.create({
  rules: [Permissions.Rules.inDepartment('engineering')],
  mode: 'all',
});

// Combine validators
const complexValidator = Permissions.combineValidators(adminValidator, writeValidator, (tokens) =>
  customBusinessLogic(tokens)
);

// Use in auth
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  validateAuth: complexValidator,
});
```

### Component Guards

Create framework-specific permission guards:

```typescript
// React example
const RequireRole = Permissions.createRoleGuard((hasRole, children, fallback) => {
  return hasRole ? children : (fallback || null);
});

const RequirePermission = Permissions.createPermissionGrantGuard((hasPermission, children, fallback) => {
  return hasPermission ? children : (fallback || null);
});

// Usage in components
function AdminPanel() {
  return (
    <RequireRole
      auth={auth}
      role="admin"
      fallback={<AccessDenied />}
      onDenied={() => console.log('Access denied')}
    >
      <AdminContent />
    </RequireRole>
  );
}

function PostEditor() {
  return (
    <RequirePermission
      auth={auth}
      permission="posts:write"
      fallback={<ReadOnlyView />}
    >
      <EditForm />
    </RequirePermission>
  );
}
```

## Combining Auth and Permissions

### Flexible Validation Patterns

```typescript
const auth = createAuthFlow({
  baseURL: 'https://api.example.com',
  validateAuth: (tokens) => {
    // Base business logic validation
    return tokens !== null && isWorkingHours();
  },
});

const permissions = Permissions.createPermissionChecker(auth);

// Different validation levels
if (auth.isAuthenticated()) {
  // User passes business logic validation
}

if (auth.isAuthenticated(Permissions.RBAC.requireRole('admin'))) {
  // User passes business logic AND has admin role
}

if (permissions.hasRole('admin')) {
  // User has admin role (independent of auth validation)
}

// Complex combined validation
const isSeniorManager = (tokens) => {
  const roleCheck = Permissions.RBAC.requireRole('manager')(tokens);
  const attrCheck = permissions.hasAttribute('level', 'senior');
  const businessCheck = customBusinessLogic(tokens);

  return roleCheck && attrCheck && businessCheck;
};

if (auth.isAuthenticated(isSeniorManager)) {
  // Senior manager with business logic validation
}
```

## API Reference

### Auth Methods

- `auth.login(credentials)` - Authenticate user
- `auth.logout()` - Log out and clear tokens
- `auth.isAuthenticated(validator?)` - Check authentication
- `auth.getTokens()` - Get stored tokens
- `auth.setTokens(tokens)` - Set tokens manually
- `auth.get/post/put/patch/delete(url, data?, config?)` - HTTP methods

### Permission Methods

- `permissions.hasRole(role)` - Check single role
- `permissions.hasAnyRole(...roles)` - Check any role
- `permissions.hasAllRoles(...roles)` - Check all roles
- `permissions.hasPermission(permission)` - Check single permission
- `permissions.hasAnyPermission(...permissions)` - Check any permission
- `permissions.hasAllPermissions(...permissions)` - Check all permissions
- `permissions.hasAttribute(key, value)` - Check attribute value
- `permissions.getClaims()` - Get JWT claims
- `permissions.check(validator)` - Custom validation

### Validators

- `Permissions.RBAC.requireRole(role)` - Role validator
- `Permissions.RBAC.requireAnyRole(...roles)` - Any role validator
- `Permissions.RBAC.requireAllRoles(...roles)` - All roles validator
- `Permissions.ABAC.requirePermission(permission)` - Permission validator
- `Permissions.ABAC.create(config)` - Custom ABAC validator
- `Permissions.combineValidators(...validators)` - Combine multiple

## JWT Token Structure

Expected JWT payload structure:

```json
{
  "sub": "user123",
  "roles": ["admin", "user"],
  "permissions": ["posts:read", "posts:write"],
  "department": "engineering",
  "level": "senior",
  "exp": 1640995200
}
```

## License

MIT
