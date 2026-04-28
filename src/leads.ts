import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import type { Lead, DueLeadCheck } from './types.ts';

const ACTIVE_STATUSES_SET = new Set([
  'New',
  'Contacted',
  'In Progress',
  'Qualified',
].map(s => s.toLowerCase().trim()));

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }
  // European format: DD/MM/YYYY
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr.trim());
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
  if (!value || value.trim() === '') {
    return null;
  }
  const num = parseFloat(value.trim());
  return isNaN(num) ? null : num;
}

function parseString(value: string): string {
  return value?.trim() ?? '';
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export async function loadLeads(filePath: string): Promise<readonly Lead[]> {
  const content = readFileSync(filePath, 'utf-8');

  const records = parse(content, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: false,
    relax_column_count: true,
  }) as readonly Record<string, string>[];

  return records.map((row): Lead => ({
    leadId: parseString(row['Lead ID'] ?? ''),
    company: parseString(row['Company'] ?? ''),
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
  }));
}

export function filterValidLeads(leads: readonly Lead[]): readonly Lead[] {
  return leads.filter(lead => {
    // Must have non-empty Lead ID and Company
    return lead.leadId.length > 0 && lead.company.length > 0;
  });
}

export function isDueForFollowUp(lead: Lead): boolean {
  // Must have email
  if (!lead.email) {
    return false;
  }

  // Must be active status
  const normalizedStatus = lead.status.toLowerCase().trim();
  if (!ACTIVE_STATUSES_SET.has(normalizedStatus)) {
    return false;
  }

  // Must be due (daysToFollowUp <= 0)
  if (lead.daysToFollowUp === null) {
    return false;
  }

  return lead.daysToFollowUp <= 0;
}

export function getDueLeads(leads: readonly Lead[]): readonly DueLeadCheck[] {
  return leads
    .filter(isDueForFollowUp)
    .map((lead): DueLeadCheck => ({
      lead,
      isDue: true,
      hasEmail: lead.email !== null,
      hasTemplate: false, // Will be set by templates module
      template: null,
      templateType: 'none',
    }));
}