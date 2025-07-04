export interface StorageAdapter {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

export interface StorageOptions {
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
}

export interface CookieStorageOptions extends StorageOptions {
  httpOnly?: boolean;
  waitForCookies?: number;
  fallbackToBody?: boolean;
  retryCount?: number;
  debugMode?: boolean;
}

export interface StorageAdapterContext {
  /** Express-style request object */
  req?: any;
  /** Express-style response object */
  res?: any;
  /** Environment indicator */
  environment?: 'client' | 'server';
  /** Next.js App Router cookies() function */
  cookies?: () => any | Promise<any>;
  /** Next.js App Router headers() function */
  headers?: () => any | Promise<any>;
  /** Pre-extracted cookies object for performance */
  cookiesObject?: Record<string, string>;
  /** Custom cookie setter function */
  cookieSetter?: (name: string, value: string, options?: any) => void;
}
