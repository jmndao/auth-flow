import type { AuthFlowConfig, Environment, StorageType, TokenSource } from '../types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateConfig(config: AuthFlowConfig): void {
  if (!config) {
    throw new ValidationError('Configuration is required');
  }

  // Only validate if provided - defaults are handled in createAuthFlow
  if (config.endpoints) {
    validateEndpoints(config.endpoints);
  }

  if (config.tokens) {
    validateTokens(config.tokens);
  }

  if (config.environment) {
    validateEnvironment(config.environment);
  }

  if (config.tokenSource) {
    validateTokenSource(config.tokenSource);
  }

  if (config.storage) {
    validateStorage(config.storage);
  }

  if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new ValidationError('Timeout must be a positive number');
  }

  if (config.retry) {
    validateRetryConfig(config.retry);
  }
}

function validateEndpoints(endpoints: any): void {
  if (!endpoints) {
    throw new ValidationError('Endpoints configuration is required');
  }

  if (!endpoints.login || typeof endpoints.login !== 'string') {
    throw new ValidationError('endpoints.login must be a non-empty string');
  }

  if (!endpoints.refresh || typeof endpoints.refresh !== 'string') {
    throw new ValidationError('endpoints.refresh must be a non-empty string');
  }

  if (endpoints.logout && typeof endpoints.logout !== 'string') {
    throw new ValidationError('endpoints.logout must be a string');
  }

  // Validate URL format
  [endpoints.login, endpoints.refresh, endpoints.logout].filter(Boolean).forEach((url) => {
    if (!isValidUrl(url)) {
      throw new ValidationError(`Invalid URL format: ${url}`);
    }
  });
}

function validateTokens(tokens: any): void {
  if (!tokens) {
    throw new ValidationError('Tokens configuration is required');
  }

  if (!tokens.access || typeof tokens.access !== 'string') {
    throw new ValidationError('tokens.access must be a non-empty string');
  }

  if (!tokens.refresh || typeof tokens.refresh !== 'string') {
    throw new ValidationError('tokens.refresh must be a non-empty string');
  }
}

function validateEnvironment(environment: Environment): void {
  const validEnvironments = ['client', 'server', 'auto'];
  if (!validEnvironments.includes(environment)) {
    throw new ValidationError(
      `Invalid environment: ${environment}. Must be one of: ${validEnvironments.join(', ')}`
    );
  }
}

function validateTokenSource(tokenSource: TokenSource): void {
  const validSources = ['body', 'cookies'];
  if (!validSources.includes(tokenSource)) {
    throw new ValidationError(
      `Invalid tokenSource: ${tokenSource}. Must be one of: ${validSources.join(', ')}`
    );
  }
}

function validateStorage(storage: StorageType | any): void {
  if (typeof storage === 'string') {
    const validTypes = ['localStorage', 'cookies', 'memory', 'auto'];
    if (!validTypes.includes(storage)) {
      throw new ValidationError(
        `Invalid storage type: ${storage}. Must be one of: ${validTypes.join(', ')}`
      );
    }
  } else if (typeof storage === 'object') {
    if (storage.type) {
      validateStorage(storage.type);
    }

    if (storage.options) {
      validateStorageOptions(storage.options);
    }
  } else {
    throw new ValidationError('Storage must be a string or configuration object');
  }
}

function validateStorageOptions(options: any): void {
  if (options.secure !== undefined && typeof options.secure !== 'boolean') {
    throw new ValidationError('storage.options.secure must be a boolean');
  }

  if (options.sameSite !== undefined) {
    const validSameSite = ['strict', 'lax', 'none'];
    if (!validSameSite.includes(options.sameSite)) {
      throw new ValidationError(
        `Invalid sameSite: ${options.sameSite}. Must be one of: ${validSameSite.join(', ')}`
      );
    }
  }

  if (options.maxAge !== undefined && (typeof options.maxAge !== 'number' || options.maxAge <= 0)) {
    throw new ValidationError('storage.options.maxAge must be a positive number');
  }

  if (options.domain !== undefined && typeof options.domain !== 'string') {
    throw new ValidationError('storage.options.domain must be a string');
  }

  if (options.path !== undefined && typeof options.path !== 'string') {
    throw new ValidationError('storage.options.path must be a string');
  }
}

function validateRetryConfig(retry: any): void {
  if (retry.attempts !== undefined && (typeof retry.attempts !== 'number' || retry.attempts < 0)) {
    throw new ValidationError('retry.attempts must be a non-negative number');
  }

  if (retry.delay !== undefined && (typeof retry.delay !== 'number' || retry.delay < 0)) {
    throw new ValidationError('retry.delay must be a non-negative number');
  }
}

function isValidUrl(url: string): boolean {
  try {
    // Allow relative URLs or absolute URLs
    if (url.startsWith('/')) {
      return true;
    }

    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateTokenPair(tokens: any): void {
  if (!tokens) {
    throw new ValidationError('Tokens are required');
  }

  if (!tokens.accessToken || typeof tokens.accessToken !== 'string') {
    throw new ValidationError('accessToken must be a non-empty string');
  }

  if (!tokens.refreshToken || typeof tokens.refreshToken !== 'string') {
    throw new ValidationError('refreshToken must be a non-empty string');
  }
}

export function validateLoginCredentials(credentials: any): void {
  if (!credentials) {
    throw new ValidationError('Login credentials are required');
  }

  if (typeof credentials !== 'object') {
    throw new ValidationError('Login credentials must be an object');
  }
}
