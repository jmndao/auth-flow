import { MemoryStorageAdapter, CookieStorageAdapter, LocalStorageAdapter } from '../adapters';

describe('Storage Adapters', () => {
  describe('MemoryStorageAdapter', () => {
    let adapter: MemoryStorageAdapter;

    beforeEach(() => {
      adapter = new MemoryStorageAdapter();
    });

    test('should store and retrieve values', () => {
      adapter.set('testKey', 'testValue');
      expect(adapter.get('testKey')).toBe('testValue');
    });

    test('should return null for non-existent keys', () => {
      expect(adapter.get('nonExistentKey')).toBeNull();
    });

    test('should remove values', () => {
      adapter.set('testKey', 'testValue');
      adapter.remove('testKey');
      expect(adapter.get('testKey')).toBeNull();
    });

    test('should clear all values', () => {
      adapter.set('key1', 'value1');
      adapter.set('key2', 'value2');
      adapter.clear();
      expect(adapter.get('key1')).toBeNull();
      expect(adapter.get('key2')).toBeNull();
    });
  });

  describe('CookieStorageAdapter', () => {
    let adapter: CookieStorageAdapter;

    beforeEach(() => {
      adapter = new CookieStorageAdapter();
    });

    test('should handle cookie options', () => {
      const adapterWithOptions = new CookieStorageAdapter(
        {},
        {
          secure: true,
          sameSite: 'strict',
          maxAge: 3600,
        }
      );

      expect(adapterWithOptions).toBeInstanceOf(CookieStorageAdapter);
    });

    test('should handle server-side context', () => {
      // Mock the server environment by setting window to undefined
      const originalWindow = global.window;
      delete (global as any).window;

      const mockReq = {
        cookies: {
          testKey: 'testValue',
        },
      };

      const mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      };

      const serverAdapter = new CookieStorageAdapter(
        { req: mockReq, res: mockRes },
        { httpOnly: true }
      );

      expect(serverAdapter.get('testKey')).toBe('testValue');

      serverAdapter.set('newKey', 'newValue');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'newKey',
        'newValue',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
        })
      );

      // Restore window
      (global as any).window = originalWindow;
    });
  });

  describe('LocalStorageAdapter', () => {
    let adapter: LocalStorageAdapter;
    const mockLocalStorage = (global as any).localStorage;

    beforeEach(() => {
      // Reset localStorage mock
      mockLocalStorage.clear();
      mockLocalStorage.getItem.mockClear();
      mockLocalStorage.setItem.mockClear();
      mockLocalStorage.removeItem.mockClear();

      // Setup default behavior
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        return mockLocalStorage.__storage[key] || null;
      });

      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        mockLocalStorage.__storage[key] = value;
      });

      mockLocalStorage.removeItem.mockImplementation((key: string) => {
        delete mockLocalStorage.__storage[key];
      });

      mockLocalStorage.clear.mockImplementation(() => {
        mockLocalStorage.__storage = {};
      });

      mockLocalStorage.__storage = {};

      adapter = new LocalStorageAdapter();
    });

    test('should store and retrieve values', () => {
      adapter.set('testKey', 'testValue');
      expect(adapter.get('testKey')).toBe('testValue');
    });

    test('should return null for non-existent keys', () => {
      expect(adapter.get('nonExistentKey')).toBeNull();
    });

    test('should remove values', () => {
      adapter.set('testKey', 'testValue');
      adapter.remove('testKey');
      expect(adapter.get('testKey')).toBeNull();
    });

    test('should clear all values', () => {
      adapter.set('key1', 'value1');
      adapter.set('key2', 'value2');
      adapter.clear();
      expect(adapter.get('key1')).toBeNull();
      expect(adapter.get('key2')).toBeNull();
    });

    test('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // Should not throw, should return null
      expect(adapter.get('testKey')).toBeNull();

      // Should not throw
      expect(() => adapter.set('testKey', 'testValue')).not.toThrow();
    });

    test('should throw error when localStorage is not available', () => {
      // Mock window.localStorage to be undefined
      const originalLocalStorage = (global as any).localStorage;
      delete (global as any).localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
      });

      expect(() => new LocalStorageAdapter()).toThrow(
        'LocalStorage is not available in this environment'
      );

      // Restore localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      });
    });
  });
});
