import type { CacheEntry, CacheStrategy, CacheConfig, CacheStats } from '../types/cache';

/**
 * RequestCache provides intelligent caching for HTTP requests with configurable strategies.
 *
 * Features:
 * - Pattern-based caching strategies
 * - LRU eviction policy
 * - Configurable TTL per URL pattern
 * - Cache statistics and monitoring
 * - ETag support for cache validation
 */
export class RequestCache {
  /**
   * In-memory cache storage
   * Maps cache keys to cache entries
   */
  private readonly cache = new Map<string, CacheEntry>();

  /** Cache configuration */
  private readonly config: CacheConfig;

  /**
   * Tracks access times for LRU eviction
   * Maps cache keys to last access timestamp
   */
  private readonly accessTimes = new Map<string, number>();

  /**
   * Cache hit/miss tracking for statistics
   */
  private hitCount = 0;
  private requestCount = 0;

  /**
   * Creates a new RequestCache instance
   *
   * @param config - Cache configuration options
   */
  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: true,
      defaultTTL: 300000, // 5 minutes
      maxSize: 100,
      strategies: new Map(),
      ...config,
    };
  }

  /**
   * Generates a unique cache key for a request
   *
   * @param url - Request URL
   * @param method - HTTP method (default: GET)
   * @param data - Request data for non-GET requests
   * @returns Unique cache key
   */
  private generateKey(url: string, method: string = 'GET', data?: any): string {
    let key = `${method}:${url}`;
    if (data && method !== 'GET') {
      key += `:${JSON.stringify(data)}`;
    }
    return key;
  }

  /**
   * Finds a matching cache strategy for the given URL
   *
   * @param url - URL to match against patterns
   * @returns Matching strategy or null if none found
   */
  private matchStrategy(url: string): CacheStrategy | null {
    for (const [pattern, strategy] of this.config.strategies) {
      if (this.matchPattern(pattern, url)) {
        return strategy;
      }
    }
    return null;
  }

  /**
   * Checks if a URL pattern matches a given URL
   * Supports wildcard (*) patterns
   *
   * @param pattern - URL pattern (supports *)
   * @param url - URL to test
   * @returns True if pattern matches URL
   */
  private matchPattern(pattern: string, url: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(url);
    }
    return pattern === url;
  }

  /**
   * Determines if a request should be cached
   *
   * @param url - Request URL
   * @param method - HTTP method
   * @returns True if request should be cached
   */
  private shouldCache(url: string, method: string): boolean {
    if (!this.config.enabled) return false;
    if (method !== 'GET') return false;

    const strategy = this.matchStrategy(url);
    if (strategy && strategy.enabled === false) return false;
    if (strategy && strategy.ttl === 0) return false;

    return true;
  }

  /**
   * Gets the TTL for a specific URL
   *
   * @param url - URL to get TTL for
   * @returns TTL in milliseconds
   */
  private getTTL(url: string): number {
    const strategy = this.matchStrategy(url);
    return strategy?.ttl || this.config.defaultTTL;
  }

  /**
   * Evicts the least recently used entry when cache is full
   * Uses LRU (Least Recently Used) eviction policy
   */
  private evictLRU(): void {
    if (this.cache.size <= this.config.maxSize) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
    }
  }

  /**
   * Retrieves data from cache if available and not expired
   *
   * @param url - Request URL
   * @param method - HTTP method (default: GET)
   * @param data - Request data for cache key generation
   * @returns Cached data or null if not found/expired
   */
  get(url: string, method: string = 'GET', data?: any): any | null {
    if (!this.shouldCache(url, method)) return null;

    const key = this.generateKey(url, method, data);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      return null;
    }

    // Record cache hit for statistics
    this.accessTimes.set(key, Date.now());
    return entry.data;
  }

  /**
   * Stores response data in cache with appropriate TTL
   *
   * @param url - Request URL
   * @param data - Response data to cache
   * @param method - HTTP method (default: GET)
   * @param requestData - Request data used for cache key
   * @param etag - Optional ETag for cache validation
   */
  set(url: string, data: any, method: string = 'GET', requestData?: any, etag?: string): void {
    if (!this.shouldCache(url, method)) return;

    const key = this.generateKey(url, method, requestData);
    const ttl = this.getTTL(url);
    const expiry = Date.now() + ttl;

    // Store in cache with expiration
    this.cache.set(key, { data, expiry, etag });
    this.accessTimes.set(key, Date.now());

    // Maintain cache size limit
    this.evictLRU();
  }

  /**
   * Invalidates cache entries matching a pattern
   *
   * @param pattern - URL pattern to invalidate (optional, clears all if not provided)
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.accessTimes.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (this.matchPattern(pattern, key)) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
      }
    }
  }

  /**
   * Adds a new caching strategy for URL patterns
   *
   * @param pattern - URL pattern (supports wildcards)
   * @param strategy - Caching strategy configuration
   */
  addStrategy(pattern: string, strategy: CacheStrategy): void {
    this.config.strategies.set(pattern, strategy);
  }

  /**
   * Gets comprehensive cache statistics
   *
   * @returns Cache performance and usage statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      expired: entries.filter(([, entry]) => now > entry.expiry).length,
      valid: entries.filter(([, entry]) => now <= entry.expiry).length,
      hitRate: this.calculateHitRate(),
    };
  }

  /**
   * Records a cache hit for statistics
   */
  recordHit(): void {
    this.hitCount++;
    this.requestCount++;
  }

  /**
   * Records a cache miss for statistics
   */
  recordMiss(): void {
    this.requestCount++;
  }

  /**
   * Calculates current cache hit rate
   *
   * @returns Hit rate as decimal (0-1)
   */
  private calculateHitRate(): number {
    return this.requestCount > 0 ? this.hitCount / this.requestCount : 0;
  }

  /**
   * Clears all cache entries and resets statistics
   */
  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
    this.hitCount = 0;
    this.requestCount = 0;
  }
}
