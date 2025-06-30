# API Reference

## AuthClient Class

The main authentication client that handles all authentication operations, HTTP requests, and token management.

### Constructor

```typescript
new AuthClient(config: AuthFlowConfig, context?: AuthContext)
```

**Parameters:**

- `config`: Configuration object for the auth client
- `context`: Optional context object for server-side usage (req/res objects)

### Authentication Methods

#### login<TUser, TCredentials>(credentials)

Authenticates a user with the provided credentials.

```typescript
async login<TUser = any, TCredentials = LoginCredentials>(
  credentials: TCredentials
): Promise<TUser>
```

**Parameters:**

- `credentials`: User login credentials (username/password, etc.)

**Returns:** Promise resolving to user data

**Example:**

```typescript
const user = await authClient.login({
  username: 'user@example.com',
  password: 'password',
});
```

#### logout()

Logs out the current user, clears tokens, and optionally calls the logout endpoint.

```typescript
async logout(): Promise<void>
```

**Example:**

```typescript
await authClient.logout();
```

#### isAuthenticated()

Synchronously checks if the user is authenticated based on token presence.

```typescript
isAuthenticated(): boolean
```

**Returns:** Boolean indicating authentication status

#### hasValidTokens()

Asynchronously validates stored tokens.

```typescript
async hasValidTokens(): Promise<boolean>
```

**Returns:** Promise resolving to boolean indicating token validity

### HTTP Methods

All HTTP methods return a standardized response format:

```typescript
interface LoginResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}
```

#### get<T>(url, config?)

Performs a GET request.

```typescript
async get<T = any>(
  url: string,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

#### post<T>(url, data?, config?)

Performs a POST request.

```typescript
async post<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

#### put<T>(url, data?, config?)

Performs a PUT request.

```typescript
async put<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

#### patch<T>(url, data?, config?)

Performs a PATCH request.

```typescript
async patch<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

#### delete<T>(url, config?)

Performs a DELETE request.

```typescript
async delete<T = any>(
  url: string,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

#### head<T>(url, config?)

Performs a HEAD request.

```typescript
async head<T = any>(
  url: string,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

#### options<T>(url, config?)

Performs an OPTIONS request.

```typescript
async options<T = any>(
  url: string,
  config?: RequestConfig
): Promise<LoginResponse<T>>
```

### Token Management

#### getTokens()

Retrieves the current token pair from storage.

```typescript
async getTokens(): Promise<TokenPair | null>
```

**Returns:** Promise resolving to token pair or null if no tokens exist

#### setTokens(tokens)

Stores a token pair in the configured storage.

```typescript
async setTokens(tokens: TokenPair): Promise<void>
```

**Parameters:**

- `tokens`: Token pair containing access and refresh tokens

#### clearTokens()

Removes all tokens from storage.

```typescript
async clearTokens(): Promise<void>
```

## TokenManager Class

Handles token storage, retrieval, and validation operations.

### Constructor

```typescript
new TokenManager(
  tokenConfig: TokenConfig,
  storage: StorageType | StorageConfig = 'auto',
  context: AuthContext = {},
  environment: Environment = 'auto'
)
```

### Methods

#### isTokenExpired(token)

Checks if a JWT token is expired.

```typescript
isTokenExpired(token: string): boolean
```

**Parameters:**

- `token`: JWT token string

**Returns:** Boolean indicating if token is expired

#### isAccessTokenExpired()

Checks if the stored access token is expired.

```typescript
async isAccessTokenExpired(): Promise<boolean>
```

**Returns:** Promise resolving to boolean

## ErrorHandler Class

Manages error handling, retry logic, and error normalization.

### Constructor

```typescript
new ErrorHandler(
  onAuthError?: (error: AuthError) => void,
  retryAttempts: number = 3,
  retryDelay: number = 1000
)
```

### Methods

#### handleError(error)

Normalizes and processes errors.

```typescript
handleError(error: any): AuthError
```

#### executeWithRetry<T>(operation, maxAttempts?)

Executes an operation with retry logic.

```typescript
async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = this.retryAttempts
): Promise<T>
```

#### isAuthenticationError(error)

Checks if an error is an authentication error.

```typescript
isAuthenticationError(error: AuthError): boolean
```

#### isTokenExpiredError(error)

Checks if an error indicates token expiration.

```typescript
isTokenExpiredError(error: AuthError): boolean
```

## RequestQueue Class

Manages request queuing during token refresh operations.

### Constructor

```typescript
new RequestQueue();
```

### Methods

#### executeWithRefresh<T>(refreshFunction, requestFunction)

Executes a request with token refresh coordination.

```typescript
async executeWithRefresh<T>(
  refreshFunction: () => Promise<void>,
  requestFunction: () => Promise<T>
): Promise<T>
```

#### clearQueue()

Clears all pending requests in the queue.

```typescript
clearQueue(): void
```

## Storage Adapters

### LocalStorageAdapter

Browser localStorage implementation.

```typescript
new LocalStorageAdapter();
```

### CookieStorageAdapter

HTTP cookie implementation for both client and server.

```typescript
new CookieStorageAdapter(
  context?: StorageAdapterContext,
  options?: CookieStorageOptions
)
```

### MemoryStorageAdapter

In-memory storage implementation.

```typescript
new MemoryStorageAdapter();
```

## Utility Functions

### createAuthFlow(config, context?)

Factory function to create an AuthClient instance.

```typescript
function createAuthFlow(config: AuthFlowConfig, context?: AuthContext): AuthClient;
```

### detectEnvironment()

Detects the current execution environment.

```typescript
function detectEnvironment(): Environment;
```

### validateConfig(config)

Validates the AuthFlow configuration.

```typescript
function validateConfig(config: AuthFlowConfig): void;
```

### validateTokenPair(tokens)

Validates a token pair.

```typescript
function validateTokenPair(tokens: any): void;
```
