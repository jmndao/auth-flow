import {
  TokenPair,
  UserClaims,
  RBACConfig,
  ABACConfig,
  ABACRule,
  PermissionValidator,
} from '../types';

/**
 * Extract user claims from JWT token
 */
function extractClaims(token: string): UserClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if user has required roles
 */
function hasRequiredRoles(
  userRoles: string[] = [],
  requiredRoles: string[],
  mode: 'any' | 'all'
): boolean {
  if (requiredRoles.length === 0) return true;

  return mode === 'any'
    ? requiredRoles.some((role) => userRoles.includes(role))
    : requiredRoles.every((role) => userRoles.includes(role));
}

/**
 * Evaluate ABAC rules against user claims
 */
function evaluateRules(claims: UserClaims, rules: ABACRule[], mode: 'any' | 'all'): boolean {
  if (rules.length === 0) return true;

  return mode === 'any'
    ? rules.some((rule) => rule.condition(claims))
    : rules.every((rule) => rule.condition(claims));
}

/**
 * RBAC Validators
 */
export const RBAC = {
  /**
   * Create RBAC validator
   */
  create(config: RBACConfig): PermissionValidator {
    return (tokens: TokenPair | null): boolean => {
      if (!tokens) return false;

      const claims = extractClaims(tokens.accessToken);
      if (!claims) return false;

      return hasRequiredRoles(claims.roles, config.requiredRoles, config.mode);
    };
  },

  /**
   * Require specific role
   */
  requireRole(role: string): PermissionValidator {
    return RBAC.create({ requiredRoles: [role], mode: 'any' });
  },

  /**
   * Require any of the specified roles
   */
  requireAnyRole(...roles: string[]): PermissionValidator {
    return RBAC.create({ requiredRoles: roles, mode: 'any' });
  },

  /**
   * Require all specified roles
   */
  requireAllRoles(...roles: string[]): PermissionValidator {
    return RBAC.create({ requiredRoles: roles, mode: 'all' });
  },
};

/**
 * ABAC Rule builders
 */
export const Rules = {
  /**
   * User has specific permission
   */
  hasPermission: (permission: string): ABACRule => ({
    resource: 'permission',
    action: 'check',
    condition: (claims) => claims.permissions?.includes(permission) ?? false,
  }),

  /**
   * User belongs to specific department
   */
  inDepartment: (department: string): ABACRule => ({
    resource: 'department',
    action: 'check',
    condition: (claims) => claims.department === department,
  }),

  /**
   * User has specific attribute value
   */
  hasAttribute: (key: string, value: any): ABACRule => ({
    resource: 'attribute',
    action: 'check',
    condition: (claims) => claims[key] === value,
  }),

  /**
   * Custom condition rule
   */
  custom: (
    resource: string,
    action: string,
    condition: (claims: UserClaims) => boolean
  ): ABACRule => ({
    resource,
    action,
    condition,
  }),
};

/**
 * ABAC Validators
 */
export const ABAC = {
  /**
   * Create ABAC validator
   */
  create(config: ABACConfig): PermissionValidator {
    return (tokens: TokenPair | null): boolean => {
      if (!tokens) return false;

      const claims = extractClaims(tokens.accessToken);
      if (!claims) return false;

      return evaluateRules(claims, config.rules, config.mode);
    };
  },

  /**
   * Require specific permission
   */
  requirePermission(permission: string): PermissionValidator {
    return ABAC.create({
      rules: [Rules.hasPermission(permission)],
      mode: 'all',
    });
  },

  /**
   * Require any of the specified permissions
   */
  requireAnyPermission(...permissions: string[]): PermissionValidator {
    return ABAC.create({
      rules: permissions.map((p) => Rules.hasPermission(p)),
      mode: 'any',
    });
  },

  /**
   * Require all specified permissions
   */
  requireAllPermissions(...permissions: string[]): PermissionValidator {
    return ABAC.create({
      rules: permissions.map((p) => Rules.hasPermission(p)),
      mode: 'all',
    });
  },
};

/**
 * Utility to combine multiple validators
 */
export function combineValidators(...validators: PermissionValidator[]): PermissionValidator {
  return (tokens: TokenPair | null): boolean => {
    return validators.every((validator) => validator(tokens));
  };
}
