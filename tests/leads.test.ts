import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import {
  loadLeads,
  filterDueLeads,
  filterValidLeads,
  isDueForFollowUp,
} from '../src/leads.js';
import type { SkipReason } from '../src/leads.js';

const fixturePath = resolve(import.meta.dirname, 'fixtures/sample-leads.csv');
const malformedFixturePath = resolve(import.meta.dirname, 'fixtures/malformed-leads.csv');

describe('leads', () => {
  describe('loadLeads', () => {
    it('should parse CSV with semicolon delimiter', async () => {
      const result = await loadLeads(fixturePath);
      assert.ok(result.leads.length > 0, 'Should load leads');
    });

    it('should return summary with counts', async () => {
      const result = await loadLeads(fixturePath);
      assert.ok(result.summary.totalRows >= 0, 'Should have totalRows');
      assert.ok(result.summary.validLeads >= 0, 'Should have validLeads');
      assert.ok(result.summary.bySkipReason, 'Should have bySkipReason');
    });

    it('should parse Lead ID correctly', async () => {
      const result = await loadLeads(fixturePath);
      assert.strictEqual(result.leads[0]?.leadId, 'L-001');
    });

    it('should parse company name correctly', async () => {
      const result = await loadLeads(fixturePath);
      assert.strictEqual(result.leads[0]?.company, 'ClearSpace');
    });

    it('should parse email correctly', async () => {
      const result = await loadLeads(fixturePath);
      assert.strictEqual(result.leads[0]?.email, 'nicolas.croisard@clearspace.today');
    });

    it('should handle missing email as null', async () => {
      const result = await loadLeads(fixturePath);
      const noEmailLead = result.leads.find(l => l.leadId === 'L-003');
      assert.strictEqual(noEmailLead?.email, null);
    });

    it('should parse European date format DD/MM/YYYY', async () => {
      const result = await loadLeads(fixturePath);
      const date = result.leads[0]?.lastContactDate;
      assert.ok(date instanceof Date, 'Should parse as Date');
      // 09/04/2026 = April 9, 2026
      assert.strictEqual(date?.getMonth(), 3, 'Month should be April (0-indexed)');
      assert.strictEqual(date?.getDate(), 9);
      assert.strictEqual(date?.getFullYear(), 2026);
    });

    it('should parse days to follow-up as number', async () => {
      const result = await loadLeads(fixturePath);
      assert.strictEqual(result.leads[0]?.daysToFollowUp, -9);
    });

    it('should parse status correctly', async () => {
      const result = await loadLeads(fixturePath);
      assert.strictEqual(result.leads[0]?.status, 'Contacted');
    });

    it('should trim spaces from fields', async () => {
      const result = await loadLeads(fixturePath);
      const trimmedLead = result.leads.find(l => l.leadId === 'L-007');
      assert.strictEqual(trimmedLead?.company, 'Trimmed Corp');
      assert.strictEqual(trimmedLead?.email, 'trimmed@example.com');
    });

    it('should skip rows without Lead ID but track them', async () => {
      const result = await loadLeads(fixturePath);
      // The last row has empty Lead ID but has Company
      const skippedNoId = result.skipped.find(s => s.skipReason === 'missing_lead_id');
      assert.ok(skippedNoId, 'Should have skipped leads with missing_lead_id');
      assert.strictEqual(skippedNoId?.company, 'NoLeadId Corp');
    });

    it('should handle malformed rows without crashing', async () => {
      const result = await loadLeads(malformedFixturePath);
      // Should not throw, should return result with malformed entries
      assert.ok(result.malformed.length >= 0, 'Should handle malformed rows');
    });
  });

  describe('filterValidLeads', () => {
    it('should filter out rows without Lead ID', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      // L-001 to L-008 have valid Lead ID and Company
      // Last row (empty Lead ID) is filtered out by loadLeads
      assert.strictEqual(valid.length, 8);
    });

    it('should include leads with Lead ID', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      assert.ok(valid.every(l => l.leadId.length > 0));
    });
  });

  describe('isDueForFollowUp', () => {
    it('should return true for overdue leads with valid email', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l001 = valid.find(l => l.leadId === 'L-001');
      assert.strictEqual(isDueForFollowUp(l001!), true);
    });

    it('should return false for leads without email', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l003 = valid.find(l => l.leadId === 'L-003');
      // No email
      assert.strictEqual(isDueForFollowUp(l003!), false);
    });

    it('should return false for leads with invalid email', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l006 = valid.find(l => l.leadId === 'L-006');
      // Invalid email: "not-an-email"
      assert.strictEqual(isDueForFollowUp(l006!), false);
    });

    it('should return false for leads with future follow-up', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l004 = valid.find(l => l.leadId === 'L-004');
      assert.strictEqual(isDueForFollowUp(l004!), false);
    });

    it('should return false for closed/won leads', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l005 = valid.find(l => l.leadId === 'L-005');
      assert.strictEqual(isDueForFollowUp(l005!), false);
    });

    it('should return true for leads due today (daysToFollowUp = 0)', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l008 = valid.find(l => l.leadId === 'L-008');
      // daysToFollowUp = 0, should be due
      assert.strictEqual(isDueForFollowUp(l008!), true);
    });

    it('should return true for leads with trimmed status (case-insensitive)', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const l007 = valid.find(l => l.leadId === 'L-007');
      // Status "  New  " trimmed to "New", should be active
      assert.strictEqual(isDueForFollowUp(l007!), true);
    });

    it('should handle case-insensitive status (uppercase)', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      // L-002 has "CONTACTED" uppercase
      const l002 = valid.find(l => l.leadId === 'L-002');
      assert.strictEqual(isDueForFollowUp(l002!), true);
    });
  });

  describe('filterDueLeads', () => {
    it('should return only leads due for follow-up', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      // L-001, L-002, L-007, L-008 are due:
      // - valid email
      // - active status (Contacted, CONTACTED, New, New)
      // - daysToFollowUp <= 0 (-9, -4, -3, 0)
      assert.strictEqual(dueResult.dueLeads.length, 4);
      assert.ok(dueResult.dueLeads.some(l => l.leadId === 'L-001'));
      assert.ok(dueResult.dueLeads.some(l => l.leadId === 'L-002'));
      assert.ok(dueResult.dueLeads.some(l => l.leadId === 'L-007'));
      assert.ok(dueResult.dueLeads.some(l => l.leadId === 'L-008'));
    });

    it('should return summary with counts', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      assert.ok(dueResult.summary.totalProcessed >= 0);
      assert.ok(dueResult.summary.dueCount >= 0);
      assert.ok(dueResult.summary.skippedCount >= 0);
    });

    it('should track skip reasons', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      assert.ok(dueResult.summary.bySkipReason);

      // Check specific skip reasons exist
      const reasons = dueResult.skipped.map(s => s.skipReason);
      assert.ok(reasons.includes('missing_email'), 'Should have missing_email skips');
      assert.ok(reasons.includes('invalid_email'), 'Should have invalid_email skips');
      assert.ok(reasons.includes('inactive_status'), 'Should have inactive_status skips');
      assert.ok(reasons.includes('not_due'), 'Should have not_due skips');
    });

    it('should skip leads with missing email', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      const missingEmail = dueResult.skipped.find(s => s.skipReason === 'missing_email');
      assert.ok(missingEmail, 'Should skip leads without email');
      assert.strictEqual(missingEmail?.leadId, 'L-003');
    });

    it('should skip leads with invalid email', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      const invalidEmail = dueResult.skipped.find(s => s.skipReason === 'invalid_email');
      assert.ok(invalidEmail, 'Should skip leads with invalid email');
      assert.strictEqual(invalidEmail?.leadId, 'L-006');
    });

    it('should skip leads with inactive status', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      const inactive = dueResult.skipped.find(s => s.skipReason === 'inactive_status');
      assert.ok(inactive, 'Should skip leads with inactive status');
      assert.strictEqual(inactive?.leadId, 'L-005');
    });

    it('should skip leads not yet due', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);
      const notDue = dueResult.skipped.find(s => s.skipReason === 'not_due');
      assert.ok(notDue, 'Should skip leads not yet due');
      assert.strictEqual(notDue?.leadId, 'L-004');
    });

    it('should count skip reasons in summary', async () => {
      const result = await loadLeads(fixturePath);
      const valid = filterValidLeads(result.leads);
      const dueResult = filterDueLeads(valid);

      // Sum of all skip reason counts should equal total skipped
      const totalByReason = Object.values(dueResult.summary.bySkipReason).reduce((a, b) => a + b, 0);
      assert.strictEqual(totalByReason, dueResult.summary.skippedCount);
    });
  });

  describe('edge cases', () => {
    it('should handle empty CSV file', async () => {
      const emptyPath = resolve(import.meta.dirname, 'fixtures/empty-leads.csv');
      const result = await loadLeads(emptyPath);
      assert.strictEqual(result.leads.length, 0);
      assert.strictEqual(result.summary.totalRows, 0);
    });

    it('should handle header-only CSV file', async () => {
      const headerOnlyPath = resolve(import.meta.dirname, 'fixtures/header-only-leads.csv');
      const result = await loadLeads(headerOnlyPath);
      assert.strictEqual(result.leads.length, 0);
      assert.strictEqual(result.summary.totalRows, 0);
    });
  });
});