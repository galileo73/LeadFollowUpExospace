import { appendFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';

// Log entry for draft results
export interface DraftLogEntry {
  readonly timestamp: string;
  readonly runId: string;
  readonly leadId: string;
  readonly company: string;
  readonly email: string;
  readonly subject: string;
  readonly draftId: string;
  readonly status: DraftStatus;
  readonly templateType: TemplateType;
  readonly error: string;
}

export type DraftStatus =
  | 'created'
  | 'skipped_no_template'
  | 'skipped_no_email'
  | 'skipped_invalid_email'
  | 'skipped_inactive_status'
  | 'skipped_not_due'
  | 'failed';

export type TemplateType =
  | 'company_specific'
  | 'generic_fallback'
  | 'none';

// CSV header row
const CSV_HEADER = 'timestamp,run_id,lead_id,company,email,subject,draft_id,status,template_type,error';

/**
 * Generate a unique run ID in format YYYYMMDD-HHMMSS
 */
export function generateRunId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Get current timestamp in ISO 8601 format
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Escape a CSV value by quoting if necessary
 */
function escapeCsvValue(value: string): string {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const strValue = String(value);

  // If the value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * Convert a log entry to a CSV row
 */
function entryToCsvRow(entry: DraftLogEntry): string {
  const values = [
    escapeCsvValue(entry.timestamp),
    escapeCsvValue(entry.runId),
    escapeCsvValue(entry.leadId),
    escapeCsvValue(entry.company),
    escapeCsvValue(entry.email),
    escapeCsvValue(entry.subject),
    escapeCsvValue(entry.draftId),
    escapeCsvValue(entry.status),
    escapeCsvValue(entry.templateType),
    escapeCsvValue(entry.error),
  ];

  return values.join(',');
}

/**
 * Ensure the log directory exists
 */
function ensureLogDirectory(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Initialize the log file with headers if it doesn't exist
 */
export function initLogFile(filePath: string): void {
  try {
    ensureLogDirectory(filePath);

    if (!existsSync(filePath)) {
      writeFileSync(filePath, CSV_HEADER + '\n', 'utf-8');
    }
  } catch (error) {
    // Log initialization failure but don't crash
    console.warn(`Warning: Failed to initialize log file at ${filePath}`);
    console.warn(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Append a single log entry to the CSV file
 */
export function appendLogEntry(filePath: string, entry: DraftLogEntry): void {
  try {
    ensureLogDirectory(filePath);

    // Initialize file if it doesn't exist
    if (!existsSync(filePath)) {
      writeFileSync(filePath, CSV_HEADER + '\n', 'utf-8');
    }

    const row = entryToCsvRow(entry);
    appendFileSync(filePath, row + '\n', 'utf-8');
  } catch (error) {
    // Log failure but don't crash
    console.warn(`Warning: Failed to append log entry for ${entry.leadId}`);
    console.warn(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Append multiple log entries to the CSV file
 */
export function appendLogBatch(filePath: string, entries: readonly DraftLogEntry[]): void {
  try {
    ensureLogDirectory(filePath);

    // Initialize file if it doesn't exist
    if (!existsSync(filePath)) {
      writeFileSync(filePath, CSV_HEADER + '\n', 'utf-8');
    }

    const rows = entries.map(entryToCsvRow);
    const content = rows.join('\n') + '\n';
    appendFileSync(filePath, content, 'utf-8');
  } catch (error) {
    // Log failure but don't crash
    console.warn('Warning: Failed to append log batch');
    console.warn(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Create a log entry for a created draft
 */
export function createDraftLogEntry(
  runId: string,
  leadId: string,
  company: string,
  email: string,
  subject: string,
  draftId: string,
  templateType: TemplateType
): DraftLogEntry {
  return {
    timestamp: getTimestamp(),
    runId,
    leadId,
    company,
    email,
    subject,
    draftId,
    status: 'created',
    templateType,
    error: '',
  };
}

/**
 * Create a log entry for a skipped lead
 */
export function createSkippedLogEntry(
  runId: string,
  leadId: string,
  company: string,
  email: string,
  reason: DraftStatus,
  templateType: TemplateType
): DraftLogEntry {
  return {
    timestamp: getTimestamp(),
    runId,
    leadId,
    company,
    email,
    subject: '',
    draftId: '',
    status: reason,
    templateType,
    error: '',
  };
}

/**
 * Create a log entry for a failed draft
 */
export function createFailedLogEntry(
  runId: string,
  leadId: string,
  company: string,
  email: string,
  subject: string,
  templateType: TemplateType,
  error: string
): DraftLogEntry {
  return {
    timestamp: getTimestamp(),
    runId,
    leadId,
    company,
    email,
    subject,
    draftId: '',
    status: 'failed',
    templateType,
    error,
  };
}

/**
 * Get the default log file path
 */
export function getDefaultLogPath(): string {
  return resolve(process.cwd(), 'logs', 'drafts.csv');
}

/**
 * Read log entries from file (for testing/verification)
 */
export function readLogEntries(filePath: string): DraftLogEntry[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  // Skip header
  if (lines.length <= 1) {
    return [];
  }

  const entries: DraftLogEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    // Parse CSV line (handle quoted values)
    const values = parseCsvLine(line);

    if (values.length >= 10) {
      entries.push({
        timestamp: values[0] ?? '',
        runId: values[1] ?? '',
        leadId: values[2] ?? '',
        company: values[3] ?? '',
        email: values[4] ?? '',
        subject: values[5] ?? '',
        draftId: values[6] ?? '',
        status: values[7] as DraftStatus ?? 'failed',
        templateType: values[8] as TemplateType ?? 'none',
        error: values[9] ?? '',
      });
    }
  }

  return entries;
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}