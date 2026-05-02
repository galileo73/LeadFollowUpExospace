import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCliArgs,
  DEFAULT_MODE,
  VALID_MODES,
  type CliArgs,
} from '../src/cli.js';

describe('cli', () => {
  describe('parseCliArgs', () => {
    it('should return default mode when no args provided', () => {
      const result = parseCliArgs([]);
      assert.strictEqual(result.mode, DEFAULT_MODE);
      assert.strictEqual(result.mode, 'follow-up');
      assert.strictEqual(result.help, false);
    });

    it('should parse --mode follow-up', () => {
      const result = parseCliArgs(['--mode', 'follow-up']);
      assert.strictEqual(result.mode, 'follow-up');
      assert.strictEqual(result.help, false);
    });

    it('should parse --mode outreach', () => {
      const result = parseCliArgs(['--mode', 'outreach']);
      assert.strictEqual(result.mode, 'outreach');
      assert.strictEqual(result.help, false);
    });

    it('should parse --mode=outreach format', () => {
      const result = parseCliArgs(['--mode=outreach']);
      assert.strictEqual(result.mode, 'outreach');
    });

    it('should parse --mode=follow-up format', () => {
      const result = parseCliArgs(['--mode=follow-up']);
      assert.strictEqual(result.mode, 'follow-up');
    });

    it('should parse --help flag', () => {
      const result = parseCliArgs(['--help']);
      assert.strictEqual(result.help, true);
    });

    it('should parse -h flag', () => {
      const result = parseCliArgs(['-h']);
      assert.strictEqual(result.help, true);
    });

    it('should parse --help with other args', () => {
      const result = parseCliArgs(['--mode', 'outreach', '--help']);
      assert.strictEqual(result.mode, 'outreach');
      assert.strictEqual(result.help, true);
    });

    it('should accept follow-up as positional argument', () => {
      const result = parseCliArgs(['follow-up']);
      assert.strictEqual(result.mode, 'follow-up');
    });

    it('should accept outreach as positional argument', () => {
      const result = parseCliArgs(['outreach']);
      assert.strictEqual(result.mode, 'outreach');
    });
  });

  describe('DEFAULT_MODE', () => {
    it('should be follow-up', () => {
      assert.strictEqual(DEFAULT_MODE, 'follow-up');
    });
  });

  describe('VALID_MODES', () => {
    it('should contain follow-up and outreach', () => {
      assert.strictEqual(VALID_MODES.length, 2);
      assert.ok(VALID_MODES.includes('follow-up'));
      assert.ok(VALID_MODES.includes('outreach'));
    });
  });
});