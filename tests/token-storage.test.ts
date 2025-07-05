import { CookieManager } from '../core/cookie-manager';
import { TokenManager } from '../core/token-manager';

describe('Token Storage Verification', () => {
  test('CookieManager should store and retrieve tokens with Next.js mock', async () => {
    delete (global as any).window; // Server environment

    // Create a simple Next.js cookies mock
    let actualCookieStore: Record<string, string> = {};

    const mockCookieStore = {
      get: jest.fn((key: string) => {
        const value = actualCookieStore[key];
        console.log(`Cookie GET: ${key} = ${value}`);
        return value ? { value, name: key } : undefined;
      }),
      set: jest.fn((key: string, value: string, _options?: any) => {
        actualCookieStore[key] = value;
        console.log(`Cookie SET: ${key} = ${value}`);
      }),
      delete: jest.fn((key: string) => {
        delete actualCookieStore[key];
        console.log(`Cookie DELETE: ${key}`);
      }),
    };

    const syncCookies = jest.fn(() => {
      console.log('syncCookies() called');
      return mockCookieStore;
    });

    const cookieManager = new CookieManager({ cookies: syncCookies }, { debugMode: true });

    console.log('=== SETTING TOKEN ===');
    await cookieManager.set('testToken', 'test-value');

    console.log('=== GETTING TOKEN ===');
    const retrievedValue = await cookieManager.get('testToken');

    console.log('Expected: test-value');
    console.log('Actual:', retrievedValue);
    console.log('Cookie store contents:', actualCookieStore);

    expect(retrievedValue).toBe('test-value');
  });

  test('TokenManager should store and retrieve tokens via CookieManager', async () => {
    delete (global as any).window; // Server environment

    // Create a simple Next.js cookies mock
    let actualCookieStore: Record<string, string> = {};

    const mockCookieStore = {
      get: jest.fn((key: string) => {
        const value = actualCookieStore[key];
        console.log(`TokenManager Cookie GET: ${key} = ${value}`);
        return value ? { value, name: key } : undefined;
      }),
      set: jest.fn((key: string, value: string, _options?: any) => {
        actualCookieStore[key] = value;
        console.log(`TokenManager Cookie SET: ${key} = ${value}`);
      }),
    };

    const syncCookies = jest.fn(() => mockCookieStore);

    const tokenManager = new TokenManager(
      { access: 'accessToken', refresh: 'refreshToken' },
      'cookies',
      { cookies: syncCookies },
      'server'
    );

    const testTokens = {
      accessToken: 'test-access-123',
      refreshToken: 'test-refresh-456',
    };

    console.log('=== TokenManager SETTING TOKENS ===');
    await tokenManager.setTokens(testTokens);

    console.log('=== TokenManager GETTING TOKENS ===');
    const retrievedTokens = await tokenManager.getTokens();

    console.log('Expected tokens:', testTokens);
    console.log('Retrieved tokens:', retrievedTokens);
    console.log('Cookie store contents:', actualCookieStore);
    console.log('Has tokens sync:', tokenManager.hasTokensSync());

    expect(retrievedTokens).toEqual(testTokens);
    expect(tokenManager.hasTokensSync()).toBe(true);
  });

  test('Real-world scenario: Login sets tokens, then retrieve them', async () => {
    delete (global as any).window; // Server environment

    // Simulate real Next.js cookies behavior
    let serverCookies: Record<string, string> = {};

    const mockCookieStore = {
      get: (key: string) => {
        const value = serverCookies[key];
        return value ? { value, name: key } : undefined;
      },
      set: (key: string, value: string, _options?: any) => {
        serverCookies[key] = value;
        console.log(`Real scenario: Set ${key} = ${value}`);
      },
    };

    const cookies = () => mockCookieStore;

    // Step 1: Create TokenManager (like in AuthClient constructor)
    const tokenManager = new TokenManager(
      { access: 'accessToken', refresh: 'refreshToken' },
      'cookies',
      { cookies },
      'server'
    );

    // Step 2: Simulate login response tokens
    const loginResponseTokens = {
      accessToken: 'jwt-access-token-from-server',
      refreshToken: 'jwt-refresh-token-from-server',
    };

    // Step 3: Store tokens (like AuthClient.login does)
    console.log('=== SIMULATING LOGIN TOKEN STORAGE ===');
    await tokenManager.setTokens(loginResponseTokens);

    // Step 4: Verify tokens are immediately available (for hasTokensSync)
    console.log('=== CHECKING IMMEDIATE AVAILABILITY ===');
    const isAvailableSync = tokenManager.hasTokensSync();
    console.log('Tokens available synchronously:', isAvailableSync);

    // Step 5: Retrieve tokens (like subsequent requests would)
    console.log('=== RETRIEVING TOKENS ===');
    const retrievedTokens = await tokenManager.getTokens();
    console.log('Retrieved tokens:', retrievedTokens);

    // Step 6: Verify tokens match what was stored
    expect(retrievedTokens).toEqual(loginResponseTokens);
    expect(isAvailableSync).toBe(true);

    console.log('✅ SUCCESS: Tokens stored and retrieved correctly');
  });
});
