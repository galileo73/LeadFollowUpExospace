import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import {
  loadPresentationAttachment,
  validatePresentationFile,
  getPresentationInfo,
  getDefaultPresentationPath,
  MAX_PRESENTATION_SIZE_BYTES,
  PPTX_CONTENT_TYPE,
} from '../src/attachments.js';

const fixturesDir = resolve(import.meta.dirname, 'fixtures/attachments-test');

// Helper to create a small test file
function createTestFile(name: string, content: string): string {
  if (!existsSync(fixturesDir)) {
    mkdirSync(fixturesDir, { recursive: true });
  }
  const filePath = resolve(fixturesDir, name);
  writeFileSync(filePath, content);
  return filePath;
}

// Helper to create a large test file (over 3 MB)
function createLargeTestFile(name: string): string {
  if (!existsSync(fixturesDir)) {
    mkdirSync(fixturesDir, { recursive: true });
  }
  const filePath = resolve(fixturesDir, name);
  // Create 4 MB of content
  const size = 4 * 1024 * 1024;
  const buffer = Buffer.alloc(size, 'x');
  writeFileSync(filePath, buffer);
  return filePath;
}

describe('attachments', () => {
  describe('constants', () => {
    it('should have 3 MB max size', () => {
      assert.strictEqual(MAX_PRESENTATION_SIZE_BYTES, 3 * 1024 * 1024);
    });

    it('should have correct PPTX content type', () => {
      assert.strictEqual(
        PPTX_CONTENT_TYPE,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
    });
  });

  describe('getDefaultPresentationPath', () => {
    it('should return the default presentation path', () => {
      const path = getDefaultPresentationPath();
      assert.strictEqual(path, 'lead_db/Exospace_Company_Profile_Overall_v1.0.pptx');
    });
  });

  describe('loadPresentationAttachment', () => {
    it('should load PPTX file as base64 attachment', () => {
      const testFile = createTestFile('test-small.pptx', 'test content');
      const result = loadPresentationAttachment(testFile);

      assert.strictEqual(result.error, null);
      assert.ok(result.attachment, 'Should return attachment');

      // Verify base64 encoding
      const expectedBase64 = Buffer.from('test content').toString('base64');
      assert.strictEqual(result.attachment.contentBytes, expectedBase64);
    });

    it('should have correct attachment name from file path', () => {
      const testFile = createTestFile('my-presentation.pptx', 'content');
      const result = loadPresentationAttachment(testFile);

      assert.strictEqual(result.attachment?.name, 'my-presentation.pptx');
    });

    it('should have correct PPTX content type', () => {
      const testFile = createTestFile('test.pptx', 'content');
      const result = loadPresentationAttachment(testFile);

      assert.strictEqual(result.attachment?.contentType, PPTX_CONTENT_TYPE);
    });

    it('should NOT include isInline property (defaults to false)', () => {
      const testFile = createTestFile('test.pptx', 'content');
      const result = loadPresentationAttachment(testFile);

      // The attachment object should NOT have isInline property
      assert.strictEqual('isInline' in (result.attachment ?? {}), false);
    });

    it('should have correct @odata.type', () => {
      const testFile = createTestFile('test.pptx', 'content');
      const result = loadPresentationAttachment(testFile);

      assert.strictEqual(result.attachment?.['@odata.type'], '#microsoft.graph.fileAttachment');
    });

    it('should return error for missing file', () => {
      const result = loadPresentationAttachment('/nonexistent/path/file.pptx');

      assert.strictEqual(result.attachment, null);
      assert.ok(result.error?.includes('not found'));
    });

    it('should return error for file over 3 MB', () => {
      const largeFile = createLargeTestFile('large-file.pptx');

      try {
        const result = loadPresentationAttachment(largeFile);

        assert.strictEqual(result.attachment, null);
        assert.ok(result.error?.includes('too large'));
        assert.ok(result.error?.includes('4'));
        assert.ok(result.error?.includes('3 MB'));
      } finally {
        // Cleanup
        rmSync(largeFile, { force: true });
      }
    });

    it('should include warning for file close to size limit', () => {
      // Create a file that's 2.9 MB (over 90% of limit)
      const size = Math.floor(MAX_PRESENTATION_SIZE_BYTES * 0.95);
      if (!existsSync(fixturesDir)) {
        mkdirSync(fixturesDir, { recursive: true });
      }
      const filePath = resolve(fixturesDir, 'near-limit.pptx');
      const buffer = Buffer.alloc(size, 'x');
      writeFileSync(filePath, buffer);

      try {
        const result = loadPresentationAttachment(filePath);

        assert.strictEqual(result.error, null);
        assert.ok(result.attachment, 'Should return attachment');
        assert.ok(result.warning, 'Should include warning about size');
        assert.ok(result.warning?.includes('close to size limit'));
      } finally {
        rmSync(filePath, { force: true });
      }
    });

    it('should not include warning for small file', () => {
      const testFile = createTestFile('small.pptx', 'tiny');
      const result = loadPresentationAttachment(testFile);

      assert.strictEqual(result.error, null);
      assert.strictEqual(result.warning, undefined);
    });

    it('should load the actual presentation file', () => {
      const realPath = resolve(process.cwd(), 'lead_db/Exospace_Company_Profile_Overall_v1.0.pptx');

      // Skip if real file doesn't exist (CI environment)
      if (!existsSync(realPath)) {
        return;
      }

      const result = loadPresentationAttachment(realPath);

      assert.strictEqual(result.error, null);
      assert.ok(result.attachment, 'Should load real presentation');
      assert.strictEqual(result.attachment?.name, 'Exospace_Company_Profile_Overall_v1.0.pptx');
      assert.strictEqual(result.attachment?.contentType, PPTX_CONTENT_TYPE);

      // Verify base64 content is valid
      assert.ok(result.attachment?.contentBytes.length! > 0);
      // Base64 should only contain valid characters
      assert.ok(/^[A-Za-z0-9+/=]+$/.test(result.attachment?.contentBytes ?? ''));
    });
  });

  describe('validatePresentationFile', () => {
    it('should return null for valid file', () => {
      const testFile = createTestFile('valid.pptx', 'content');
      const error = validatePresentationFile(testFile);

      assert.strictEqual(error, null);
    });

    it('should return error for missing file', () => {
      const error = validatePresentationFile('/nonexistent/file.pptx');

      assert.ok(error?.includes('not found'));
    });

    it('should return error for file over 3 MB', () => {
      const largeFile = createLargeTestFile('huge.pptx');

      try {
        const error = validatePresentationFile(largeFile);

        assert.ok(error?.includes('too large'));
        assert.ok(error?.includes('3 MB'));
      } finally {
        rmSync(largeFile, { force: true });
      }
    });
  });

  describe('getPresentationInfo', () => {
    it('should return info for existing file', () => {
      const testFile = createTestFile('info-test.pptx', 'hello world');
      const info = getPresentationInfo(testFile);

      assert.strictEqual(info.exists, true);
      assert.strictEqual(info.size, 11); // 'hello world' is 11 bytes
      assert.strictEqual(info.sizeMB, '0.00');
    });

    it('should return correct size for larger file', () => {
      const size = 1024 * 100; // 100 KB
      if (!existsSync(fixturesDir)) {
        mkdirSync(fixturesDir, { recursive: true });
      }
      const filePath = resolve(fixturesDir, 'size-test.pptx');
      const buffer = Buffer.alloc(size, 'a');
      writeFileSync(filePath, buffer);

      try {
        const info = getPresentationInfo(filePath);

        assert.strictEqual(info.exists, true);
        assert.strictEqual(info.size, size);
        // 100 KB = 0.09766... MB, check it starts with 0.09
        assert.ok(info.sizeMB?.startsWith('0.09') || info.sizeMB?.startsWith('0.10'));
      } finally {
        rmSync(filePath, { force: true });
      }
    });

    it('should return exists false for missing file', () => {
      const info = getPresentationInfo('/nonexistent/file.pptx');

      assert.strictEqual(info.exists, false);
      assert.strictEqual(info.error, 'File not found');
    });
  });

  // Cleanup after all tests
  after(() => {
    if (existsSync(fixturesDir)) {
      rmSync(fixturesDir, { recursive: true, force: true });
    }
  });
});