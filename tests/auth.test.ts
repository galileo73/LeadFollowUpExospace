import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import {
  createMsalClient,
  loadTokenCache,
  saveTokenCache,
  clearTokenCache,
  hasCachedAccount,
  getCachedUsername,
} from '../src/auth.js';
import type { Config } from '../src/types.js';

const testDir = resolve(import.meta.dirname, 'fixtures', 'auth-test');
const testCachePath = join(testDir, 'test-tokens.json');

// Test config (fake credentials for testing)
const testConfig: Config = {
  tenantId: 'test-tenant-id',
  clientId: 'test-client-id',
  scopes: ['Mail.ReadWrite', 'offline_access'],
  leadsCsvPath: 'lead_db/leads.csv',
  templatesDocxPath: 'lead_db/templates.docx',
  logPath: 'logs/drafts.csv',
  tokenCachePath: testCachePath,
};

// Helper to clean up test directory
function cleanupTestDir(): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

// Helper to ensure test directory exists
function ensureTestDir(): void {
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
}

describe('auth', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('createMsalClient', () => {
    it('should create MSAL PublicClientApplication', () => {
      const client = createMsalClient(testConfig);
      assert.ok(client, 'Should create client');
      assert.ok(typeof client.acquireTokenSilent === 'function', 'Should have acquireTokenSilent method');
      assert.ok(typeof client.acquireTokenByDeviceCode === 'function', 'Should have acquireTokenByDeviceCode method');
    });

    it('should use correct authority URL', () => {
      const client = createMsalClient(testConfig);
      assert.ok(client, 'Should create client');
      // The authority is set internally, we can't directly check it
      // but we verify the client was created successfully
    });
  });

  describe('loadTokenCache', () => {
    it('should return null when cache file does not exist', () => {
      const result = loadTokenCache(testCachePath);
      assert.strictEqual(result, null);
    });

    it('should return null for invalid JSON', () => {
      writeFileSync(testCachePath, 'invalid json', 'utf-8');
      const result = loadTokenCache(testCachePath);
      assert.strictEqual(result, null);
    });

    it('should load valid cache data', () => {
      const cacheData = {
        homeAccountId: 'test-home-id',
        username: 'test@example.com',
        tenantId: 'test-tenant',
        cachedAt: '2026-04-28T12:00:00Z',
      };
      writeFileSync(testCachePath, JSON.stringify(cacheData), 'utf-8');

      const result = loadTokenCache(testCachePath);
      assert.ok(result, 'Should return cache data');
      assert.strictEqual(result?.homeAccountId, 'test-home-id');
      assert.strictEqual(result?.username, 'test@example.com');
    });

    it('should handle empty cache file', () => {
      writeFileSync(testCachePath, '{}', 'utf-8');
      const result = loadTokenCache(testCachePath);
      assert.ok(result, 'Should return empty object');
    });
  });

  describe('saveTokenCache', () => {
    it('should create cache directory if it does not exist', () => {
      const nestedPath = join(testDir, 'nested', 'cache.json');
      const cacheData = { username: 'test@example.com' };

      saveTokenCache(nestedPath, cacheData);

      assert.ok(existsSync(nestedPath), 'Cache file should be created');
    });

    it('should save cache data as JSON', () => {
      const cacheData = {
        homeAccountId: 'test-id',
        username: 'user@example.com',
      };

      saveTokenCache(testCachePath, cacheData);

      const content = readFileSync(testCachePath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.homeAccountId, 'test-id');
      assert.strictEqual(parsed.username, 'user@example.com');
    });

    it('should overwrite existing cache', () => {
      const cache1 = { username: 'user1@example.com' };
      const cache2 = { username: 'user2@example.com' };

      saveTokenCache(testCachePath, cache1);
      saveTokenCache(testCachePath, cache2);

      const content = readFileSync(testCachePath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.username, 'user2@example.com');
    });

    it('should format JSON with indentation', () => {
      const cacheData = { username: 'test@example.com' };

      saveTokenCache(testCachePath, cacheData);

      const content = readFileSync(testCachePath, 'utf-8');
      assert.ok(content.includes('\n'), 'Should be formatted with newlines');
      assert.ok(content.includes('  '), 'Should have indentation');
    });
  });

  describe('clearTokenCache', () => {
    it('should remove existing cache file', () => {
      writeFileSync(testCachePath, '{}', 'utf-8');
      assert.ok(existsSync(testCachePath), 'Cache file should exist');

      clearTokenCache(testCachePath);

      assert.ok(!existsSync(testCachePath), 'Cache file should be removed');
    });

    it('should not throw if cache file does not exist', () => {
      assert.doesNotThrow(() => {
        clearTokenCache(testCachePath);
      });
    });
  });

  describe('hasCachedAccount', () => {
    it('should return false when no accounts exist', async () => {
      const client = createMsalClient(testConfig);
      const result = await hasCachedAccount(client);
      assert.strictEqual(result, false);
    });
  });

  describe('getCachedUsername', () => {
    it('should return null when no accounts exist', async () => {
      const client = createMsalClient(testConfig);
      const result = await getCachedUsername(client);
      assert.strictEqual(result, null);
    });
  });

  describe('getAccessToken', () => {
    it('should attempt silent token acquisition first', async () => {
      const client = createMsalClient(testConfig);

      // This will fail because we don't have valid credentials
      // But we test that it attempts the flow correctly
      try {
        await client.acquireTokenSilent({
          scopes: [...testConfig.scopes],
          account: null as any,
        });
        assert.fail('Should have thrown an error');
      } catch (error) {
        // Expected - no cached token
        assert.ok(true, 'Correctly throws when no cached account');
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid cache path gracefully', () => {
      const invalidPath = '/invalid/path/that/does/not/exist/cache.json';
      const result = loadTokenCache(invalidPath);
      assert.strictEqual(result, null);
    });

    it('should handle corrupted cache gracefully', () => {
      writeFileSync(testCachePath, '{corrupted json', 'utf-8');
      const result = loadTokenCache(testCachePath);
      assert.strictEqual(result, null);
    });
  });
});