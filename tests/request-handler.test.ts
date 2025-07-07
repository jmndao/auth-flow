import { RequestHandler } from '../core/request-handler';

describe('RequestHandler', () => {
  let requestHandler: RequestHandler;

  beforeEach(() => {
    requestHandler = new RequestHandler('https://api.example.com', {
      timeout: 5000,
      retry: { attempts: 2, delay: 100 },
    });
  });

  describe('request', () => {
    it('should make successful HTTP requests', async () => {
      const mockResponse = { data: 'test-data' };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await requestHandler.request('GET', '/test');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);
    });

    it('should handle full URLs', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await requestHandler.request('GET', 'https://external.api.com/endpoint');

      expect(fetch).toHaveBeenCalledWith('https://external.api.com/endpoint', expect.any(Object));
    });

    it('should throw error on HTTP error status', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(requestHandler.request('GET', '/not-found')).rejects.toMatchObject({
        status: 404,
        message: 'Not Found',
      });
    });

    it('should retry on network errors', async () => {
      // First attempt fails, second succeeds
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'success' }),
      });

      const result = await requestHandler.request('GET', '/test');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should not retry auth errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(requestHandler.request('GET', '/protected')).rejects.toMatchObject({
        status: 401,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('request queuing', () => {
    it('should queue requests during refresh', async () => {
      const mockResponse = { data: 'queued-response' };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      requestHandler.setRefreshing(true);

      const promise = requestHandler.queueRequest('GET', '/test');

      requestHandler.setRefreshing(false);

      const result = await promise;
      expect(result.data).toEqual(mockResponse);
    });

    it('should process queue when refresh completes', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      requestHandler.setRefreshing(true);

      const promises = [
        requestHandler.queueRequest('GET', '/test1'),
        requestHandler.queueRequest('GET', '/test2'),
      ];

      requestHandler.setRefreshing(false);

      await Promise.all(promises);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshing state', () => {
    it('should track refreshing state', () => {
      expect(requestHandler.isCurrentlyRefreshing()).toBe(false);

      requestHandler.setRefreshing(true);
      expect(requestHandler.isCurrentlyRefreshing()).toBe(true);

      requestHandler.setRefreshing(false);
      expect(requestHandler.isCurrentlyRefreshing()).toBe(false);
    });
  });
});
