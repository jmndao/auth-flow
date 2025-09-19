import { createStorage } from '../storage';

describe('Storage', () => {
  describe('createStorage', () => {
    it('should create memory storage', () => {
      const storage = createStorage('memory');

      storage.set('test-key', 'test-value');
      expect(storage.get('test-key')).toBe('test-value');

      storage.remove('test-key');
      expect(storage.get('test-key')).toBeNull();
    });

    it('should create localStorage adapter', () => {
      const mockStorage = window.localStorage as jest.Mocked<Storage>;
      mockStorage.getItem.mockReturnValue('test-value');
      mockStorage.setItem.mockImplementation(() => {});
      mockStorage.removeItem.mockImplementation(() => {});

      const storage = createStorage('localStorage');

      storage.set('test-key', 'test-value');
      expect(mockStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');

      const value = storage.get('test-key');
      expect(mockStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(value).toBe('test-value');

      storage.remove('test-key');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should fallback to memory storage when localStorage fails', () => {
      const mockStorage = window.localStorage as jest.Mocked<Storage>;
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage disabled');
      });
      mockStorage.getItem.mockImplementation(() => {
        throw new Error('Storage disabled');
      });

      const storage = createStorage('localStorage');

      // Should not throw, but fallback to memory
      storage.set('test-key', 'test-value');
      expect(storage.get('test-key')).toBe('test-value');
    });

    it('should handle sessionStorage', () => {
      const mockStorage = window.sessionStorage as jest.Mocked<Storage>;
      mockStorage.getItem.mockReturnValue('session-value');
      mockStorage.setItem.mockImplementation(() => {});

      const storage = createStorage('sessionStorage');

      storage.set('session-key', 'session-value');
      expect(mockStorage.setItem).toHaveBeenCalledWith('session-key', 'session-value');

      const value = storage.get('session-key');
      expect(value).toBe('session-value');
    });
  });

  describe('Memory Storage', () => {
    it('should store and retrieve values in memory', () => {
      const storage = createStorage('memory');

      expect(storage.get('nonexistent')).toBeNull();

      storage.set('key1', 'value1');
      storage.set('key2', 'value2');

      expect(storage.get('key1')).toBe('value1');
      expect(storage.get('key2')).toBe('value2');

      storage.remove('key1');
      expect(storage.get('key1')).toBeNull();
      expect(storage.get('key2')).toBe('value2');

      storage.clear();
      expect(storage.get('key2')).toBeNull();
    });
  });
});
