import { MemoryStorage } from '../storage/memory';
import { BrowserStorage } from '../storage/browser';
import { CookieStorage } from '../storage/cookie';

describe('Storage Adapters', () => {
  describe('MemoryStorage', () => {
    let storage: MemoryStorage;

    beforeEach(() => {
      storage = new MemoryStorage();
    });

    it('should store and retrieve values', () => {
      storage.set('key1', 'value1');
      expect(storage.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(storage.get('non-existent')).toBeNull();
    });

    it('should remove values', () => {
      storage.set('key1', 'value1');
      storage.remove('key1');
      expect(storage.get('key1')).toBeNull();
    });

    it('should clear all values', () => {
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');
      storage.clear();
      expect(storage.get('key1')).toBeNull();
      expect(storage.get('key2')).toBeNull();
    });
  });

  describe('BrowserStorage', () => {
    let storage: BrowserStorage;

    beforeEach(() => {
      storage = new BrowserStorage();
    });

    it('should use localStorage when available', () => {
      const mockGetItem = jest.fn().mockReturnValue('test-value');
      const mockSetItem = jest.fn();
      const mockRemoveItem = jest.fn();

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: mockSetItem,
          removeItem: mockRemoveItem,
        },
        writable: true,
      });

      storage = new BrowserStorage();
      storage.set('test-key', 'test-value');
      expect(mockSetItem).toHaveBeenCalledWith('test-key', 'test-value');

      const value = storage.get('test-key');
      expect(mockGetItem).toHaveBeenCalledWith('test-key');
      expect(value).toBe('test-value');

      storage.remove('test-key');
      expect(mockRemoveItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle localStorage errors gracefully', () => {
      const mockGetItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage disabled');
      });

      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true,
      });

      storage = new BrowserStorage();
      expect(storage.get('test-key')).toBeNull();
    });
  });

  describe('CookieStorage', () => {
    let storage: CookieStorage;

    beforeEach(() => {
      storage = new CookieStorage();
      // Mock document.cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
    });

    it('should set and get cookies in browser environment', async () => {
      // Mock document.cookie getter/setter
      let cookieValue = '';
      Object.defineProperty(document, 'cookie', {
        get: () => cookieValue,
        set: (value) => {
          cookieValue = value;
        },
        configurable: true,
      });

      await storage.set('test-key', 'test-value');
      expect(cookieValue).toContain('test-key=test-value');
    });

    it('should handle server environment gracefully', async () => {
      // Mock server environment
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      storage = new CookieStorage();

      // Should not throw errors
      await expect(storage.set('test-key', 'test-value')).resolves.not.toThrow();
      await expect(storage.get('test-key')).resolves.toBeNull();
    });
  });
});
