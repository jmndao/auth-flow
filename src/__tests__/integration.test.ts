import { createAuthFlow, Permissions } from '../index';
import { AuthFlowConfig, TokenPair } from '../types';

describe('AuthFlow Integration', () => {
  const config: AuthFlowConfig = {
    baseURL: 'https://api.example.com',
  };

  const createJWTToken = (payload: any): string => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    return `${header}.${encodedPayload}.signature`;
  };

  beforeEach(() => {
    // Reset and properly configure localStorage mock
    jest.clearAllMocks();
    const mockStorage = window.localStorage as jest.Mocked<Storage>;

    // Create a simple in-memory storage for tests
    const storage: Record<string, string> = {};

    mockStorage.getItem.mockImplementation((key: string) => storage[key] || null);
    mockStorage.setItem.mockImplementation((key: string, value: string) => {
      storage[key] = value;
    });
    mockStorage.removeItem.mockImplementation((key: string) => {
      delete storage[key];
    });
  });

  describe('Separated Auth and Permissions Architecture', () => {
    it('should separate authentication from permissions', () => {
      const auth = createAuthFlow(config);
      const permissions = Permissions.createPermissionChecker(auth);

      // Auth only handles authentication
      expect(typeof auth.isAuthenticated).toBe('function');
      expect(typeof auth.login).toBe('function');
      expect(typeof auth.logout).toBe('function');

      // Permissions handle authorization separately
      expect(typeof permissions.hasRole).toBe('function');
      expect(typeof permissions.hasPermission).toBe('function');
      expect(typeof permissions.check).toBe('function');
    });

    it('should work with auth custom validation and separate permissions', async () => {
      // Auth with custom business logic validation
      const customValidator = jest.fn().mockReturnValue(true);
      const auth = createAuthFlow({
        ...config,
        validateAuth: customValidator,
      });

      const permissions = Permissions.createPermissionChecker(auth);

      // Set up tokens using auth API
      const userClaims = {
        roles: ['editor'],
        permissions: ['posts:write'],
        department: 'content',
      };
      const userToken = createJWTToken(userClaims);

      auth.setTokens({
        accessToken: userToken,
        refreshToken: 'refresh-token',
      });

      // Auth uses custom validator
      expect(auth.isAuthenticated()).toBe(true);
      expect(customValidator).toHaveBeenCalled();

      // Permissions work independently
      expect(permissions.hasRole('editor')).toBe(true);
      expect(permissions.hasRole('admin')).toBe(false);
      expect(permissions.hasPermission('posts:write')).toBe(true);
      expect(permissions.hasAttribute('department', 'content')).toBe(true);
    });

    it('should combine auth custom validation with permission validators', () => {
      const auth = createAuthFlow({
        ...config,
        validateAuth: (tokens: TokenPair | null) => tokens !== null && Date.now() % 2 === 0,
      });

      // Set up tokens
      const adminClaims = { roles: ['admin'] };
      const adminToken = createJWTToken(adminClaims);

      auth.setTokens({
        accessToken: adminToken,
        refreshToken: 'refresh-token',
      });

      // Auth uses config custom validation
      const authResult = auth.isAuthenticated();

      // Permission validators work independently
      const roleValidator = Permissions.RBAC.requireRole('admin');
      const permissionResult = roleValidator({ accessToken: adminToken, refreshToken: 'refresh' });

      expect(typeof authResult).toBe('boolean'); // Based on custom logic
      expect(permissionResult).toBe(true); // Admin role exists
    });

    it('should support parameter override with permission system', () => {
      const auth = createAuthFlow({
        ...config,
        validateAuth: () => false, // Config always denies
      });

      const permissions = Permissions.createPermissionChecker(auth);

      // Set up tokens
      const userClaims = { roles: ['user'] };
      const userToken = createJWTToken(userClaims);

      auth.setTokens({
        accessToken: userToken,
        refreshToken: 'refresh-token',
      });

      // Config validator denies
      expect(auth.isAuthenticated()).toBe(false);

      // Parameter validator can override
      expect(auth.isAuthenticated(() => true)).toBe(true);

      // Permission system works regardless
      expect(permissions.hasRole('user')).toBe(true);
      expect(permissions.hasRole('admin')).toBe(false);
    });
  });

  describe('Permission System Features', () => {
    it('should work with RBAC validators as auth validators', () => {
      const auth = createAuthFlow({
        ...config,
        validateAuth: Permissions.RBAC.requireRole('admin'),
      });

      // Non-admin user
      const userClaims = { roles: ['user'] };
      const userToken = createJWTToken(userClaims);

      auth.setTokens({
        accessToken: userToken,
        refreshToken: 'refresh-token',
      });

      expect(auth.isAuthenticated()).toBe(false);

      // Admin user
      const adminClaims = { roles: ['admin'] };
      const adminToken = createJWTToken(adminClaims);

      auth.setTokens({
        accessToken: adminToken,
        refreshToken: 'refresh-token',
      });

      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should work with ABAC validators as auth validators', () => {
      const auth = createAuthFlow({
        ...config,
        validateAuth: Permissions.ABAC.requirePermission('admin:access'),
      });

      // User without permission
      const userClaims = { permissions: ['posts:read'] };
      const userToken = createJWTToken(userClaims);

      auth.setTokens({
        accessToken: userToken,
        refreshToken: 'refresh-token',
      });

      expect(auth.isAuthenticated()).toBe(false);

      // User with permission
      const adminClaims = { permissions: ['admin:access', 'posts:read'] };
      const adminToken = createJWTToken(adminClaims);

      auth.setTokens({
        accessToken: adminToken,
        refreshToken: 'refresh-token',
      });

      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should combine multiple validators', () => {
      const combinedValidator = Permissions.combineValidators(
        Permissions.RBAC.requireRole('manager'),
        Permissions.ABAC.requirePermission('approve:orders'),
        (tokens: TokenPair | null) => {
          if (!tokens) return false;
          const claims = JSON.parse(atob(tokens.accessToken.split('.')[1]));
          return claims?.department === 'sales';
        }
      );

      const auth = createAuthFlow({
        ...config,
        validateAuth: combinedValidator,
      });

      // User missing requirements
      const incompleteClaims = {
        roles: ['manager'],
        permissions: ['approve:orders'],
        // Missing department
      };
      const incompleteToken = createJWTToken(incompleteClaims);

      auth.setTokens({
        accessToken: incompleteToken,
        refreshToken: 'refresh-token',
      });

      expect(auth.isAuthenticated()).toBe(false);

      // User with all requirements
      const completeClaims = {
        roles: ['manager'],
        permissions: ['approve:orders'],
        department: 'sales',
      };
      const completeToken = createJWTToken(completeClaims);

      auth.setTokens({
        accessToken: completeToken,
        refreshToken: 'refresh-token',
      });

      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('Permission Checker Usage', () => {
    it('should provide granular permission checking', () => {
      const auth = createAuthFlow(config);
      const permissions = Permissions.createPermissionChecker(auth);

      // Set up tokens using the auth API
      const claims = {
        roles: ['editor', 'reviewer'],
        permissions: ['posts:write', 'posts:publish'],
        department: 'content',
        level: 'senior',
      };
      const token = createJWTToken(claims);

      auth.setTokens({
        accessToken: token,
        refreshToken: 'refresh-token',
      });

      // Role checks
      expect(permissions.hasRole('editor')).toBe(true);
      expect(permissions.hasRole('admin')).toBe(false);
      expect(permissions.hasAnyRole('admin', 'editor')).toBe(true);
      expect(permissions.hasAllRoles('editor', 'reviewer')).toBe(true);
      expect(permissions.hasAllRoles('editor', 'admin')).toBe(false);

      // Permission checks
      expect(permissions.hasPermission('posts:write')).toBe(true);
      expect(permissions.hasPermission('admin:access')).toBe(false);
      expect(permissions.hasAnyPermission('admin:access', 'posts:write')).toBe(true);
      expect(permissions.hasAllPermissions('posts:write', 'posts:publish')).toBe(true);

      // Attribute checks
      expect(permissions.hasAttribute('department', 'content')).toBe(true);
      expect(permissions.hasAttribute('level', 'senior')).toBe(true);
      expect(permissions.hasAttribute('department', 'marketing')).toBe(false);

      // Custom validator check
      const customValidator = (tokens: TokenPair | null) => {
        if (!tokens) return false;
        const userClaims = JSON.parse(atob(tokens.accessToken.split('.')[1]));
        return userClaims.level === 'senior' && userClaims.department === 'content';
      };
      expect(permissions.check(customValidator)).toBe(true);
    });

    it('should handle missing tokens gracefully', () => {
      const auth = createAuthFlow(config);
      const permissions = Permissions.createPermissionChecker(auth);

      // No tokens in storage
      expect(permissions.hasRole('admin')).toBe(false);
      expect(permissions.hasPermission('any:permission')).toBe(false);
      expect(permissions.hasAttribute('any', 'value')).toBe(false);
      expect(permissions.getClaims()).toBe(null);
      expect(permissions.isAuthenticated()).toBe(false);
    });
  });

  describe('Framework Integration Patterns', () => {
    it('should provide guard utilities for component protection', () => {
      const auth = createAuthFlow(config);

      // Set up tokens using auth API
      const claims = { roles: ['admin'] };
      const token = createJWTToken(claims);

      auth.setTokens({
        accessToken: token,
        refreshToken: 'refresh-token',
      });

      // Create guards
      const RoleGuard = Permissions.createRoleGuard((hasRole, children, fallback) => {
        return hasRole ? children : fallback;
      });

      const PermissionGuard = Permissions.createPermissionGrantGuard(
        (hasPermission, children, fallback) => {
          return hasPermission ? children : fallback;
        }
      );

      // Test role guard
      const roleGuardResult = RoleGuard({
        auth,
        role: 'admin',
        children: 'Admin Content',
        fallback: 'Access Denied',
      });
      expect(roleGuardResult).toBe('Admin Content');

      // Test permission guard
      const permissionGuardResult = PermissionGuard({
        auth,
        permission: 'nonexistent:permission',
        children: 'Protected Content',
        fallback: 'Access Denied',
      });
      expect(permissionGuardResult).toBe('Access Denied');
    });
  });
});
