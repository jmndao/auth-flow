/**
 * Cache entry stored in the request cache
 */
export interface CacheEntry {
  /** Cached response data */
  data: any;
  /** Expiration timestamp in milliseconds */
  expiry: number;
  /** Optional ETag for cache validation */
  etag?: string;
}

/**
 * Caching strategy for specific URL patterns
 */
export interface CacheStrategy {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Whether caching is enabled for this pattern */
  enabled?: boolean;
  /** Custom key generator function */
  key?: (url: string, params?: any) => string;
}

/**
 * Configuration for the request cache system
 */
export interface CacheConfig {
  /** Whether caching is globally enabled */
  enabled: boolean;
  /** Default time to live for cached entries in milliseconds */
  defaultTTL: number;
  /** Maximum number of entries to store */
  maxSize: number;
  /** URL pattern to strategy mapping */
  strategies: Map<string, CacheStrategy>;
}

/**
 * Cache performance statistics
 */
export interface CacheStats {
  /** Current number of cached entries */
  size: number;
  /** Maximum allowed cache size */
  maxSize: number;
  /** Number of expired entries */
  expired: number;
  /** Number of valid entries */
  valid: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
}
