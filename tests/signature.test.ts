import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import {
  isSignatureEnabled,
  loadSignatureHtml,
  textToHtmlBody,
  appendSignatureToBody,
  loadInlineLogoAttachment,
  getSignatureConfig,
  loadSignature,
  prepareEmailBody,
} from '../src/signature.js';
import type { SignatureConfig } from '../src/signature.js';

const testDir = resolve(import.meta.dirname, 'fixtures', 'signature-test');
const testSignaturePath = join(testDir, 'test-signature.html');
const testLogoPath = join(testDir, 'test-logo.png');

// Minimal PNG header for testing (valid PNG magic bytes)
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, // IHDR length
  0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, // width: 1
  0x00, 0x00, 0x00, 0x01, // height: 1
  0x08, 0x02, // bit depth, color type
  0x00, 0x00, 0x00, // compression, filter, interlace
  0x77, 0x74, 0x1F, 0x73, // CRC
]);

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

describe('signature', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('isSignatureEnabled', () => {
    it('should return false for undefined', () => {
      assert.strictEqual(isSignatureEnabled(undefined), false);
    });

    it('should return false for empty string', () => {
      assert.strictEqual(isSignatureEnabled(''), false);
    });

    it('should return false for false string', () => {
      assert.strictEqual(isSignatureEnabled('false'), false);
      assert.strictEqual(isSignatureEnabled('FALSE'), false);
      assert.strictEqual(isSignatureEnabled('False'), false);
    });

    it('should return true for true string', () => {
      assert.strictEqual(isSignatureEnabled('true'), true);
      assert.strictEqual(isSignatureEnabled('TRUE'), true);
      assert.strictEqual(isSignatureEnabled('True'), true);
    });

    it('should return true for 1 string', () => {
      assert.strictEqual(isSignatureEnabled('1'), true);
    });

    it('should return true for yes string', () => {
      assert.strictEqual(isSignatureEnabled('yes'), true);
      assert.strictEqual(isSignatureEnabled('YES'), true);
    });

    it('should trim whitespace', () => {
      assert.strictEqual(isSignatureEnabled('  true  '), true);
      assert.strictEqual(isSignatureEnabled('  false  '), false);
    });
  });

  describe('loadSignatureHtml', () => {
    it('should return null for missing file', async () => {
      const result = await loadSignatureHtml('/nonexistent/path.html');
      assert.strictEqual(result, null);
    });

    it('should load signature HTML from file', async () => {
      const htmlContent = '<html><body><p>Test Signature</p></body></html>';
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');

      const result = await loadSignatureHtml(testSignaturePath);
      assert.ok(result);
      assert.ok(result.includes('Test Signature'));
    });

    it('should replace local image path with CID reference', async () => {
      const htmlContent = '<img src="Exospace_file/image001.png" alt="Logo">';
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');

      const result = await loadSignatureHtml(testSignaturePath);
      assert.ok(result);
      assert.ok(result.includes('src="cid:exospace-logo"'));
      assert.ok(!result.includes('Exospace_file/image001.png'));
    });

    it('should handle case-insensitive replacement', async () => {
      const htmlContent = '<img SRC="Exospace_file/image001.png" alt="Logo">';
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');

      const result = await loadSignatureHtml(testSignaturePath);
      assert.ok(result);
      assert.ok(result.includes('src="cid:exospace-logo"'));
    });

    it('should handle single quotes in src', async () => {
      const htmlContent = "<img src='Exospace_file/image001.png' alt='Logo'>";
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');

      const result = await loadSignatureHtml(testSignaturePath);
      assert.ok(result);
      assert.ok(result.includes('src="cid:exospace-logo"'));
    });
  });

  describe('textToHtmlBody', () => {
    it('should convert plain text to HTML paragraphs', () => {
      const text = 'Hello World';
      const result = textToHtmlBody(text);
      assert.strictEqual(result, '<p>Hello World</p>');
    });

    it('should escape HTML entities', () => {
      const text = 'Hello <World> & "Friends"';
      const result = textToHtmlBody(text);
      assert.ok(result.includes('&lt;'));
      assert.ok(result.includes('&gt;'));
      assert.ok(result.includes('&amp;'));
      assert.ok(result.includes('&quot;'));
    });

    it('should convert newlines to <br>', () => {
      const text = 'Hello\nWorld';
      const result = textToHtmlBody(text);
      assert.strictEqual(result, '<p>Hello<br>\nWorld</p>');
    });

    it('should convert double newlines to paragraph breaks', () => {
      const text = 'Hello\n\nWorld';
      const result = textToHtmlBody(text);
      assert.strictEqual(result, '<p>Hello</p>\n<p>World</p>');
    });

    it('should handle empty text', () => {
      const result = textToHtmlBody('');
      assert.strictEqual(result, '<p></p>');
    });
  });

  describe('appendSignatureToBody', () => {
    it('should append signature to body', () => {
      const body = '<p>Hello</p>';
      const signature = '<div>Signature</div>';
      const result = appendSignatureToBody(body, signature);
      assert.ok(result.includes('<p>Hello</p>'));
      assert.ok(result.includes('<div>Signature</div>'));
    });

    it('should return unchanged body if signature is null', () => {
      const body = '<p>Hello</p>';
      const result = appendSignatureToBody(body, null);
      assert.strictEqual(result, body);
    });

    it('should add separator between body and signature', () => {
      const body = '<p>Hello</p>';
      const signature = '<div>Signature</div>';
      const result = appendSignatureToBody(body, signature);
      assert.ok(result.includes('<br>'));
    });
  });

  describe('loadInlineLogoAttachment', () => {
    it('should return null for missing file', async () => {
      const result = await loadInlineLogoAttachment('/nonexistent/logo.png', 'test-logo');
      assert.strictEqual(result, null);
    });

    it('should load logo as base64 attachment', async () => {
      writeFileSync(testLogoPath, MINIMAL_PNG);

      const result = await loadInlineLogoAttachment(testLogoPath, 'test-logo');
      assert.ok(result);
      assert.strictEqual(result['@odata.type'], '#microsoft.graph.fileAttachment');
      assert.strictEqual(result.contentType, 'image/png');
      assert.strictEqual(result.isInline, true);
      assert.strictEqual(result.contentId, 'test-logo');
      assert.ok(result.contentBytes);
    });

    it('should detect PNG content type', async () => {
      writeFileSync(testLogoPath, MINIMAL_PNG);

      const result = await loadInlineLogoAttachment(testLogoPath, 'logo');
      assert.strictEqual(result?.contentType, 'image/png');
    });

    it('should detect JPEG content type', async () => {
      const jpegPath = join(testDir, 'test-logo.jpg');
      writeFileSync(jpegPath, MINIMAL_PNG);

      const result = await loadInlineLogoAttachment(jpegPath, 'logo');
      assert.strictEqual(result?.contentType, 'image/jpeg');
    });

    it('should default to PNG for unknown extensions', async () => {
      const unknownPath = join(testDir, 'test-logo.xyz');
      writeFileSync(unknownPath, MINIMAL_PNG);

      const result = await loadInlineLogoAttachment(unknownPath, 'logo');
      assert.strictEqual(result?.contentType, 'image/png');
    });
  });

  describe('getSignatureConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env for each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return default config when env vars not set', () => {
      delete process.env.SIGNATURE_ENABLED;
      delete process.env.SIGNATURE_HTML_PATH;
      delete process.env.SIGNATURE_LOGO_PATH;
      delete process.env.SIGNATURE_LOGO_CONTENT_ID;

      const config = getSignatureConfig();
      assert.strictEqual(config.enabled, false);
      assert.strictEqual(config.htmlPath, 'assets/signature/exospace-signature.html');
      assert.strictEqual(config.logoPath, 'assets/signature/Exospace_file/image001.png');
      assert.strictEqual(config.logoContentId, 'exospace-logo');
    });

    it('should use env vars when set', () => {
      process.env.SIGNATURE_ENABLED = 'true';
      process.env.SIGNATURE_HTML_PATH = '/custom/signature.html';
      process.env.SIGNATURE_LOGO_PATH = '/custom/logo.png';
      process.env.SIGNATURE_LOGO_CONTENT_ID = 'custom-logo';

      const config = getSignatureConfig();
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.htmlPath, '/custom/signature.html');
      assert.strictEqual(config.logoPath, '/custom/logo.png');
      assert.strictEqual(config.logoContentId, 'custom-logo');
    });
  });

  describe('loadSignature', () => {
    it('should return null when signature is disabled', async () => {
      const config: SignatureConfig = {
        enabled: false,
        htmlPath: testSignaturePath,
        logoPath: testLogoPath,
        logoContentId: 'test-logo',
      };

      const result = await loadSignature(config);
      assert.strictEqual(result.signatureHtml, null);
      assert.strictEqual(result.logoAttachment, null);
      assert.strictEqual(result.warnings.length, 0);
    });

    it('should warn when signature file is missing', async () => {
      const config: SignatureConfig = {
        enabled: true,
        htmlPath: '/nonexistent/signature.html',
        logoPath: testLogoPath,
        logoContentId: 'test-logo',
      };

      const result = await loadSignature(config);
      assert.strictEqual(result.signatureHtml, null);
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0]?.includes('not found'));
    });

    it('should warn when logo file is missing', async () => {
      const htmlContent = '<html><body><p>Signature</p></body></html>';
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');

      const config: SignatureConfig = {
        enabled: true,
        htmlPath: testSignaturePath,
        logoPath: '/nonexistent/logo.png',
        logoContentId: 'test-logo',
      };

      const result = await loadSignature(config);
      assert.ok(result.signatureHtml);
      assert.strictEqual(result.logoAttachment, null);
      assert.ok(result.warnings.some(w => w.includes('Logo file not found')));
    });

    it('should load signature and logo when both exist', async () => {
      const htmlContent = '<html><body><p>Signature</p></body></html>';
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');
      writeFileSync(testLogoPath, MINIMAL_PNG);

      const config: SignatureConfig = {
        enabled: true,
        htmlPath: testSignaturePath,
        logoPath: testLogoPath,
        logoContentId: 'test-logo',
      };

      const result = await loadSignature(config);
      assert.ok(result.signatureHtml);
      assert.ok(result.logoAttachment);
      assert.strictEqual(result.warnings.length, 0);
    });
  });

  describe('prepareEmailBody', () => {
    it('should return HTML body without signature when disabled', async () => {
      const config: SignatureConfig = {
        enabled: false,
        htmlPath: testSignaturePath,
        logoPath: testLogoPath,
        logoContentId: 'test-logo',
      };

      const result = await prepareEmailBody('Hello World', config);
      assert.ok(result.htmlBody.includes('Hello World'));
      assert.strictEqual(result.attachments.length, 0);
      assert.strictEqual(result.warnings.length, 0);
    });

    it('should return HTML body with signature when enabled', async () => {
      const htmlContent = '<div>Test Signature</div>';
      writeFileSync(testSignaturePath, htmlContent, 'utf-8');
      writeFileSync(testLogoPath, MINIMAL_PNG);

      const config: SignatureConfig = {
        enabled: true,
        htmlPath: testSignaturePath,
        logoPath: testLogoPath,
        logoContentId: 'test-logo',
      };

      const result = await prepareEmailBody('Hello World', config);
      assert.ok(result.htmlBody.includes('Hello World'));
      assert.ok(result.htmlBody.includes('Test Signature'));
      assert.strictEqual(result.attachments.length, 1);
      assert.strictEqual(result.attachments[0]?.contentId, 'test-logo');
    });

    it('should warn when signature files are missing but continue', async () => {
      const config: SignatureConfig = {
        enabled: true,
        htmlPath: '/nonexistent/signature.html',
        logoPath: '/nonexistent/logo.png',
        logoContentId: 'test-logo',
      };

      const result = await prepareEmailBody('Hello World', config);
      assert.ok(result.htmlBody.includes('Hello World'));
      assert.strictEqual(result.attachments.length, 0);
      assert.ok(result.warnings.length >= 1);
    });

    it('should convert text to HTML paragraphs', async () => {
      const config: SignatureConfig = {
        enabled: false,
        htmlPath: '',
        logoPath: '',
        logoContentId: '',
      };

      const result = await prepareEmailBody('Hello\n\nWorld', config);
      assert.strictEqual(result.htmlBody, '<p>Hello</p>\n<p>World</p>');
    });
  });
});