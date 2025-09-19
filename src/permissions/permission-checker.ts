import { TokenPair, UserClaims, PermissionValidator } from '../types';
import { extractJWTClaims } from '../utils/jwt';
import { Auth } from '../auth';

/**
 * Permission checker that works with Auth instance
 */
export class PermissionChecker {
  private readonly auth: Auth;

  constructor(auth: Auth) {
    this.auth = auth;
  }

  /**
   * Get current tokens from auth instance
   */
  private getTokens(): TokenPair | null {
    return this.auth.getTokens();
  }

  /**
   * Get current user claims using secure JWT utility
   */
  getClaims(): UserClaims | null {
    const tokens = this.getTokens();
    if (!tokens) return null;

    return extractJWTClaims(tokens.accessToken);
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const claims = this.getClaims();
    return claims?.roles?.includes(role) ?? false;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(...roles: string[]): boolean {
    const claims = this.getClaims();
    const userRoles = claims?.roles ?? [];
    return roles.some((role) => userRoles.includes(role));
  }

  /**
   * Check if user has all specified roles
   */
  hasAllRoles(...roles: string[]): boolean {
    const claims = this.getClaims();
    const userRoles = claims?.roles ?? [];
    return roles.every((role) => userRoles.includes(role));
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    const claims = this.getClaims();
    return claims?.permissions?.includes(permission) ?? false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(...permissions: string[]): boolean {
    const claims = this.getClaims();
    const userPermissions = claims?.permissions ?? [];
    return permissions.some((permission) => userPermissions.includes(permission));
  }

  /**
   * Check if user has all specified permissions
   */
  hasAllPermissions(...permissions: string[]): boolean {
    const claims = this.getClaims();
    const userPermissions = claims?.permissions ?? [];
    return permissions.every((permission) => userPermissions.includes(permission));
  }

  /**
   * Check if user has specific attribute value
   */
  hasAttribute(key: string, value: any): boolean {
    const claims = this.getClaims();
    return claims?.[key] === value;
  }

  /**
   * Check custom permission validator
   */
  check(validator: PermissionValidator): boolean {
    const tokens = this.getTokens();
    return validator(tokens);
  }

  /**
   * Check if user is authenticated (delegates to auth instance)
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }
}

/**
 * Create permission checker instance
 */
export function createPermissionChecker(auth: Auth): PermissionChecker {
  return new PermissionChecker(auth);
}
