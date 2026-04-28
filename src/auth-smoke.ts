import 'dotenv/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createMsalClient, getAccessToken, loadTokenCache } from './auth.js';

/**
 * Auth smoke test - tests MSAL Device Code Flow in isolation
 * Run with: npm run auth:test
 */

function getConfig() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const scopes = (process.env.GRAPH_SCOPES || 'Mail.ReadWrite,offline_access')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const tokenCachePath = process.env.TOKEN_CACHE_PATH || '.cache/msal-tokens.json';

  return { tenantId, clientId, scopes, tokenCachePath };
}

function sanitizeClientId(clientId: string | undefined): string {
  if (!clientId) return '(not set)';
  // Show first 8 chars and last 4 chars
  if (clientId.length > 12) {
    return `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)}`;
  }
  return clientId;
}

function sanitizeTenantId(tenantId: string | undefined): string {
  if (!tenantId) return '(not set)';
  // Show first 8 chars and last 4 chars
  if (tenantId.length > 12) {
    return `${tenantId.substring(0, 8)}...${tenantId.substring(tenantId.length - 4)}`;
  }
  return tenantId;
}

function printErrorDetails(error: unknown): void {
  console.log('\n❌ Authentication failed\n');

  if (!error) {
    console.log('Error: Unknown error (null or undefined)');
    return;
  }

  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;

    // MSAL error structure
    console.log('📋 MSAL Error Details:');
    console.log('─'.repeat(40));

    if ('errorCode' in errorObj) {
      console.log(`  errorCode:     ${errorObj.errorCode}`);
    }
    if ('errorMessage' in errorObj) {
      console.log(`  errorMessage:  ${errorObj.errorMessage}`);
    }
    if ('subError' in errorObj && errorObj.subError) {
      console.log(`  subError:      ${errorObj.subError}`);
    }
    if ('correlationId' in errorObj) {
      console.log(`  correlationId: ${errorObj.correlationId}`);
    }
    if ('name' in errorObj) {
      console.log(`  name:          ${errorObj.name}`);
    }

    // Additional MSAL error properties
    if ('errorNo' in errorObj) {
      console.log(`  errorNo:       ${errorObj.errorNo}`);
    }
    if ('timestamp' in errorObj) {
      console.log(`  timestamp:     ${errorObj.timestamp}`);
    }
    if ('traceId' in errorObj) {
      console.log(`  traceId:       ${errorObj.traceId}`);
    }

    // Raw error for debugging
    console.log('\n📄 Raw Error Object:');
    console.log('─'.repeat(40));
    console.log(JSON.stringify(errorObj, null, 2));
  } else if (error instanceof Error) {
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  } else {
    console.log(`Error: ${String(error)}`);
  }
}

async function main(): Promise<void> {
  console.log('\n🔍 Auth Smoke Test\n');
  console.log('═'.repeat(50));

  // Load configuration
  const config = getConfig();

  // Print sanitized diagnostics
  console.log('\n📋 Configuration Diagnostics:');
  console.log('─'.repeat(40));

  const authorityUrl = config.tenantId
    ? `https://login.microsoftonline.com/${config.tenantId}`
    : '(not set)';

  console.log(`  Authority URL:  ${authorityUrl}`);
  console.log(`  Client ID:      ${sanitizeClientId(config.clientId)}`);
  console.log(`  Tenant ID:      ${sanitizeTenantId(config.tenantId)}`);
  console.log(`  Scopes:         ${config.scopes.join(', ')}`);

  // Check token cache
  const cachePath = resolve(process.cwd(), config.tokenCachePath);
  const cacheExists = existsSync(cachePath);
  console.log(`  Token cache:    ${cachePath}`);
  console.log(`  Cache exists:   ${cacheExists}`);

  if (cacheExists) {
    const cache = loadTokenCache(cachePath);
    if (cache) {
      console.log(`  Cached user:   ${cache.username || '(unknown)'}`);
      console.log(`  Cached at:     ${cache.cachedAt || '(unknown)'}`);
    }
  }

  // Validate required config
  if (!config.tenantId || !config.clientId) {
    console.log('\n❌ Missing required configuration');
    console.log('   Set AZURE_TENANT_ID and AZURE_CLIENT_ID in your .env file');
    process.exit(1);
  }

  if (config.scopes.length === 0) {
    console.log('\n⚠️  No scopes configured, using defaults');
  }

  console.log('\n' + '═'.repeat(50));
  console.log('\n🔐 Starting authentication...\n');

  // Create MSAL client
  const msalClient = createMsalClient({
    tenantId: config.tenantId,
    clientId: config.clientId!,
    scopes: config.scopes,
    leadsCsvPath: '',
    templatesDocxPath: '',
    logPath: '',
    tokenCachePath: config.tokenCachePath,
  });

  try {
    // Attempt authentication
    const accessToken = await getAccessToken(msalClient, {
      tenantId: config.tenantId,
      clientId: config.clientId!,
      scopes: config.scopes,
      leadsCsvPath: '',
      templatesDocxPath: '',
      logPath: '',
      tokenCachePath: config.tokenCachePath,
    });

    // Success
    console.log('\n' + '═'.repeat(50));
    console.log('\n✅ Authentication successful!\n');
    console.log(`Access token received (${accessToken.length} characters)`);
    console.log('\nThis confirms Device Code Flow is working correctly.');
    console.log('You can now run the full agent with npm run start.\n');
  } catch (error) {
    printErrorDetails(error);
    console.log('\n' + '═'.repeat(50));
    console.log('\n💡 Troubleshooting tips:\n');
    console.log('1. Verify AZURE_TENANT_ID and AZURE_CLIENT_ID are correct');
    console.log('2. Ensure the app registration has these delegated permissions:');
    console.log('   - Mail.ReadWrite');
    console.log('   - offline_access');
    console.log('   - User.Read (optional)');
    console.log('3. Ensure admin consent has been granted');
    console.log('4. Ensure "Allow public client flows" is enabled');
    console.log('5. Check if conditional access policies are blocking device code flow');
    console.log('6. Try deleting the token cache: rm .cache/msal-tokens.json\n');
    process.exit(1);
  }
}

main();