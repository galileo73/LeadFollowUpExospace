// Agent mode: follow-up (existing workflow) or outreach (first contact with presentation)
export type Mode = 'follow-up' | 'outreach';

// Lead data structure from CSV
export interface Lead {
  readonly leadId: string;
  readonly company: string;
  readonly contactName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly country: string;
  readonly segment: string;
  readonly serviceLine: string;
  readonly source: string;
  readonly leadScore: number;
  readonly status: string;
  readonly lastContactDate: Date | null;
  readonly nextFollowUpDate: Date | null;
  readonly daysToFollowUp: number | null;
  readonly owner: string;
  readonly needPain: string;
  readonly nextAction: string;
  readonly priority: string;
  readonly lastMessageNotes: string;
  readonly website: string;
  readonly linkedIn: string;
}

// Email template extracted from .docx
export interface EmailTemplate {
  readonly company: string;
  readonly subject: string;
  readonly body: string;
}

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
  readonly mode: Mode;
  readonly attachmentName?: string;
  readonly attachmentSize?: number;
  readonly error: string;
}

export type DraftStatus =
  | 'created'
  | 'skipped_no_template'
  | 'skipped_no_email'
  | 'skipped_invalid_email'
  | 'skipped_inactive_status'
  | 'skipped_not_due'
  | 'skipped_attachment_too_large'
  | 'skipped_presentation_not_found'
  | 'failed';

export type TemplateType =
  | 'company_specific'
  | 'generic_fallback'
  | 'outreach'
  | 'none';

// Due lead check result
export interface DueLeadCheck {
  readonly lead: Lead;
  readonly isDue: boolean;
  readonly hasEmail: boolean;
  readonly hasTemplate: boolean;
  readonly template: EmailTemplate | null;
  readonly templateType: TemplateType;
  readonly skipReason?: string;
}

// Draft request for batch processing
export interface DraftRequest {
  readonly lead: Lead;
  readonly template: EmailTemplate;
}

// Draft result from Graph API
export interface DraftResult {
  readonly leadId: string;
  readonly company: string;
  readonly email: string;
  readonly subject: string;
  readonly draftId: string | null;
  readonly success: boolean;
  readonly error?: string;
}

// Active lead statuses for follow-up mode (all active leads)
export const ACTIVE_STATUSES: readonly string[] = [
  'New',
  'Contacted',
  'In Progress',
  'Qualified',
] as const;

// Active lead statuses for outreach mode (new leads that haven't been contacted yet)
export const OUTREACH_STATUSES: readonly string[] = [
  'New',
  'Qualified',
] as const;

// Maximum attachment size (3 MB - Graph API limit for simple upload)
export const MAX_ATTACHMENT_SIZE_BYTES = 3 * 1024 * 1024;

// Configuration from environment
export interface Config {
  readonly tenantId: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly mode: Mode;
  readonly leadsCsvPath: string;
  readonly templatesDocxPath: string;
  readonly outreachTemplatePath: string;
  readonly presentationPath: string;
  readonly logPath: string;
  readonly tokenCachePath: string;
}