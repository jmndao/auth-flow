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
}

export interface StorageAdapterContext {
  req?: any;
  res?: any;
  environment?: 'client' | 'server';
}
