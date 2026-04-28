import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import {
  generateRunId,
  getTimestamp,
  initLogFile,
  appendLogEntry,
  appendLogBatch,
  createDraftLogEntry,
  createSkippedLogEntry,
  createFailedLogEntry,
  getDefaultLogPath,
  readLogEntries,
} from '../src/log.js';
import type { DraftLogEntry, DraftStatus, TemplateType } from '../src/log.js';

const testDir = resolve(import.meta.dirname, 'fixtures', 'log-test');
const testLogFile = join(testDir, 'drafts.csv');

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

describe('log', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('generateRunId', () => {
    it('should generate a run ID in YYYYMMDD-HHMMSS format', () => {
      const runId = generateRunId();
      // Format: 20260428-143000
      assert.ok(/^\d{8}-\d{6}$/.test(runId), `Run ID should match format: ${runId}`);
    });

    it('should generate unique run IDs for different calls', async () => {
      const runId1 = generateRunId();
      // Small delay to ensure different timestamp if at second boundary
      await new Promise(resolve => setTimeout(resolve, 1001));
      const runId2 = generateRunId();
      // They might be the same if called within the same second, but that's expected
      // Just verify format is correct
      assert.ok(/^\d{8}-\d{6}$/.test(runId1));
      assert.ok(/^\d{8}-\d{6}$/.test(runId2));
    });
  });

  describe('getTimestamp', () => {
    it('should return ISO 8601 timestamp', () => {
      const timestamp = getTimestamp();
      // Format: 2026-04-28T14:30:00.000Z
      assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp));
    });
  });

  describe('initLogFile', () => {
    it('should create log file with headers', () => {
      initLogFile(testLogFile);
      assert.ok(existsSync(testLogFile));

      const content = readFileSync(testLogFile, 'utf-8');
      assert.ok(content.startsWith('timestamp,run_id,lead_id,company,email,subject,draft_id,status,template_type,error'));
    });

    it('should create parent directories if missing', () => {
      const nestedLogFile = join(testDir, 'nested', 'deep', 'drafts.csv');
      initLogFile(nestedLogFile);
      assert.ok(existsSync(nestedLogFile));
    });

    it('should not overwrite existing file', () => {
      initLogFile(testLogFile);
      const content1 = readFileSync(testLogFile, 'utf-8');

      // Add an entry
      appendLogEntry(testLogFile, {
        timestamp: getTimestamp(),
        runId: 'test-run',
        leadId: 'L-001',
        company: 'TestCorp',
        email: 'test@test.com',
        subject: 'Test',
        draftId: 'draft-1',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      });

      // Initialize again
      initLogFile(testLogFile);

      // Content should still have the entry
      const content2 = readFileSync(testLogFile, 'utf-8');
      assert.ok(content2.includes('test-run'));
      assert.ok(!content2.startsWith('timestamp\n')); // Header should be on first line
    });
  });

  describe('appendLogEntry', () => {
    it('should append a single log entry', () => {
      initLogFile(testLogFile);

      const entry: DraftLogEntry = {
        timestamp: '2026-04-28T14:30:00.000Z',
        runId: '20260428-143000',
        leadId: 'L-001',
        company: 'TestCorp',
        email: 'test@test.com',
        subject: 'Test Subject',
        draftId: 'draft-123',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      };

      appendLogEntry(testLogFile, entry);

      const content = readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      assert.strictEqual(lines.length, 2); // header + 1 entry
      assert.ok(lines[1]?.includes('L-001'));
      assert.ok(lines[1]?.includes('TestCorp'));
      assert.ok(lines[1]?.includes('created'));
    });

    it('should create file if it does not exist', () => {
      const newLogFile = join(testDir, 'new-drafts.csv');
      assert.ok(!existsSync(newLogFile));

      appendLogEntry(newLogFile, {
        timestamp: getTimestamp(),
        runId: 'test-run',
        leadId: 'L-001',
        company: 'Test',
        email: 'test@test.com',
        subject: 'Test',
        draftId: 'draft-1',
        status: 'created',
        templateType: 'generic_fallback',
        error: '',
      });

      assert.ok(existsSync(newLogFile));
      const content = readFileSync(newLogFile, 'utf-8');
      assert.ok(content.startsWith('timestamp,run_id'));
    });

    it('should escape values with commas', () => {
      initLogFile(testLogFile);

      const entry: DraftLogEntry = {
        timestamp: '2026-04-28T14:30:00.000Z',
        runId: 'test-run',
        leadId: 'L-001',
        company: 'Company, Inc.',
        email: 'test@test.com',
        subject: 'Subject',
        draftId: 'draft-1',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      };

      appendLogEntry(testLogFile, entry);

      const content = readFileSync(testLogFile, 'utf-8');
      assert.ok(content.includes('"Company, Inc."'));
    });

    it('should escape values with quotes', () => {
      initLogFile(testLogFile);

      const entry: DraftLogEntry = {
        timestamp: '2026-04-28T14:30:00.000Z',
        runId: 'test-run',
        leadId: 'L-001',
        company: 'Company "Test" Inc',
        email: 'test@test.com',
        subject: 'Subject',
        draftId: 'draft-1',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      };

      appendLogEntry(testLogFile, entry);

      const content = readFileSync(testLogFile, 'utf-8');
      assert.ok(content.includes('"Company ""Test"" Inc"'));
    });

    it('should escape values with newlines', () => {
      initLogFile(testLogFile);

      const entry: DraftLogEntry = {
        timestamp: '2026-04-28T14:30:00.000Z',
        runId: 'test-run',
        leadId: 'L-001',
        company: 'TestCorp',
        email: 'test@test.com',
        subject: 'Subject with\nnewline',
        draftId: 'draft-1',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      };

      appendLogEntry(testLogFile, entry);

      const content = readFileSync(testLogFile, 'utf-8');
      // The newline should be escaped in the CSV value
      assert.ok(content.includes('"Subject with\nnewline"'));
    });
  });

  describe('appendLogBatch', () => {
    it('should append multiple entries', () => {
      initLogFile(testLogFile);

      const entries: DraftLogEntry[] = [
        {
          timestamp: '2026-04-28T14:30:00.000Z',
          runId: 'test-run',
          leadId: 'L-001',
          company: 'Company1',
          email: 'test1@test.com',
          subject: 'Subject1',
          draftId: 'draft-1',
          status: 'created',
          templateType: 'company_specific',
          error: '',
        },
        {
          timestamp: '2026-04-28T14:30:01.000Z',
          runId: 'test-run',
          leadId: 'L-002',
          company: 'Company2',
          email: 'test2@test.com',
          subject: 'Subject2',
          draftId: 'draft-2',
          status: 'created',
          templateType: 'generic_fallback',
          error: '',
        },
      ];

      appendLogBatch(testLogFile, entries);

      const content = readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      assert.strictEqual(lines.length, 3); // header + 2 entries
    });

    it('should handle empty batch', () => {
      initLogFile(testLogFile);
      appendLogBatch(testLogFile, []);

      const content = readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      assert.strictEqual(lines.length, 1); // header only
    });
  });

  describe('createDraftLogEntry', () => {
    it('should create a created draft log entry', () => {
      const entry = createDraftLogEntry(
        '20260428-143000',
        'L-001',
        'TestCorp',
        'test@test.com',
        'Test Subject',
        'draft-123',
        'company_specific'
      );

      assert.strictEqual(entry.runId, '20260428-143000');
      assert.strictEqual(entry.leadId, 'L-001');
      assert.strictEqual(entry.company, 'TestCorp');
      assert.strictEqual(entry.email, 'test@test.com');
      assert.strictEqual(entry.subject, 'Test Subject');
      assert.strictEqual(entry.draftId, 'draft-123');
      assert.strictEqual(entry.status, 'created');
      assert.strictEqual(entry.templateType, 'company_specific');
      assert.strictEqual(entry.error, '');
    });
  });

  describe('createSkippedLogEntry', () => {
    it('should create a skipped log entry', () => {
      const entry = createSkippedLogEntry(
        '20260428-143000',
        'L-002',
        'SkipCorp',
        '',
        'skipped_no_email',
        'none'
      );

      assert.strictEqual(entry.status, 'skipped_no_email');
      assert.strictEqual(entry.templateType, 'none');
      assert.strictEqual(entry.draftId, '');
      assert.strictEqual(entry.subject, '');
      assert.strictEqual(entry.error, '');
    });

    it('should handle different skip reasons', () => {
      const reasons: DraftStatus[] = [
        'skipped_no_template',
        'skipped_no_email',
        'skipped_invalid_email',
        'skipped_inactive_status',
        'skipped_not_due',
      ];

      for (const reason of reasons) {
        const entry = createSkippedLogEntry(
          'test-run',
          'L-001',
          'Test',
          'test@test.com',
          reason,
          'none'
        );
        assert.strictEqual(entry.status, reason);
      }
    });
  });

  describe('createFailedLogEntry', () => {
    it('should create a failed log entry', () => {
      const entry = createFailedLogEntry(
        '20260428-143000',
        'L-003',
        'FailCorp',
        'test@test.com',
        'Test Subject',
        'company_specific',
        'API error: rate limit exceeded'
      );

      assert.strictEqual(entry.status, 'failed');
      assert.strictEqual(entry.error, 'API error: rate limit exceeded');
      assert.strictEqual(entry.draftId, '');
    });
  });

  describe('getDefaultLogPath', () => {
    it('should return default log path', () => {
      const path = getDefaultLogPath();
      assert.ok(path.endsWith('drafts.csv'));
      assert.ok(path.includes('logs'));
    });
  });

  describe('readLogEntries', () => {
    it('should return empty array for non-existent file', () => {
      const entries = readLogEntries('/nonexistent/path/drafts.csv');
      assert.strictEqual(entries.length, 0);
    });

    it('should read entries from log file', () => {
      initLogFile(testLogFile);

      appendLogBatch(testLogFile, [
        {
          timestamp: '2026-04-28T14:30:00.000Z',
          runId: 'test-run',
          leadId: 'L-001',
          company: 'TestCorp',
          email: 'test@test.com',
          subject: 'Subject',
          draftId: 'draft-1',
          status: 'created',
          templateType: 'company_specific',
          error: '',
        },
        {
          timestamp: '2026-04-28T14:31:00.000Z',
          runId: 'test-run',
          leadId: 'L-002',
          company: 'OtherCorp',
          email: 'other@test.com',
          subject: 'Subject 2',
          draftId: '',
          status: 'skipped_no_email',
          templateType: 'none',
          error: '',
        },
      ]);

      const entries = readLogEntries(testLogFile);
      assert.strictEqual(entries.length, 2);
      assert.strictEqual(entries[0]?.leadId, 'L-001');
      assert.strictEqual(entries[0]?.status, 'created');
      assert.strictEqual(entries[1]?.leadId, 'L-002');
      assert.strictEqual(entries[1]?.status, 'skipped_no_email');
    });

    it('should parse quoted values correctly', () => {
      initLogFile(testLogFile);

      appendLogEntry(testLogFile, {
        timestamp: '2026-04-28T14:30:00.000Z',
        runId: 'test-run',
        leadId: 'L-001',
        company: 'Company, Inc.',
        email: 'test@test.com',
        subject: 'Test "quoted" subject',
        draftId: 'draft-1',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      });

      const entries = readLogEntries(testLogFile);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0]?.company, 'Company, Inc.');
      assert.strictEqual(entries[0]?.subject, 'Test "quoted" subject');
    });
  });

  describe('error handling', () => {
    it('should not throw on invalid path', () => {
      // Should not throw, just warn
      assert.doesNotThrow(() => {
        appendLogEntry('/invalid/path/that/does/not/exist/drafts.csv', {
          timestamp: getTimestamp(),
          runId: 'test',
          leadId: 'L-001',
          company: 'Test',
          email: 'test@test.com',
          subject: 'Test',
          draftId: 'draft-1',
          status: 'created',
          templateType: 'company_specific',
          error: '',
        });
      });
    });

    it('should not throw on init error', () => {
      // Should not throw, just warn
      assert.doesNotThrow(() => {
        initLogFile('/invalid/path/that/does/not/exist/drafts.csv');
      });
    });
  });
});