import {
  createReactAuthGuard,
  createWithAuth,
  AUTH_CONTEXT_KEY,
} from '../../frameworks/react/hooks';

import { AuthClient } from '../../core/auth-client';

describe('React Framework Integration', () => {
  describe('createReactAuthGuard', () => {
    it('should render children when authenticated', () => {
      const authChecker = jest.fn().mockReturnValue(true);
      const AuthGuard = createReactAuthGuard(authChecker);

      const children = 'Protected Content';
      const fallback = 'Please Login';

      const result = AuthGuard({ children, fallback });

      expect(result).toBe(children);
      expect(authChecker).toHaveBeenCalled();
    });

    it('should render fallback when not authenticated', () => {
      const authChecker = jest.fn().mockReturnValue(false);
      const AuthGuard = createReactAuthGuard(authChecker);

      const children = 'Protected Content';
      const fallback = 'Please Login';

      const result = AuthGuard({ children, fallback });

      expect(result).toBe(fallback);
      expect(authChecker).toHaveBeenCalled();
    });
  });

  describe('createWithAuth', () => {
    it('should render component when authenticated', () => {
      const mockAuth = {
        isAuthenticated: jest.fn().mockReturnValue(true),
      } as any;

      const getAuth = jest.fn().mockReturnValue(mockAuth);
      const withAuth = createWithAuth(getAuth);

      const MockComponent = jest.fn().mockReturnValue('Component Content');
      const WrappedComponent = withAuth(MockComponent);

      const props = { test: 'prop' };
      const result = WrappedComponent(props);

      expect(MockComponent).toHaveBeenCalledWith(props);
      expect(result).toBe('Component Content');
      expect(getAuth).toHaveBeenCalled();
      expect(mockAuth.isAuthenticated).toHaveBeenCalled();
    });

    it('should return null when not authenticated', () => {
      const mockAuth = {
        isAuthenticated: jest.fn().mockReturnValue(false),
      } as any;

      const getAuth = jest.fn().mockReturnValue(mockAuth);
      const withAuth = createWithAuth(getAuth);

      const MockComponent = jest.fn();
      const WrappedComponent = withAuth(MockComponent);

      const result = WrappedComponent({ test: 'prop' });

      expect(MockComponent).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(mockAuth.isAuthenticated).toHaveBeenCalled();
    });
  });

  describe('Type Definitions', () => {
    it('should export AUTH_CONTEXT_KEY', () => {
      expect(AUTH_CONTEXT_KEY).toBeDefined();
      expect(typeof AUTH_CONTEXT_KEY).toBe('symbol');
    });
  });

  describe('Integration with AuthClient', () => {
    let authClient: AuthClient;

    beforeEach(() => {
      authClient = new AuthClient({
        baseURL: 'https://api.example.com',
        storage: 'memory',
      });
    });

    it('should work with real AuthClient instance', () => {
      const getAuth = () => authClient;
      const authChecker = () => authClient.isAuthenticated();

      const AuthGuard = createReactAuthGuard(authChecker);
      const withAuth = createWithAuth(getAuth);

      // Initially not authenticated
      expect(authChecker()).toBe(false);

      const result = AuthGuard({
        children: 'Protected',
        fallback: 'Login Required',
      });

      expect(result).toBe('Login Required');

      // Test HOC
      const TestComponent = () => 'Test Component';
      const ProtectedComponent = withAuth(TestComponent);

      expect(ProtectedComponent({})).toBeNull();
    });

    it('should handle authentication state changes', async () => {
      // Mock successful login
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            user: { id: '1', email: 'test@example.com' },
          }),
      });

      await authClient.login({
        email: 'test@example.com',
        password: 'password',
      });

      const authChecker = () => authClient.isAuthenticated();
      const AuthGuard = createReactAuthGuard(authChecker);

      // Now should be authenticated
      expect(authChecker()).toBe(true);

      const result = AuthGuard({
        children: 'Protected Content',
        fallback: 'Login Required',
      });

      expect(result).toBe('Protected Content');
    });
  });

  describe('Error Handling', () => {
    it('should handle auth checker errors gracefully', () => {
      const authChecker = jest.fn().mockImplementation(() => {
        throw new Error('Auth check failed');
      });

      const AuthGuard = createReactAuthGuard(authChecker);

      expect(() => {
        AuthGuard({
          children: 'Protected',
          fallback: 'Login Required',
        });
      }).toThrow('Auth check failed');
    });

    it('should handle getAuth errors in HOC', () => {
      const getAuth = jest.fn().mockImplementation(() => {
        throw new Error('Cannot get auth');
      });

      const withAuth = createWithAuth(getAuth);
      const TestComponent = () => 'Test';
      const WrappedComponent = withAuth(TestComponent);

      expect(() => {
        WrappedComponent({});
      }).toThrow('Cannot get auth');
    });
  });
});
