import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import type { Lead } from './types.ts';

// Types for filtering results
export type SkipReason =
  | 'missing_email'
  | 'invalid_email'
  | 'inactive_status'
  | 'not_due'
  | 'invalid_date'
  | 'missing_lead_id';

export interface SkippedLead {
  readonly leadId: string | null;
  readonly company: string;
  readonly skipReason: SkipReason;
  readonly rawRow: Record<string, string>;
}

export interface ParseResult {
  readonly leads: readonly Lead[];
  readonly skipped: readonly SkippedLead[];
  readonly malformed: readonly MalformedRow[];
  readonly summary: ParseSummary;
}

export interface MalformedRow {
  readonly lineNumber: number;
  readonly rawRow: string;
  readonly error: string;
}

export interface ParseSummary {
  readonly totalRows: number;
  readonly validLeads: number;
  readonly skippedCount: number;
  readonly malformedCount: number;
  readonly bySkipReason: Record<SkipReason, number>;
}

// Due lead result
export interface DueLeadResult {
  readonly dueLeads: readonly Lead[];
  readonly skipped: readonly SkippedLead[];
  readonly summary: DueLeadSummary;
}

export interface DueLeadSummary {
  readonly totalProcessed: number;
  readonly dueCount: number;
  readonly skippedCount: number;
  readonly bySkipReason: Record<SkipReason, number>;
}

// Active lead statuses (normalized to lowercase)
const ACTIVE_STATUSES = new Set([
  'new',
  'contacted',
  'in progress',
  'qualified',
]);

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseDate(dateStr: string): Date | null {
  const trimmed = dateStr?.trim() ?? '';
  if (trimmed === '') {
    return null;
  }
  // European format: DD/MM/YYYY
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match || match.length < 4) {
    return null;
  }
  const day = match[1];
  const month = match[2];
  const year = match[3];
  if (!day || !month || !year) {
    return null;
  }
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1, // Month is 0-indexed
    parseInt(day, 10)
  );
  return isNaN(date.getTime()) ? null : date;
}

function parseNumber(value: string): number | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') {
    return null;
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

function parseString(value: string): string {
  return value?.trim() ?? '';
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function isValidEmail(email: string | null): boolean {
  if (email === null) {
    return false;
  }
  return EMAIL_REGEX.test(email);
}

function normalizeStatus(status: string): string {
  return status.toLowerCase().trim();
}

function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(normalizeStatus(status));
}

export async function loadLeads(filePath: string): Promise<ParseResult> {
  const content = readFileSync(filePath, 'utf-8');

  let records: readonly Record<string, string>[];
  try {
    records = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: false,
      relax_column_count: true,
    }) as readonly Record<string, string>[];
  } catch (error) {
    // If parsing fails completely, return empty result with error info
    return {
      leads: [],
      skipped: [],
      malformed: [{
        lineNumber: 1,
        rawRow: content.split('\n')[0] ?? '',
        error: error instanceof Error ? error.message : 'Unknown parse error',
      }],
      summary: {
        totalRows: 0,
        validLeads: 0,
        skippedCount: 0,
        malformedCount: 1,
        bySkipReason: {} as Record<SkipReason, number>,
      },
    };
  }

  const leads: Lead[] = [];
  const skipped: SkippedLead[] = [];
  const malformed: MalformedRow[] = [];
  const bySkipReason: Record<SkipReason, number> = {
    missing_email: 0,
    invalid_email: 0,
    inactive_status: 0,
    not_due: 0,
    invalid_date: 0,
    missing_lead_id: 0,
  };

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (!row) continue;

    try {
      const leadId = parseString(row['Lead ID'] ?? '');
      const company = parseString(row['Company'] ?? '');

      // Check for missing lead ID - skip this row
      if (leadId === '') {
        // If entire row is empty (no company either), skip silently
        if (company === '') {
          continue;
        }
        skipped.push({
          leadId: null,
          company,
          skipReason: 'missing_lead_id',
          rawRow: row,
        });
        bySkipReason.missing_lead_id++;
        continue;
      }

      const lead: Lead = {
        leadId,
        company,
        contactName: parseString(row['Contact Name'] ?? ''),
        email: nullIfEmpty(row['Email'] ?? ''),
        phone: nullIfEmpty(row['Phone'] ?? ''),
        country: parseString(row['Country'] ?? ''),
        segment: parseString(row['Segment'] ?? ''),
        serviceLine: parseString(row['Service Line'] ?? ''),
        source: parseString(row['Source'] ?? ''),
        leadScore: parseNumber(row['Lead Score'] ?? '') ?? 0,
        status: parseString(row['Status'] ?? ''),
        lastContactDate: parseDate(row['Last Contact Date'] ?? ''),
        nextFollowUpDate: parseDate(row['Next Follow-up Date'] ?? ''),
        daysToFollowUp: parseNumber(row['Days to Follow-up'] ?? ''),
        owner: parseString(row['Owner'] ?? ''),
        needPain: parseString(row['Need / Pain'] ?? ''),
        nextAction: parseString(row['Next Action'] ?? ''),
        priority: parseString(row['Priority'] ?? ''),
        lastMessageNotes: parseString(row['Last Message / Notes'] ?? ''),
        website: parseString(row['Website'] ?? ''),
        linkedIn: parseString(row['LinkedIn'] ?? ''),
      };

      leads.push(lead);
    } catch (error) {
      malformed.push({
        lineNumber: i + 2, // +2 because line 1 is header, 0-indexed
        rawRow: JSON.stringify(row),
        error: error instanceof Error ? error.message : 'Unknown error processing row',
      });
    }
  }

  return {
    leads,
    skipped,
    malformed,
    summary: {
      totalRows: records.length,
      validLeads: leads.length,
      skippedCount: skipped.length,
      malformedCount: malformed.length,
      bySkipReason,
    },
  };
}

export function filterDueLeads(leads: readonly Lead[]): DueLeadResult {
  const dueLeads: Lead[] = [];
  const skipped: SkippedLead[] = [];
  const bySkipReason: Record<SkipReason, number> = {
    missing_email: 0,
    invalid_email: 0,
    inactive_status: 0,
    not_due: 0,
    invalid_date: 0,
    missing_lead_id: 0,
  };

  for (const lead of leads) {
    // Check missing email
    if (lead.email === null) {
      skipped.push({
        leadId: lead.leadId,
        company: lead.company,
        skipReason: 'missing_email',
        rawRow: {},
      });
      bySkipReason.missing_email++;
      continue;
    }

    // Check invalid email
    if (!isValidEmail(lead.email)) {
      skipped.push({
        leadId: lead.leadId,
        company: lead.company,
        skipReason: 'invalid_email',
        rawRow: {},
      });
      bySkipReason.invalid_email++;
      continue;
    }

    // Check inactive status
    if (!isActiveStatus(lead.status)) {
      skipped.push({
        leadId: lead.leadId,
        company: lead.company,
        skipReason: 'inactive_status',
        rawRow: {},
      });
      bySkipReason.inactive_status++;
      continue;
    }

    // Check not due (daysToFollowUp > 0 or null)
    if (lead.daysToFollowUp === null || lead.daysToFollowUp > 0) {
      skipped.push({
        leadId: lead.leadId,
        company: lead.company,
        skipReason: 'not_due',
        rawRow: {},
      });
      bySkipReason.not_due++;
      continue;
    }

    // Lead is due for follow-up
    dueLeads.push(lead);
  }

  return {
    dueLeads,
    skipped,
    summary: {
      totalProcessed: leads.length,
      dueCount: dueLeads.length,
      skippedCount: skipped.length,
      bySkipReason,
    },
  };
}

// Keep existing functions for backward compatibility
export function filterValidLeads(leads: readonly Lead[]): readonly Lead[] {
  return leads.filter(lead => {
    return lead.leadId.length > 0 && lead.company.length > 0;
  });
}

export function isDueForFollowUp(lead: Lead): boolean {
  if (!lead.email) {
    return false;
  }

  if (!isValidEmail(lead.email)) {
    return false;
  }

  const normalizedStatus = lead.status.toLowerCase().trim();
  if (!ACTIVE_STATUSES.has(normalizedStatus)) {
    return false;
  }

  if (lead.daysToFollowUp === null) {
    return false;
  }

  return lead.daysToFollowUp <= 0;
}