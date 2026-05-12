import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import {
  validateEmail,
  createGraphClient,
  buildDraftRequest,
  type GraphDraftRequest,
  type DraftResult,
  type EmailAttachment,
} from '../src/drafts.js';
import type { Lead } from '../src/types.js';
import type { InlineAttachment } from '../src/signature.js';
import type { FileAttachment } from '../src/attachments.js';

const testDir = resolve(import.meta.dirname, 'fixtures', 'drafts-test');

// Helper to create a valid Lead object
function createTestLead(overrides: Partial<Lead> = {}): Lead {
  return {
    leadId: 'L001',
    company: 'Acme Corp',
    contactName: 'John Doe',
    email: 'john.doe@acme.com',
    phone: null,
    country: 'US',
    segment: 'Enterprise',
    serviceLine: 'Consulting',
    source: 'Website',
    leadScore: 85,
    status: 'New',
    lastContactDate: new Date('2026-04-01'),
    nextFollowUpDate: new Date('2026-04-15'),
    daysToFollowUp: 14,
    owner: 'Sales Team',
    needPain: 'Time management',
    nextAction: 'Schedule demo',
    priority: 'High',
    lastMessageNotes: 'Initial contact made',
    website: 'https://acme.com',
    linkedIn: 'https://linkedin.com/company/acme',
    ...overrides,
  };
}

// Test fixtures
const testLead = createTestLead();

const testLeadNoEmail = createTestLead({
  leadId: 'L002',
  company: 'No Email Inc',
  contactName: 'Jane Smith',
  email: null,
});

const testLeadInvalidEmail = createTestLead({
  leadId: 'L003',
  company: 'Bad Email Co',
  contactName: 'Bob Wilson',
  email: 'not-an-email',
});

const testAttachment: InlineAttachment = {
  '@odata.type': '#microsoft.graph.fileAttachment',
  name: 'logo.png',
  contentType: 'image/png',
  contentBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
  isInline: true,
  contentId: 'logo@signature',
};

// Test PPTX file attachment (regular, not inline)
const testPptxAttachment: FileAttachment = {
  '@odata.type': '#microsoft.graph.fileAttachment',
  name: 'presentation.pptx',
  contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  contentBytes: 'UEsDBBQABgAIAAAAIQ==',
  // Note: isInline is intentionally omitted for regular file attachments
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

describe('drafts', () => {
  beforeEach(() => {
    cleanupTestDir();
    ensureTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      assert.strictEqual(validateEmail('test@example.com'), true);
      assert.strictEqual(validateEmail('user.name@domain.org'), true);
      assert.strictEqual(validateEmail('first.last@subdomain.example.com'), true);
    });

    it('should return false for invalid email addresses', () => {
      assert.strictEqual(validateEmail('not-an-email'), false);
      assert.strictEqual(validateEmail('missing@domain'), false);
      assert.strictEqual(validateEmail('@nodomain.com'), false);
      assert.strictEqual(validateEmail('spaces in@email.com'), false);
    });

    it('should return false for null or undefined', () => {
      assert.strictEqual(validateEmail(null), false);
      assert.strictEqual(validateEmail(undefined), false);
    });

    it('should trim whitespace before validating', () => {
      assert.strictEqual(validateEmail('  test@example.com  '), true);
      assert.strictEqual(validateEmail('\ttest@example.com\n'), true);
    });

    it('should return false for empty string', () => {
      assert.strictEqual(validateEmail(''), false);
      assert.strictEqual(validateEmail('   '), false);
    });
  });

  describe('createGraphClient', () => {
    it('should create a Microsoft Graph client', () => {
      const accessToken = 'test-access-token';
      const client = createGraphClient(accessToken);

      assert.ok(client, 'Should create client');
      assert.ok(typeof client.api === 'function', 'Should have api method');
    });

    it('should accept any string as access token', () => {
      // The client is created, actual validation happens when making API calls
      const client = createGraphClient('any-token-string');
      assert.ok(client, 'Should create client even with dummy token');
    });
  });

  describe('buildDraftRequest', () => {
    it('should build a draft request with all fields', () => {
      const subject = 'Follow-up: Acme Corp';
      const htmlBody = '<p>Hello John Doe,</p>';

      const request = buildDraftRequest(testLead, subject, htmlBody);

      assert.strictEqual(request.lead.leadId, 'L001');
      assert.strictEqual(request.subject, subject);
      assert.strictEqual(request.htmlBody, htmlBody);
      assert.strictEqual(request.attachments, undefined);
    });

    it('should include attachments when provided', () => {
      const subject = 'Follow-up';
      const htmlBody = '<p>Hello</p>';
      const attachments = [testAttachment];

      const request = buildDraftRequest(testLead, subject, htmlBody, attachments);

      assert.ok(request.attachments, 'Should have attachments');
      assert.strictEqual(request.attachments?.length, 1);
      assert.strictEqual(request.attachments?.[0]?.name, 'logo.png');
      assert.strictEqual((request.attachments?.[0] as InlineAttachment).contentId, 'logo@signature');
    });

    it('should preserve lead data in request', () => {
      const request = buildDraftRequest(testLeadNoEmail, 'Subject', 'Body');

      assert.strictEqual(request.lead.email, null);
      assert.strictEqual(request.lead.company, 'No Email Inc');
    });
  });

  describe('DraftResult', () => {
    it('should have correct structure for successful result', () => {
      const result: DraftResult = {
        leadId: 'L001',
        company: 'Acme Corp',
        email: 'john.doe@acme.com',
        subject: 'Test Subject',
        draftId: 'draft-123',
        success: true,
      };

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.draftId, 'draft-123');
      assert.strictEqual(result.error, undefined);
    });

    it('should have correct structure for failed result', () => {
      const result: DraftResult = {
        leadId: 'L002',
        company: 'No Email Inc',
        email: '',
        subject: 'Test Subject',
        draftId: null,
        success: false,
        error: 'Invalid or missing email address',
      };

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.draftId, null);
      assert.strictEqual(result.error, 'Invalid or missing email address');
    });
  });

  describe('GraphDraftRequest', () => {
    it('should accept readonly arrays for attachments', () => {
      const attachments: readonly InlineAttachment[] = [testAttachment];
      const request: GraphDraftRequest = {
        lead: testLead,
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        attachments,
      };

      assert.strictEqual(request.attachments?.length, 1);
    });

    it('should work without attachments', () => {
      const request: GraphDraftRequest = {
        lead: testLead,
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      };

      assert.strictEqual(request.attachments, undefined);
    });
  });

  describe('error handling patterns', () => {
    it('should handle various email edge cases', () => {
      // These are valid email formats that should pass
      assert.strictEqual(validateEmail('a@b.c'), true);
      assert.strictEqual(validateEmail('test+tag@example.com'), true);
      assert.strictEqual(validateEmail('user123@sub.domain.example.co.uk'), true);

      // These are invalid
      assert.strictEqual(validateEmail('test'), false);
      assert.strictEqual(validateEmail('test@'), false);
      assert.strictEqual(validateEmail('@example.com'), false);
      assert.strictEqual(validateEmail('test@example'), false);
    });

    it('should handle lead with empty email string', () => {
      const leadEmptyEmail = createTestLead({
        email: '',
      });

      const request = buildDraftRequest(leadEmptyEmail, 'Test', '<p>Test</p>');
      assert.strictEqual(request.lead.email, '');
      assert.strictEqual(validateEmail(request.lead.email), false);
    });
  });

  describe('integration patterns', () => {
    it('should support building requests for multiple leads', () => {
      const leads: Lead[] = [testLead, testLeadNoEmail, testLeadInvalidEmail];
      const requests: GraphDraftRequest[] = [];

      for (const lead of leads) {
        requests.push(
          buildDraftRequest(lead, `Follow-up: ${lead.company}`, `<p>Hello ${lead.contactName}</p>`)
        );
      }

      assert.strictEqual(requests.length, 3);
      assert.strictEqual(requests[0]?.lead.company, 'Acme Corp');
      assert.strictEqual(requests[1]?.lead.email, null);
      assert.strictEqual(requests[2]?.lead.email, 'not-an-email');
    });

    it('should support filtering valid email requests', () => {
      const leads: Lead[] = [testLead, testLeadNoEmail, testLeadInvalidEmail];
      const requests: GraphDraftRequest[] = leads.map((lead) =>
        buildDraftRequest(lead, `Subject for ${lead.company}`, '<p>Body</p>')
      );

      const validRequests = requests.filter((r) => validateEmail(r.lead.email));

      // Only the first lead has a valid email
      assert.strictEqual(validRequests.length, 1);
      assert.strictEqual(validRequests[0]?.lead.leadId, 'L001');
    });

    it('should use contactName for recipient display name', () => {
      const lead: Lead = createTestLead({
        contactName: 'Jane Doe',
        company: 'Acme Corp',
      });

      // The recipient name should be the contact name
      const recipientName = lead.contactName?.trim() || lead.company;
      assert.strictEqual(recipientName, 'Jane Doe');
    });

    it('should fall back to company name when contactName is empty', () => {
      const lead: Lead = createTestLead({
        contactName: '',
        company: 'Acme Corp',
      });

      // The recipient name should fall back to company
      const recipientName = lead.contactName?.trim() || lead.company;
      assert.strictEqual(recipientName, 'Acme Corp');
    });

    it('should fall back to company name when contactName is whitespace', () => {
      const lead: Lead = createTestLead({
        contactName: '   ',
        company: 'Acme Corp',
      });

      // Whitespace-only contactName should be trimmed and fall back to company
      const recipientName = lead.contactName?.trim() || lead.company;
      assert.strictEqual(recipientName, 'Acme Corp');
    });
  });

  describe('PPTX attachment support', () => {
    it('should support only inline logo attachment (backward compatible)', () => {
      const subject = 'Follow-up: Acme Corp';
      const htmlBody = '<p>Hello John Doe,</p>';
      const attachments: readonly InlineAttachment[] = [testAttachment];

      const request = buildDraftRequest(testLead, subject, htmlBody, attachments);

      assert.ok(request.attachments, 'Should have attachments');
      assert.strictEqual(request.attachments?.length, 1);
      assert.strictEqual(request.attachments?.[0]?.name, 'logo.png');
      // Verify it's an inline attachment
      assert.strictEqual((request.attachments?.[0] as InlineAttachment).isInline, true);
      assert.strictEqual((request.attachments?.[0] as InlineAttachment).contentId, 'logo@signature');
    });

    it('should support both inline logo and PPTX file attachments', () => {
      const subject = 'Follow-up: Acme Corp';
      const htmlBody = '<p>Hello John Doe,</p>';
      const attachments: readonly EmailAttachment[] = [testAttachment, testPptxAttachment];

      const request = buildDraftRequest(testLead, subject, htmlBody, attachments);

      assert.ok(request.attachments, 'Should have attachments');
      assert.strictEqual(request.attachments?.length, 2);

      // First attachment should be inline logo
      const inlineAtt = request.attachments?.[0] as InlineAttachment;
      assert.strictEqual(inlineAtt.name, 'logo.png');
      assert.strictEqual(inlineAtt.isInline, true);
      assert.strictEqual(inlineAtt.contentId, 'logo@signature');

      // Second attachment should be PPTX file (not inline)
      const fileAtt = request.attachments?.[1] as FileAttachment;
      assert.strictEqual(fileAtt.name, 'presentation.pptx');
      assert.strictEqual(fileAtt.contentType, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      assert.strictEqual(fileAtt.contentBytes, 'UEsDBBQABgAIAAAAIQ==');
      // PPTX attachments do NOT have isInline property
      assert.strictEqual('isInline' in fileAtt, false);
      assert.strictEqual('contentId' in fileAtt, false);
    });

    it('should support only PPTX attachment without inline logo', () => {
      const subject = 'Follow-up: Acme Corp';
      const htmlBody = '<p>Hello John Doe,</p>';
      const attachments: readonly FileAttachment[] = [testPptxAttachment];

      const request = buildDraftRequest(testLead, subject, htmlBody, attachments);

      assert.ok(request.attachments, 'Should have attachments');
      assert.strictEqual(request.attachments?.length, 1);

      const fileAtt = request.attachments?.[0] as FileAttachment;
      assert.strictEqual(fileAtt.name, 'presentation.pptx');
      assert.strictEqual(fileAtt.contentType, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      // PPTX attachment is NOT inline
      assert.strictEqual('isInline' in fileAtt, false);
      assert.strictEqual('contentId' in fileAtt, false);
    });

    it('should preserve backward compatibility with existing InlineAttachment[] type', () => {
      // This test ensures existing code using InlineAttachment[] still works
      const inlineAttachments: readonly InlineAttachment[] = [testAttachment];

      const request: GraphDraftRequest = {
        lead: testLead,
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        attachments: inlineAttachments,
      };

      assert.strictEqual(request.attachments?.length, 1);
      assert.strictEqual(request.attachments?.[0]?.name, 'logo.png');
    });

    it('should allow mixed attachment types in GraphDraftRequest', () => {
      // This tests that EmailAttachment union type works correctly
      const mixedAttachments: readonly EmailAttachment[] = [
        testAttachment,      // InlineAttachment
        testPptxAttachment,  // FileAttachment
      ];

      const request: GraphDraftRequest = {
        lead: testLead,
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        attachments: mixedAttachments,
      };

      assert.strictEqual(request.attachments?.length, 2);
    });

    it('should correctly identify inline vs file attachments by properties', () => {
      const attachments: readonly EmailAttachment[] = [testAttachment, testPptxAttachment];

      const request = buildDraftRequest(testLead, 'Test', '<p>Test</p>', attachments);

      // Check inline attachment has required properties
      const inline = request.attachments?.[0];
      assert.ok(inline, 'First attachment should exist');
      assert.strictEqual('isInline' in inline && inline.isInline, true);
      assert.strictEqual('contentId' in inline, true);

      // Check file attachment lacks inline properties
      const file = request.attachments?.[1];
      assert.ok(file, 'Second attachment should exist');
      assert.strictEqual('isInline' in file, false);
      assert.strictEqual('contentId' in file, false);
    });
  });
});