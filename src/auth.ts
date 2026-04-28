import { PublicClientApplication } from '@azure/msal-node';
import type { AuthenticationResult, AccountInfo, Configuration } from '@azure/msal-node';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Config } from './types.ts';

// Token cache data structure
interface TokenCacheData {
  homeAccountId?: string;
  localAccountId?: string;
  username?: string;
  tenantId?: string;
  cachedAt?: string;
}

// Cache file path for MSAL tokens
let tokenCachePath: string | null = null;

/**
 * Create MSAL PublicClientApplication instance
 * Uses Device Code Flow for authentication (no client secret required)
 */
export function createMsalClient(config: Config): PublicClientApplication {
  const msalConfig: Configuration = {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  };

  tokenCachePath = config.tokenCachePath;

  return new PublicClientApplication(msalConfig);
}

/**
 * Load token cache from file
 */
export function loadTokenCache(cachePath: string): TokenCacheData | null {
  const absolutePath = resolve(cachePath);

  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    const content = readFileSync(absolutePath, 'utf-8');
    return JSON.parse(content) as TokenCacheData;
  } catch (error) {
    console.warn(`Warning: Could not load token cache from ${cachePath}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Save token cache to file
 */
export function saveTokenCache(cachePath: string, cache: TokenCacheData): void {
  const absolutePath = resolve(cachePath);
  const dir = dirname(absolutePath);

  // Create directory if needed
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(absolutePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Clear token cache file
 */
export function clearTokenCache(cachePath: string): void {
  const absolutePath = resolve(cachePath);

  if (existsSync(absolutePath)) {
    unlinkSync(absolutePath);
  }
}

/**
 * Get access token using cached token or Device Code Flow
 * Returns a valid access token for Microsoft Graph API
 */
export async function getAccessToken(
  client: PublicClientApplication,
  config: Config
): Promise<string> {
  // Try to get token from cache
  try {
    const accounts = await client.getAllAccounts();

    if (accounts.length > 0) {
      const account = accounts[0];

      if (account) {
        try {
          const result = await client.acquireTokenSilent({
            scopes: [...config.scopes],
            account: account,
          });

          if (result && result.accessToken) {
            console.log('✓ Using cached access token');
            return result.accessToken;
          }
        } catch (silentError) {
          // Silent acquisition failed, need to re-authenticate
          console.log('Cached token expired or invalid, will re-authenticate...');
        }
      }
    }
  } catch (error) {
    // Continue to Device Code Flow
    console.log('No cached token found, will authenticate...');
  }

  // No valid cache, use Device Code Flow
  return authenticateWithDeviceCode(client, config);
}

/**
 * Authenticate using Device Code Flow
 * Displays instructions for user to sign in via browser
 */
export async function authenticateWithDeviceCode(
  client: PublicClientApplication,
  config: Config
): Promise<string> {
  console.log('\n🔐 Authentication Required\n');
  console.log('You need to sign in with your Microsoft account.\n');

  const deviceCodeRequest = {
    scopes: [...config.scopes],
    deviceCodeCallback: (response: {
      userCode: string;
      deviceCode: string;
      verificationUri: string;
      expiresIn: number;
      interval: number;
      message: string;
    }) => {
      // Use the provided message if available, otherwise construct it manually
      if (response.message && response.message.trim().length > 0) {
        console.log(response.message);
      } else if (response.verificationUri && response.userCode) {
        // Fallback: construct the message manually
        console.log('To sign in, use a web browser to open the page:');
        console.log(`  ${response.verificationUri}`);
        console.log('And enter the code:');
        console.log(`  ${response.userCode}`);
      } else {
        // No useful information available - this shouldn't happen
        console.error('Error: Device code response is missing required information.');
        console.error('Please check your network connection and try again.');
      }
    },
  };

  try {
    const result: AuthenticationResult | null = await client.acquireTokenByDeviceCode(deviceCodeRequest);

    if (!result || !result.accessToken) {
      throw new Error('No access token received from authentication');
    }

    // Save account info for future use
    const accounts = await client.getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      if (account && tokenCachePath) {
        const cacheData: TokenCacheData = {
          homeAccountId: account.homeAccountId,
          localAccountId: account.localAccountId,
          username: account.username,
          tenantId: account.tenantId,
          cachedAt: new Date().toISOString(),
        };
        saveTokenCache(tokenCachePath, cacheData);
      }
    }

    console.log('\n✅ Authentication successful!\n');
    return result.accessToken;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Authentication failed:', errorMessage);
    throw new Error(`Authentication failed: ${errorMessage}`);
  }
}

/**
 * Check if we have a valid cached account
 */
export async function hasCachedAccount(client: PublicClientApplication): Promise<boolean> {
  try {
    const accounts = await client.getAllAccounts();
    return accounts.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the cached username if available
 */
export async function getCachedUsername(client: PublicClientApplication): Promise<string | null> {
  try {
    const accounts = await client.getAllAccounts();
    if (accounts.length > 0) {
      const account = accounts[0];
      return account?.username ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sign out by clearing the cache
 */
export async function signOut(client: PublicClientApplication, cachePath: string): Promise<void> {
  try {
    const accounts = await client.getAllAccounts();

    // Clear the token cache by setting an empty cache
    for (const account of accounts) {
      try {
        // Note: clearCache() is the preferred method
        await client.clearCache();
        break;
      } catch {
        // Continue to file cleanup
      }
    }

    clearTokenCache(cachePath);
    console.log('✓ Signed out successfully');
  } catch (error) {
    console.warn('Warning: Could not fully clear cache:', error instanceof Error ? error.message : 'Unknown error');
  }
}