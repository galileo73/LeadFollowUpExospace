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
  readonly error: string;
}

export type DraftStatus =
  | 'created'
  | 'skipped_no_template'
  | 'skipped_no_email'
  | 'failed';

export type TemplateType =
  | 'company_specific'
  | 'generic_fallback'
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

// Active lead statuses
export const ACTIVE_STATUSES: readonly string[] = [
  'New',
  'Contacted',
  'In Progress',
  'Qualified',
] as const;

// Configuration from environment
export interface Config {
  readonly tenantId: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly leadsCsvPath: string;
  readonly templatesDocxPath: string;
  readonly logPath: string;
  readonly tokenCachePath: string;
}