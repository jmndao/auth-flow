import type { AuthFlowV2Config, AuthFlowV2Client } from './types/authflow-v2';
import type { AuthContext } from './types/config';
import { AuthFlowV2ClientImpl } from './core/authflow-v2-client';

export { createAuthFlow, createSingleTokenAuth } from './index';
export type {
  TokenPair,
  AuthError,
  LoginCredentials,
  LoginResponse,
  AuthFlowConfig,
  AuthContext,
} from './index';

export type {
  AuthFlowV2Config,
  AuthFlowV2Client,
  V2RequestConfig,
  DebugInfo,
  AnalyticsEvent,
} from './types/authflow-v2';

export const createAuthFlowV2 = (
  config: string | Partial<AuthFlowV2Config>,
  context?: AuthContext
): AuthFlowV2Client => {
  const baseConfig: AuthFlowV2Config =
    typeof config === 'string'
      ? {
          baseURL: config,
          endpoints: {
            login: '/auth/login',
            refresh: '/auth/refresh',
            logout: '/auth/logout',
          },
          tokens: {
            access: 'accessToken',
            refresh: 'refreshToken',
          },
        }
      : {
          endpoints: {
            login: '/auth/login',
            refresh: '/auth/refresh',
            logout: '/auth/logout',
          },
          tokens: {
            access: 'accessToken',
            refresh: 'refreshToken',
          },
          ...config,
        };

  return new AuthFlowV2ClientImpl(baseConfig, context);
};

export type CreateAuthFlowV2 = typeof createAuthFlowV2;
