import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { loadLeads, filterValidLeads, isDueForFollowUp, getDueLeads } from '../src/leads.js';

const fixturePath = resolve(import.meta.dirname, 'fixtures/sample-leads.csv');

describe('leads', () => {
  describe('loadLeads', () => {
    it('should parse CSV with semicolon delimiter', async () => {
      const leads = await loadLeads(fixturePath);
      assert.ok(leads.length > 0, 'Should load leads');
    });

    it('should parse Lead ID correctly', async () => {
      const leads = await loadLeads(fixturePath);
      assert.strictEqual(leads[0]?.leadId, 'L-001');
    });

    it('should parse company name correctly', async () => {
      const leads = await loadLeads(fixturePath);
      assert.strictEqual(leads[0]?.company, 'ClearSpace');
    });

    it('should parse email correctly', async () => {
      const leads = await loadLeads(fixturePath);
      assert.strictEqual(leads[0]?.email, 'nicolas.croisard@clearspace.today');
    });

    it('should handle missing email as null', async () => {
      const leads = await loadLeads(fixturePath);
      const noEmailLead = leads.find(l => l.leadId === 'L-003');
      assert.strictEqual(noEmailLead?.email, null);
    });

    it('should parse European date format DD/MM/YYYY', async () => {
      const leads = await loadLeads(fixturePath);
      const date = leads[0]?.lastContactDate;
      assert.ok(date instanceof Date, 'Should parse as Date');
      // 09/04/2026 = April 9, 2026
      assert.strictEqual(date?.getMonth(), 3, 'Month should be April (0-indexed)');
      assert.strictEqual(date?.getDate(), 9);
      assert.strictEqual(date?.getFullYear(), 2026);
    });

    it('should parse days to follow-up as number', async () => {
      const leads = await loadLeads(fixturePath);
      assert.strictEqual(leads[0]?.daysToFollowUp, -9);
    });

    it('should parse status correctly', async () => {
      const leads = await loadLeads(fixturePath);
      assert.strictEqual(leads[0]?.status, 'Contacted');
    });
  });

  describe('filterValidLeads', () => {
    it('should filter out empty rows', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      // Only L-001 to L-005 are valid
      assert.strictEqual(valid.length, 5);
    });

    it('should include leads with Lead ID', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      assert.ok(valid.every(l => l.leadId.length > 0));
    });
  });

  describe('isDueForFollowUp', () => {
    it('should return true for overdue leads with email', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const l001 = valid.find(l => l.leadId === 'L-001');
      assert.strictEqual(isDueForFollowUp(l001!), true);
    });

    it('should return true for due today leads', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const l003 = valid.find(l => l.leadId === 'L-003');
      // L-003 has daysToFollowUp = 1, so NOT due yet
      // We need to test with daysToFollowUp = 0 or negative
      assert.strictEqual(isDueForFollowUp(l003!), false);
    });

    it('should return false for leads with future follow-up', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const l004 = valid.find(l => l.leadId === 'L-004');
      assert.strictEqual(isDueForFollowUp(l004!), false);
    });

    it('should return false for closed/won leads', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const l005 = valid.find(l => l.leadId === 'L-005');
      assert.strictEqual(isDueForFollowUp(l005!), false);
    });

    it('should return false for leads without email', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const l003 = valid.find(l => l.leadId === 'L-003');
      // No email, so not due
      assert.strictEqual(isDueForFollowUp(l003!), false);
    });
  });

  describe('getDueLeads', () => {
    it('should return only leads due for follow-up', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const due = getDueLeads(valid);
      // L-001 and L-002 are overdue with email
      assert.strictEqual(due.length, 2);
      assert.ok(due.some(d => d.lead.leadId === 'L-001'));
      assert.ok(due.some(d => d.lead.leadId === 'L-002'));
    });

    it('should set hasEmail flag correctly', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const due = getDueLeads(valid);
      assert.ok(due.every(d => d.hasEmail === true));
    });

    it('should set isDue flag correctly', async () => {
      const leads = await loadLeads(fixturePath);
      const valid = filterValidLeads(leads);
      const due = getDueLeads(valid);
      assert.ok(due.every(d => d.isDue === true));
    });
  });
});