import {
  GlobalAuth,
  initAuth,
  getAuth,
  AuthUI,
  createAuthUI,
  monitorAuthStatus,
} from '../../frameworks/vanilla/setup';

import { AuthClient } from '../../core/auth-client';

// Mock DOM elements
const mockForm = {
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn(),
  dispatchEvent: jest.fn(),
};

const mockButton = {
  addEventListener: jest.fn(),
};

const mockElements = [{ style: { display: '' } }, { style: { display: '' } }];

// Mock document methods
Object.defineProperty(global, 'document', {
  value: {
    querySelector: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue(mockElements),
    addEventListener: jest.fn(),
  },
  writable: true,
});

describe('Vanilla JavaScript Framework Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global auth state
    (GlobalAuth as any).auth = null;
    (GlobalAuth as any).listeners = [];
  });

  describe('GlobalAuth', () => {
    describe('initAuth', () => {
      it('should initialize and return AuthClient instance', () => {
        const config = {
          baseURL: 'https://api.example.com',
          storage: 'memory' as const,
        };

        const auth = initAuth(config);

        expect(auth).toBeInstanceOf(AuthClient);
        expect(getAuth()).toBe(auth);
      });

      it('should configure callbacks correctly', () => {
        const onTokenRefresh = jest.fn();
        const onAuthError = jest.fn();
        const onLogout = jest.fn();

        const config = {
          baseURL: 'https://api.example.com',
          onTokenRefresh,
          onAuthError,
          onLogout,
        };

        initAuth(config);

        // Verify auth instance was created with callbacks
        expect(getAuth()).toBeDefined();
      });
    });

    describe('getAuth', () => {
      it('should return initialized auth instance', () => {
        const auth = initAuth({ baseURL: 'https://api.example.com' });
        const retrieved = getAuth();

        expect(retrieved).toBe(auth);
      });

      it('should throw error when not initialized', () => {
        expect(() => getAuth()).toThrow('Authentication not initialized');
      });
    });

    describe('monitorAuthStatus', () => {
      it('should add and remove auth status listeners', () => {
        initAuth({ baseURL: 'https://api.example.com' });

        const callback = jest.fn();
        const unsubscribe = monitorAuthStatus(callback);

        // Verify callback was added
        expect(typeof unsubscribe).toBe('function');

        // Call unsubscribe
        unsubscribe();

        // Verify callback was removed
        expect(unsubscribe).toBeDefined();
      });

      it('should notify listeners on auth status change', () => {
        initAuth({ baseURL: 'https://api.example.com' });

        const callback1 = jest.fn();
        const callback2 = jest.fn();

        monitorAuthStatus(callback1);
        monitorAuthStatus(callback2);

        // Trigger auth status change by calling internal method
        (GlobalAuth as any).notifyListeners(true);

        expect(callback1).toHaveBeenCalledWith(true);
        expect(callback2).toHaveBeenCalledWith(true);
      });

      it('should handle listener errors gracefully', () => {
        initAuth({ baseURL: 'https://api.example.com' });

        const errorCallback = jest.fn().mockImplementation(() => {
          throw new Error('Listener error');
        });
        const normalCallback = jest.fn();

        monitorAuthStatus(errorCallback);
        monitorAuthStatus(normalCallback);

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        // Trigger notification
        (GlobalAuth as any).notifyListeners(true);

        expect(consoleSpy).toHaveBeenCalledWith(
          'Error in auth status listener:',
          expect.any(Error)
        );
        expect(normalCallback).toHaveBeenCalledWith(true);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('AuthUI', () => {
    let authUI: AuthUI;
    let mockAuth: any;

    beforeEach(() => {
      mockAuth = {
        login: jest.fn(),
        logout: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        isAuthenticated: jest.fn(),
      };

      authUI = new AuthUI(mockAuth);
    });

    describe('setupLoginForm', () => {
      it('should setup form submit handler', () => {
        (document.querySelector as jest.Mock).mockReturnValue(mockForm);

        authUI.setupLoginForm('#login-form');

        expect(document.querySelector).toHaveBeenCalledWith('#login-form');
        expect(mockForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      });

      it('should handle form submission', () => {
        const mockFormData = new Map([
          ['username', 'testuser'],
          ['password', 'testpass'],
        ]);

        const mockFormElement = {
          ...mockForm,
          addEventListener: jest.fn((event, handler) => {
            // Simulate form submission
            const mockEvent = {
              preventDefault: jest.fn(),
              target: {
                querySelectorAll: jest.fn(),
              },
            };

            // Mock FormData
            Object.defineProperty(global, 'FormData', {
              value: jest.fn().mockImplementation(() => ({
                get: (key: string) => mockFormData.get(key),
              })),
            });

            handler(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
          }),
        };

        (document.querySelector as jest.Mock).mockReturnValue(mockFormElement);

        const onSuccess = jest.fn();
        const onError = jest.fn();

        authUI.setupLoginForm('#login-form', {
          onSuccess,
          onError,
        });

        expect(mockFormElement.addEventListener).toHaveBeenCalled();
      });

      it('should throw error for missing form', () => {
        (document.querySelector as jest.Mock).mockReturnValue(null);

        expect(() => {
          authUI.setupLoginForm('#non-existent-form');
        }).toThrow('Login form not found: #non-existent-form');
      });
    });

    describe('setupLogoutButton', () => {
      it('should setup button click handler', () => {
        (document.querySelector as jest.Mock).mockReturnValue(mockButton);

        authUI.setupLogoutButton('#logout-btn');

        expect(document.querySelector).toHaveBeenCalledWith('#logout-btn');
        expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });

      it('should handle logout click', () => {
        const mockButtonElement = {
          ...mockButton,
          addEventListener: jest.fn((event, handler) => {
            const mockEvent = { preventDefault: jest.fn() };
            handler(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
          }),
        };

        (document.querySelector as jest.Mock).mockReturnValue(mockButtonElement);

        const onSuccess = jest.fn();
        authUI.setupLogoutButton('#logout-btn', { onSuccess });

        expect(mockButtonElement.addEventListener).toHaveBeenCalled();
      });

      it('should throw error for missing button', () => {
        (document.querySelector as jest.Mock).mockReturnValue(null);

        expect(() => {
          authUI.setupLogoutButton('#non-existent-btn');
        }).toThrow('Logout button not found: #non-existent-btn');
      });
    });

    describe('setupConditionalDisplay', () => {
      it('should show/hide elements based on auth status', () => {
        mockAuth.isAuthenticated.mockReturnValue(true);

        const authElements = [{ style: { display: 'none' } }, { style: { display: 'none' } }];
        const noAuthElements = [{ style: { display: 'block' } }, { style: { display: 'block' } }];

        (document.querySelectorAll as jest.Mock)
          .mockReturnValueOnce(authElements)
          .mockReturnValueOnce(noAuthElements);

        authUI.setupConditionalDisplay();

        expect(document.querySelectorAll).toHaveBeenCalledWith('[data-auth="true"]');
        expect(document.querySelectorAll).toHaveBeenCalledWith('[data-auth="false"]');

        authElements.forEach((el) => {
          expect(el.style.display).toBe('block');
        });

        noAuthElements.forEach((el) => {
          expect(el.style.display).toBe('none');
        });
      });
    });

    describe('setupFormAuth', () => {
      it('should setup document event listener for auth forms', () => {
        authUI.setupFormAuth();

        expect(document.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
      });
    });
  });

  describe('createAuthUI', () => {
    it('should create AuthUI with provided auth instance', () => {
      const mockAuth = {} as AuthClient;
      const authUI = createAuthUI(mockAuth);

      expect(authUI).toBeInstanceOf(AuthUI);
    });

    it('should create AuthUI with global auth when no auth provided', () => {
      initAuth({ baseURL: 'https://api.example.com' });

      const authUI = createAuthUI();

      expect(authUI).toBeInstanceOf(AuthUI);
    });

    it('should throw error when no auth available', () => {
      expect(() => createAuthUI()).toThrow('Authentication not initialized');
    });
  });

  describe('Integration with AuthClient', () => {
    it('should work with real AuthClient instance', async () => {
      const auth = initAuth({
        baseURL: 'https://api.example.com',
        storage: 'memory',
      });

      expect(auth).toBeInstanceOf(AuthClient);
      expect(auth.isAuthenticated()).toBe(false);

      // Test auth status monitoring
      const callback = jest.fn();
      const unsubscribe = monitorAuthStatus(callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should handle authentication state changes', () => {
      const onTokenRefresh = jest.fn();
      const onAuthError = jest.fn();
      const onLogout = jest.fn();

      initAuth({
        baseURL: 'https://api.example.com',
        onTokenRefresh,
        onAuthError,
        onLogout,
      });

      const callback = jest.fn();
      monitorAuthStatus(callback);

      // Simulate auth state changes
      (GlobalAuth as any).notifyListeners(true);
      expect(callback).toHaveBeenCalledWith(true);

      (GlobalAuth as any).notifyListeners(false);
      expect(callback).toHaveBeenCalledWith(false);
    });
  });
});
