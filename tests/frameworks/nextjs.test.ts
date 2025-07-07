import {
  createServerActionAuth,
  setAuthCookies,
  clearAuthCookies,
  getAuthTokens,
  isAuthenticated,
  loginAction,
  logoutAction,
} from '../../frameworks/nextjs/server-actions';

import { createAuthMiddleware, getAuthStatus } from '../../frameworks/nextjs/middleware';

import { AuthClient } from '../../core/auth-client';

// Mock Next.js headers
const mockCookies = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => mockCookies),
}));

describe('Next.js Framework Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Server Actions', () => {
    describe('createServerActionAuth', () => {
      it('should create auth client with cookies storage', () => {
        const auth = createServerActionAuth({
          baseURL: 'https://api.example.com',
        });

        expect(auth).toBeInstanceOf(AuthClient);
      });
    });

    describe('setAuthCookies', () => {
      it('should set access and refresh token cookies', async () => {
        const tokens = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        };

        await setAuthCookies(tokens);

        expect(mockCookies.set).toHaveBeenCalledWith(
          'accessToken',
          'access-token',
          expect.objectContaining({
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            httpOnly: false,
          })
        );

        expect(mockCookies.set).toHaveBeenCalledWith(
          'refreshToken',
          'refresh-token',
          expect.objectContaining({
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            httpOnly: false,
          })
        );
      });

      it('should throw error when cookies() fails', async () => {
        const originalConsoleError = console.error;
        console.error = jest.fn();

        // Mock cookies to throw error
        jest.doMock('next/headers', () => ({
          cookies: jest.fn(() => {
            throw new Error('cookies() failed');
          }),
        }));

        const tokens = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        };

        await expect(setAuthCookies(tokens)).rejects.toThrow(
          'Failed to set authentication cookies in server action'
        );

        console.error = originalConsoleError;
      });
    });

    describe('clearAuthCookies', () => {
      it('should delete access and refresh token cookies', async () => {
        await clearAuthCookies();

        expect(mockCookies.delete).toHaveBeenCalledWith('accessToken');
        expect(mockCookies.delete).toHaveBeenCalledWith('refreshToken');
      });
    });

    describe('getAuthTokens', () => {
      it('should retrieve tokens from cookies', async () => {
        mockCookies.get.mockImplementation((key) => {
          if (key === 'accessToken') return { value: 'access-token' };
          if (key === 'refreshToken') return { value: 'refresh-token' };
          return undefined;
        });

        const tokens = await getAuthTokens();

        expect(tokens).toEqual({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });
      });

      it('should return null when tokens are missing', async () => {
        mockCookies.get.mockReturnValue(undefined);

        const tokens = await getAuthTokens();

        expect(tokens).toBeNull();
      });
    });

    describe('isAuthenticated', () => {
      it('should return true for valid non-expired tokens', async () => {
        const futureExp = Math.floor(Date.now() / 1000) + 3600;
        const payload = { exp: futureExp };
        const validToken = `header.${btoa(JSON.stringify(payload))}.signature`;

        mockCookies.get.mockImplementation((key) => {
          if (key === 'accessToken') return { value: validToken };
          if (key === 'refreshToken') return { value: 'refresh-token' };
          return undefined;
        });

        const result = await isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false for expired tokens', async () => {
        const pastExp = Math.floor(Date.now() / 1000) - 3600;
        const payload = { exp: pastExp };
        const expiredToken = `header.${btoa(JSON.stringify(payload))}.signature`;

        mockCookies.get.mockImplementation((key) => {
          if (key === 'accessToken') return { value: expiredToken };
          if (key === 'refreshToken') return { value: 'refresh-token' };
          return undefined;
        });

        const result = await isAuthenticated();

        expect(result).toBe(false);
      });

      it('should return false when no tokens exist', async () => {
        mockCookies.get.mockReturnValue(undefined);

        const result = await isAuthenticated();

        expect(result).toBe(false);
      });
    });

    describe('loginAction', () => {
      it('should login successfully and set cookies', async () => {
        const mockAuth = {
          login: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
          getTokens: jest.fn().mockResolvedValue({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          }),
        } as any;

        const result = await loginAction(mockAuth, {
          email: 'test@example.com',
          password: 'password',
        });

        expect(mockAuth.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
        });
        expect(result).toEqual({ success: true });
      });

      it('should return error on login failure', async () => {
        const mockAuth = {
          login: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
        } as any;

        const result = await loginAction(mockAuth, {
          email: 'test@example.com',
          password: 'wrong',
        });

        expect(result).toEqual({
          success: false,
          error: 'Invalid credentials',
        });
      });
    });

    describe('logoutAction', () => {
      it('should logout and clear cookies', async () => {
        const mockAuth = {
          logout: jest.fn().mockResolvedValue(undefined),
        } as any;

        await logoutAction(mockAuth);

        expect(mockAuth.logout).toHaveBeenCalled();
        expect(mockCookies.delete).toHaveBeenCalledWith('accessToken');
        expect(mockCookies.delete).toHaveBeenCalledWith('refreshToken');
      });

      it('should clear cookies even if logout fails', async () => {
        const mockAuth = {
          logout: jest.fn().mockRejectedValue(new Error('Logout failed')),
        } as any;

        await logoutAction(mockAuth);

        expect(mockCookies.delete).toHaveBeenCalledWith('accessToken');
        expect(mockCookies.delete).toHaveBeenCalledWith('refreshToken');
      });
    });
  });

  describe('Middleware', () => {
    describe('createAuthMiddleware', () => {
      it('should create middleware function', () => {
        const middleware = createAuthMiddleware();
        expect(typeof middleware).toBe('function');
      });

      it('should allow public paths', async () => {
        const middleware = createAuthMiddleware({
          publicPaths: ['/login', '/register'],
        });

        const mockRequest = {
          nextUrl: { pathname: '/login' },
          cookies: { get: jest.fn() },
        };

        const NextResponse = {
          next: jest.fn(),
          redirect: jest.fn(),
        };

        jest.doMock('next/server', () => ({ NextResponse }));

        const result = await middleware(mockRequest);

        expect(NextResponse.next).toHaveBeenCalled();
      });
    });

    describe('getAuthStatus', () => {
      it('should return auth status from request', () => {
        const futureExp = Math.floor(Date.now() / 1000) + 3600;
        const payload = { exp: futureExp };
        const validToken = `header.${btoa(JSON.stringify(payload))}.signature`;

        const mockRequest = {
          cookies: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'accessToken') return { value: validToken };
              if (key === 'refreshToken') return { value: 'refresh-token' };
              return undefined;
            }),
          },
        };

        const status = getAuthStatus(mockRequest);

        expect(status).toEqual({
          hasTokens: true,
          accessTokenValid: true,
          refreshTokenValid: true,
        });
      });

      it('should handle missing tokens', () => {
        const mockRequest = {
          cookies: {
            get: jest.fn().mockReturnValue(undefined),
          },
        };

        const status = getAuthStatus(mockRequest);

        expect(status).toEqual({
          hasTokens: false,
          accessTokenValid: false,
          refreshTokenValid: false,
        });
      });
    });
  });
});
