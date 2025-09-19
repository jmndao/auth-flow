/**
 * Permission system - separate from core authentication
 */

// Permission checker
export { PermissionChecker, createPermissionChecker } from './permission-checker';

// Validators
export { RBAC, ABAC, Rules, combineValidators } from './validators';

// Guard utilities
export {
  BasePermissionGuard,
  createPermissionGuard,
  createRoleGuard,
  createPermissionGrantGuard,
} from './guards';

// Types
export type { PermissionValidator, UserClaims, RBACConfig, ABACConfig, ABACRule } from '../types';
