/**
 * AuthFlow - Simple authentication flow for client-side applications
 * Clean separation between auth and permissions
 */

import { Auth } from './auth';
import { AuthFlowConfig } from './types';

/**
 * Create AuthFlow instance (main entry point)
 */
export function createAuthFlow(config: AuthFlowConfig): Auth {
  return new Auth(config);
}

/**
 * Export core Auth class
 */
export { Auth } from './auth';

/**
 * Export core types
 */
export type {
  AuthFlowConfig,
  TokenPair,
  LoginCredentials,
  AuthError,
  HttpResponse,
  RequestConfig,
  AuthValidator,
} from './types';

/**
 * Export permission system as separate module
 */
export * as Permissions from './permissions';
