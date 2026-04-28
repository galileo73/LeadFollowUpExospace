import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import {
  loadTemplates,
  loadTemplatesFromText,
  parseTemplatesFromText,
  findTemplate,
  getGenericTemplate,
  isGenericTemplate,
  populateTemplate,
  getTemplateForLead,
} from '../src/templates.js';
import type { Lead, EmailTemplate } from '../src/types.js';

const validTemplatePath = resolve(import.meta.dirname, 'fixtures/templates-valid.txt');
const emptyTemplatePath = resolve(import.meta.dirname, 'fixtures/templates-empty.txt');
const missingTemplatePath = resolve(import.meta.dirname, 'fixtures/nonexistent.txt');

// Sample templates for testing
const sampleTemplates: readonly EmailTemplate[] = [
  {
    company: 'ClearSpace',
    subject: 'Following up on ClearSpace inquiry',
    body: 'Good afternoon {ContactName},\n\nThank you for your interest in ExoSpace Engineering.\n\nWe would love to support {Company} with our engineering services.\n\nBest,\n{OwnerName}',
  },
  {
    company: 'Reflex Aerospace',
    subject: 'Reflex Aerospace - ExoSpace Partnership',
    body: 'Dear {ContactName},\n\nI would like to discuss partnership opportunities with {Company}.\n\nRegards,\n{OwnerName}',
  },
];

// Sample leads for testing
const sampleLead: Lead = {
  leadId: 'L-001',
  company: 'ClearSpace',
  contactName: 'Nicolas Croisard',
  email: 'nicolas@clearspace.today',
  phone: null,
  country: 'Switzerland',
  segment: 'Space',
  serviceLine: 'Engineering',
  source: 'Direct',
  leadScore: 70,
  status: 'Contacted',
  lastContactDate: new Date('2026-04-09'),
  nextFollowUpDate: new Date('2026-04-15'),
  daysToFollowUp: -9,
  owner: 'Gianluigi Rossi',
  needPain: 'Systems engineering',
  nextAction: 'Send follow-up',
  priority: 'A',
  lastMessageNotes: 'Intro sent',
  website: 'https://clearspace.today',
  linkedIn: '',
};

describe('templates', () => {
  describe('loadTemplates', () => {
    it('should return fallback when file does not exist', async () => {
      const result = await loadTemplates(missingTemplatePath);
      assert.strictEqual(result.source, 'fallback');
      assert.strictEqual(result.templates.length, 0);
      assert.ok(result.parseErrors.length > 0);
    });
  });

  describe('loadTemplatesFromText', () => {
    it('should parse templates from valid text', async () => {
      const text = `ClearSpace
Subject: Following up on ClearSpace inquiry
Good afternoon {ContactName},

Thank you for your interest.

Best,
{OwnerName}`;
      const result = await loadTemplatesFromText(text);
      assert.strictEqual(result.source, 'docx');
      assert.strictEqual(result.templates.length, 1);
      assert.strictEqual(result.templates[0]?.company, 'ClearSpace');
    });

    it('should return fallback when text is empty', async () => {
      const result = await loadTemplatesFromText('');
      assert.strictEqual(result.source, 'fallback');
      assert.strictEqual(result.templates.length, 0);
    });
  });

  describe('parseTemplatesFromText', () => {
    it('should parse templates from file content', () => {
      const content = readFileSync(validTemplatePath, 'utf-8');
      const { templates } = parseTemplatesFromText(content);

      assert.ok(templates.length > 0, 'Should parse at least one template');

      const companies = templates.map(t => t.company.toLowerCase());
      assert.ok(companies.includes('clearspace'));
      assert.ok(companies.includes('reflex aerospace'));
    });

    it('should extract company names from templates', () => {
      const content = readFileSync(validTemplatePath, 'utf-8');
      const { templates } = parseTemplatesFromText(content);

      for (const template of templates) {
        assert.ok(template.company.length > 0, 'Company name should not be empty');
      }
    });

    it('should extract subject lines from templates', () => {
      const content = readFileSync(validTemplatePath, 'utf-8');
      const { templates } = parseTemplatesFromText(content);

      for (const template of templates) {
        assert.ok(template.subject.length > 0, 'Subject should not be empty');
        assert.ok(!template.subject.toLowerCase().startsWith('subject:'), 'Subject should not include "Subject:" prefix');
      }
    });

    it('should extract body from templates', () => {
      const content = readFileSync(validTemplatePath, 'utf-8');
      const { templates } = parseTemplatesFromText(content);

      for (const template of templates) {
        assert.ok(template.body.length > 0, 'Body should not be empty');
      }
    });

    it('should parse multiple templates', () => {
      const content = readFileSync(validTemplatePath, 'utf-8');
      const { templates } = parseTemplatesFromText(content);

      assert.ok(templates.length >= 3, 'Should parse at least 3 templates');
    });

    it('should return empty array for empty content', () => {
      const { templates } = parseTemplatesFromText('');
      assert.strictEqual(templates.length, 0);
    });

    it('should ignore document title and parse exactly 3 templates', () => {
      // This matches the actual .docx structure
      const content = `Template Answer To Leads

ClearSpace

Subject: Following up on ExoSpace introduction

Good afternoon Mr. Croisard,

I hope you are well.

Kind regards, Gianluigi Rossi


Reflex Aerospace

Subject: Following up on ExoSpace introduction

Good afternoon Mr. Motzki,

I hope you are well.

Kind regards, Gianluigi Rossi


Helsing

Subject: Following up on ExoSpace introduction

Good afternoon Mr. Rogerson,

I hope you are well.

Kind regards, Gianluigi Rossi`;

      const { templates } = parseTemplatesFromText(content);

      assert.strictEqual(templates.length, 3, 'Should parse exactly 3 templates');

      // Verify company names
      assert.strictEqual(templates[0]?.company, 'ClearSpace');
      assert.strictEqual(templates[1]?.company, 'Reflex Aerospace');
      assert.strictEqual(templates[2]?.company, 'Helsing');

      // Verify "Template Answer To Leads" is NOT a company
      const companies = templates.map(t => t.company);
      assert.ok(!companies.includes('Template Answer To Leads'), 'Document title should not be parsed as a company');
    });

    it('should handle company names with spaces', () => {
      const content = `Reflex Aerospace

Subject: Test subject

Body text here`;

      const { templates } = parseTemplatesFromText(content);

      assert.strictEqual(templates.length, 1);
      assert.strictEqual(templates[0]?.company, 'Reflex Aerospace');
    });

    it('should handle blank lines between company and subject', () => {
      const content = `ClearSpace


Subject: Test subject

Body text`;

      const { templates } = parseTemplatesFromText(content);

      assert.strictEqual(templates.length, 1);
      assert.strictEqual(templates[0]?.company, 'ClearSpace');
      assert.strictEqual(templates[0]?.subject, 'Test subject');
    });
  });

  describe('findTemplate', () => {
    it('should find template by exact company name', () => {
      const template = findTemplate(sampleTemplates, 'ClearSpace');
      assert.ok(template);
      assert.strictEqual(template?.company, 'ClearSpace');
    });

    it('should find template case-insensitively', () => {
      const template = findTemplate(sampleTemplates, 'clearspace');
      assert.ok(template);
      assert.strictEqual(template?.company, 'ClearSpace');
    });

    it('should find template with trimmed company name', () => {
      const template = findTemplate(sampleTemplates, '  ClearSpace  ');
      assert.ok(template);
      assert.strictEqual(template?.company, 'ClearSpace');
    });

    it('should find template with collapsed spaces', () => {
      const template = findTemplate(sampleTemplates, 'Reflex  Aerospace');
      assert.ok(template);
      assert.strictEqual(template?.company, 'Reflex Aerospace');
    });

    it('should return null for unknown company', () => {
      const template = findTemplate(sampleTemplates, 'Unknown Company');
      assert.strictEqual(template, null);
    });

    it('should return null for empty templates array', () => {
      const template = findTemplate([], 'ClearSpace');
      assert.strictEqual(template, null);
    });
  });

  describe('getGenericTemplate', () => {
    it('should return a valid template', () => {
      const template = getGenericTemplate();
      assert.ok(template);
      assert.ok(template.subject.length > 0);
      assert.ok(template.body.length > 0);
    });

    it('should have generic company marker', () => {
      const template = getGenericTemplate();
      assert.strictEqual(template.company, '__generic__');
    });

    it('should include ContactNameGreeting placeholder', () => {
      const template = getGenericTemplate();
      assert.ok(template.body.includes('{ContactNameGreeting}'));
    });

    it('should include Company placeholder', () => {
      const template = getGenericTemplate();
      assert.ok(template.body.includes('{Company}'));
    });

    it('should include OwnerName placeholder', () => {
      const template = getGenericTemplate();
      assert.ok(template.body.includes('{OwnerName}'));
    });
  });

  describe('isGenericTemplate', () => {
    it('should return true for generic template', () => {
      const template = getGenericTemplate();
      assert.strictEqual(isGenericTemplate(template), true);
    });

    it('should return false for company-specific template', () => {
      assert.strictEqual(isGenericTemplate(sampleTemplates[0]!), false);
    });
  });

  describe('populateTemplate', () => {
    it('should replace ContactName placeholder', () => {
      const template = sampleTemplates[0]!;
      const populated = populateTemplate(template, sampleLead);
      assert.ok(populated.body.includes('Nicolas Croisard'));
    });

    it('should replace Company placeholder', () => {
      const template = sampleTemplates[0]!;
      const populated = populateTemplate(template, sampleLead);
      assert.ok(populated.body.includes('ClearSpace'));
    });

    it('should replace OwnerName placeholder', () => {
      const template = sampleTemplates[0]!;
      const populated = populateTemplate(template, sampleLead);
      assert.ok(populated.body.includes('Gianluigi Rossi'));
    });

    it('should replace placeholders in subject', () => {
      const template: EmailTemplate = {
        company: 'Test',
        subject: 'Meeting with {ContactName} from {Company}',
        body: 'Test',
      };
      const populated = populateTemplate(template, sampleLead);
      assert.strictEqual(populated.subject, 'Meeting with Nicolas Croisard from ClearSpace');
    });

    it('should handle missing ContactName in generic template', () => {
      const template = getGenericTemplate();
      const leadWithoutName: Lead = { ...sampleLead, contactName: '' };
      const populated = populateTemplate(template, leadWithoutName);

      // When ContactName is missing, the greeting should be clean (no extra comma)
      assert.ok(!populated.body.includes('{ContactNameGreeting}'));
      assert.ok(!populated.body.includes('{ContactName}'));
    });

    it('should handle missing OwnerName with default', () => {
      const template = sampleTemplates[0]!;
      const leadWithoutOwner: Lead = { ...sampleLead, owner: '' };
      const populated = populateTemplate(template, leadWithoutOwner);
      assert.ok(populated.body.includes('ExoSpace Team'));
    });

    it('should preserve template structure', () => {
      const template = sampleTemplates[0]!;
      const populated = populateTemplate(template, sampleLead);
      assert.strictEqual(populated.company, template.company);
      assert.ok(populated.subject.length > 0);
      assert.ok(populated.body.length > 0);
    });

    it('should handle ContactNameGreeting with name present', () => {
      const template = getGenericTemplate();
      const populated = populateTemplate(template, sampleLead);
      // With name, greeting should be "Good afternoon Nicolas Croisard,"
      assert.ok(populated.body.includes('Good afternoon Nicolas Croisard'));
    });

    it('should handle ContactNameGreeting without name', () => {
      const template = getGenericTemplate();
      const leadWithoutName: Lead = { ...sampleLead, contactName: '' };
      const populated = populateTemplate(template, leadWithoutName);
      // Without name, greeting should be "Good afternoon,"
      assert.ok(populated.body.includes('Good afternoon'));
      assert.ok(!populated.body.includes('Good afternoon ,'));
    });
  });

  describe('getTemplateForLead', () => {
    it('should return company-specific template when found', () => {
      const result = getTemplateForLead(sampleTemplates, sampleLead);
      assert.strictEqual(result.templateType, 'company_specific');
      assert.strictEqual(result.template.company, 'ClearSpace');
    });

    it('should return generic fallback when no match', () => {
      const lead: Lead = { ...sampleLead, company: 'Unknown Corp' };
      const result = getTemplateForLead(sampleTemplates, lead);
      assert.strictEqual(result.templateType, 'generic_fallback');
      assert.strictEqual(result.template.company, '__generic__');
    });

    it('should match company case-insensitively', () => {
      const lead: Lead = { ...sampleLead, company: 'CLEARSPACE' };
      const result = getTemplateForLead(sampleTemplates, lead);
      assert.strictEqual(result.templateType, 'company_specific');
    });

    it('should match company with extra spaces', () => {
      const lead: Lead = { ...sampleLead, company: '  ClearSpace  ' };
      const result = getTemplateForLead(sampleTemplates, lead);
      assert.strictEqual(result.templateType, 'company_specific');
    });

    it('should work with empty templates array', () => {
      const lead: Lead = { ...sampleLead, company: 'ClearSpace' };
      const result = getTemplateForLead([], lead);
      assert.strictEqual(result.templateType, 'generic_fallback');
      assert.strictEqual(result.template.company, '__generic__');
    });
  });
});