import { Auth } from '../auth';
import { PermissionValidator } from '../types';
import { PermissionChecker } from './permission-checker';

/**
 * Permission guard interface for components
 */
export interface PermissionGuardConfig {
  auth: Auth;
  fallback?: any; // React.ReactNode or similar
  onDenied?: (() => void) | undefined;
}

/**
 * Base guard class that can be extended for different frameworks
 */
export class BasePermissionGuard {
  protected auth: Auth;
  protected permissions: PermissionChecker;
  protected fallback: any;
  protected onDenied: (() => void) | undefined;

  constructor(config: PermissionGuardConfig) {
    this.auth = config.auth;
    this.permissions = new PermissionChecker(config.auth);
    this.fallback = config.fallback;
    this.onDenied = config.onDenied;
  }

  /**
   * Check if permission is granted
   */
  protected checkPermission(validator: PermissionValidator): boolean {
    const hasPermission = this.permissions.check(validator);

    if (!hasPermission && this.onDenied) {
      this.onDenied();
    }

    return hasPermission;
  }

  /**
   * Render content or fallback
   */
  protected renderContent(hasPermission: boolean, children: any): any {
    return hasPermission ? children : this.fallback || null;
  }
}

/**
 * Generic permission guard factory
 */
export function createPermissionGuard<T>(
  renderFunction: (hasPermission: boolean, children: T, fallback?: T) => T
) {
  return function PermissionGuard(props: {
    auth: Auth;
    validator: PermissionValidator;
    children: T;
    fallback?: T;
    onDenied?: () => void;
  }): T {
    const permissions = new PermissionChecker(props.auth);
    const hasPermission = permissions.check(props.validator);

    if (!hasPermission && props.onDenied) {
      props.onDenied();
    }

    return renderFunction(hasPermission, props.children, props.fallback);
  };
}

/**
 * Role guard factory
 */
export function createRoleGuard<T>(
  renderFunction: (hasPermission: boolean, children: T, fallback?: T) => T
) {
  return function RoleGuard(props: {
    auth: Auth;
    role: string;
    children: T;
    fallback?: T;
    onDenied?: () => void;
  }): T {
    const permissions = new PermissionChecker(props.auth);
    const hasRole = permissions.hasRole(props.role);

    if (!hasRole && props.onDenied) {
      props.onDenied();
    }

    return renderFunction(hasRole, props.children, props.fallback);
  };
}

/**
 * Permission guard factory
 */
export function createPermissionGrantGuard<T>(
  renderFunction: (hasPermission: boolean, children: T, fallback?: T) => T
) {
  return function PermissionGrantGuard(props: {
    auth: Auth;
    permission: string;
    children: T;
    fallback?: T;
    onDenied?: () => void;
  }): T {
    const permissions = new PermissionChecker(props.auth);
    const hasPermission = permissions.hasPermission(props.permission);

    if (!hasPermission && props.onDenied) {
      props.onDenied();
    }

    return renderFunction(hasPermission, props.children, props.fallback);
  };
}
