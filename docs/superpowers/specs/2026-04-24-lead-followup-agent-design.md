# Lead Follow-Up Agent Design

**Date**: 2026-04-24
**Project**: lead-followup-agent
**Status**: Approved for implementation

## Overview

A Node.js + TypeScript CLI agent that automates lead follow-up email drafting for Exospace. The agent loads leads from a CSV file, identifies those due for follow-up, matches company-specific email templates, and creates Outlook draft emails via Microsoft Graph API. Drafts are never sent automatically—they remain in Outlook for manual review and sending.

## Architecture

```
src/
├── index.ts      # Orchestrator: config → leads → templates → dry-run → confirm → drafts → log
├── auth.ts       # MSAL Node Device Code Flow, token cache
├── leads.ts      # CSV parsing, due lead filtering
├── templates.ts  # .docx parsing, company matching, generic fallback
├── drafts.ts     # Microsoft Graph API draft creation
├── log.ts        # CSV logging of draft results
└── types.ts      # Shared TypeScript interfaces
```

### Data Flow

```
CSV leads ──► leads.ts ──► filtered due leads
                              │
.docx templates ──► templates.ts ──► matched templates
                              │
                           index.ts
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Dry-run display    User confirmation
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    auth.ts (Graph token)
                              │
                              ▼
                    drafts.ts (create drafts)
                              │
                              ▼
                    log.ts (CSV append)
```

## Types

### Lead

```typescript
interface Lead {
  leadId: string;
  company: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  country: string;
  segment: string;
  serviceLine: string;
  source: string;
  leadScore: number;
  status: string;
  lastContactDate: Date | null;
  nextFollowUpDate: Date | null;
  daysToFollowUp: number | null;
  owner: string;
  needPain: string;
  nextAction: string;
  priority: string;
  lastMessageNotes: string;
  website: string;
  linkedIn: string;
}
```

### EmailTemplate

```typescript
interface EmailTemplate {
  company: string;
  subject: string;
  body: string;
}
```

### DraftLogEntry

```typescript
interface DraftLogEntry {
  timestamp: string;
  runId: string;
  leadId: string;
  company: string;
  email: string;
  subject: string;
  draftId: string;
  status: 'created' | 'skipped_no_template' | 'skipped_no_email' | 'failed';
  templateType: 'company_specific' | 'generic_fallback';
  error: string;
}
```

### DueLeadCheck

```typescript
interface DueLeadCheck {
  lead: Lead;
  isDue: boolean;
  hasEmail: boolean;
  hasTemplate: boolean;
  template: EmailTemplate | null;
  templateType: 'company_specific' | 'generic_fallback' | 'none';
  skipReason?: string;
}
```

## Configuration

### .env.example

```bash
# Azure AD App Registration (Delegated/User auth)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id

# Microsoft Graph scopes (delegated)
GRAPH_SCOPES=Mail.ReadWrite,offline_access

# Paths (optional, defaults shown)
LEADS_CSV_PATH=lead_db/Exospace_lead_tracker_v1.1.csv
TEMPLATES_DOCX_PATH=lead_db/template_answer_leads.docx
TOKEN_CACHE_PATH=.cache/msal-tokens.json
LOG_PATH=logs/drafts.csv
```

### .gitignore

```
.env
.cache/
logs/
node_modules/
dist/
```

## Module Specifications

### auth.ts

**Responsibilities**:
- Initialize MSAL PublicClientApplication (delegated flow, no client secret)
- Implement Device Code Flow for first-time authentication
- Cache tokens to `.cache/msal-tokens.json`
- Return valid access token (from cache or refresh)
- Handle token expiration automatically

**Functions**:
```typescript
function createMsalClient(): PublicClientApplication;
async function getAccessToken(client: PublicClientApplication): Promise<string>;
async function authenticateWithDeviceCode(client: PublicClientApplication): Promise<AuthenticationResult>;
function loadTokenCache(): SerializedCache | null;
function saveTokenCache(cache: SerializedCache): void;
```

**Behavior**:
- Load `CLIENT_ID`, `TENANT_ID`, `GRAPH_SCOPES` from `.env`
- Create `.cache/` directory automatically if missing
- If cache missing/corrupted/expired, trigger Device Code Flow
- Display URL and code, wait for user to complete browser auth
- On auth failure, show clear error and exit safely
- Never store tokens in `.env`

### leads.ts

**Responsibilities**:
- Parse CSV with semicolon delimiter
- Handle European date format (DD/MM/YYYY)
- Filter to valid, non-empty rows
- Identify leads due for follow-up

**Functions**:
```typescript
async function loadLeads(filePath: string): Promise<Lead[]>;
function filterValidLeads(leads: Lead[]): Lead[];
function isDueForFollowUp(lead: Lead): boolean;
function getDueLeads(leads: Lead[]): DueLeadCheck[];
```

**CSV Parsing**:
- Delimiter: semicolon `;`
- Date format: DD/MM/YYYY → Date object
- Empty strings → `null`
- Skip rows where `Lead ID` is empty

**Due Criteria**:
- `Days to Follow-up <= 0`
- `Status` is active (New, Contacted, In Progress, Qualified)
- `Email` is present and valid

**Normalization**:
- Trim spaces from status values
- Case-insensitive status comparison
- Trim spaces from company names

**Error Handling**:
- Invalid date: mark as not eligible, show in dry-run
- Invalid rows: skip, don't crash
- Continue with valid rows even if some are malformed

### templates.ts

**Responsibilities**:
- Parse `.docx` to extract company-specific templates
- Match templates by company name (case-insensitive, trimmed)
- Provide generic fallback template
- Support placeholder substitution

**Functions**:
```typescript
async function loadTemplates(filePath: string): Promise<EmailTemplate[]>;
function findTemplate(templates: EmailTemplate[], company: string): EmailTemplate | null;
function getGenericTemplate(lead: Lead): EmailTemplate;
function isGenericTemplate(template: EmailTemplate): boolean;
function populateTemplate(template: EmailTemplate, lead: Lead): EmailTemplate;
```

**Parsing Approach**:
1. Use reliable library (e.g., `mammoth`) to extract text from `.docx`
2. Split by company headers (detected from CSV company names or pattern)
3. Extract subject line (line starting with "Subject:")
4. Rest of section = body

**Company Matching**:
- Normalize company names: trim, collapse multiple spaces
- Case-insensitive comparison
- Exact normalized match for v1
- Code structure ready for alias mapping later

**Generic Fallback Template**:
```
Subject: Following up on ExoSpace introduction

Good afternoon{ContactName},

I hope you are well.

I am following up on my previous email regarding ExoSpace Engineering & Consulting s.r.o. and our potential support for {Company} activities.

I would be glad to understand whether a short introductory call could be of interest.

Kind regards,
{OwnerName}
```

**Placeholders**:
- `{ContactName}` - If missing, omit from greeting
- `{Company}` - Company name
- `{OwnerName}` - Lead owner

**Error Handling**:
- File not found: warning, use generic for all
- Parse error: warning, use generic for all
- Never block draft creation due to missing company template

### drafts.ts

**Responsibilities**:
- Create Microsoft Graph client
- Create draft emails via `POST /me/messages`
- Handle rate limiting and errors
- Never send emails

**Functions**:
```typescript
function createGraphClient(accessToken: string): Client;
async function createDraft(client: Client, toEmail: string, subject: string, body: string): Promise<string>;
async function createDraftsBatch(client: Client, requests: DraftRequest[]): Promise<DraftResult[]>;
```

**Types**:
```typescript
interface DraftRequest {
  lead: Lead;
  template: EmailTemplate;
}

interface DraftResult {
  leadId: string;
  company: string;
  email: string;
  subject: string;
  draftId: string | null;
  success: boolean;
  error?: string;
}
```

**Graph API**:
```http
POST /me/messages
Content-Type: application/json

{
  "subject": "...",
  "body": { "contentType": "Text", "content": "..." },
  "toRecipients": [{ "emailAddress": { "address": "..." } }]
}
```

**Error Handling**:
- Validate email before API call
- Skip invalid/missing email, include reason in result
- Sequential or low-concurrency batch to avoid rate limits
- Retry 429/temporary errors with exponential backoff
- Don't retry permanent errors (invalid recipient, permission denied)
- Auth/permission error: stop safely, show clear message

**Safety Guarantees**:
- Never use `/sendMail` endpoint
- Never call `send` on drafts
- All messages remain in Outlook Drafts folder
- User must manually review and send

### log.ts

**Responsibilities**:
- Initialize log CSV with headers
- Append draft entries
- Handle write errors gracefully

**Functions**:
```typescript
async function initLogFile(filePath: string): Promise<void>;
async function appendLogEntry(filePath: string, entry: DraftLogEntry): Promise<void>;
async function appendLogBatch(filePath: string, entries: DraftLogEntry[]): Promise<void>;
function getLogFilePath(): string;
function generateRunId(): string;
```

**Log Format**: `logs/drafts.csv`

```csv
timestamp,run_id,lead_id,company,email,subject,draft_id,status,template_type,error
2026-04-24T14:30:00Z,20260424-143000,L-001,ClearSpace,nicolas.croisard@clearspace.today,Following up on...,AAMkAG...,created,company_specific,
```

**Columns**:
- `timestamp` - ISO 8601 format
- `run_id` - Groups all entries from same run
- `lead_id` - Lead ID from CSV
- `company` - Company name
- `email` - Recipient email
- `subject` - Email subject
- `draft_id` - Graph API draft ID (or `N/A`)
- `status` - `created`, `skipped_no_template`, `skipped_no_email`, `failed`
- `template_type` - `company_specific` or `generic_fallback`
- `error` - Error message (empty if success)

**Error Handling**:
- Create `logs/` directory automatically
- Create file with headers if missing
- Escape CSV values properly
- Append-only, never overwrite
- If logging fails: warning, don't crash run
- Never log access tokens or sensitive auth data

### signature.ts

**Responsibilities**:
- Load HTML signature from file
- Convert local image paths to CID (Content-ID) references for inline images
- Load logo as base64 attachment for Microsoft Graph inline attachments
- Append signature to email body
- Convert plain text to HTML body

**Functions**:
```typescript
function isSignatureEnabled(envValue: string | undefined): boolean;
async function loadSignatureHtml(filePath: string): Promise<string | null>;
function textToHtmlBody(text: string): string;
function appendSignatureToBody(bodyHtml: string, signatureHtml: string | null): string;
async function loadInlineLogoAttachment(logoPath: string, contentId: string): Promise<InlineAttachment | null>;
function getSignatureConfig(): SignatureConfig;
async function loadSignature(config: SignatureConfig): Promise<SignatureResult>;
async function prepareEmailBody(textBody: string, config: SignatureConfig): Promise<PrepareResult>;
```

**Types**:
```typescript
interface SignatureConfig {
  enabled: boolean;
  htmlPath: string;
  logoPath: string;
  logoContentId: string;
}

interface InlineAttachment {
  '@odata.type': '#microsoft.graph.fileAttachment';
  name: string;
  contentType: string;
  isInline: boolean;
  contentId: string;
  contentBytes: string;
}
```

**Signature Handling**:
- If `SIGNATURE_ENABLED=false` (default), skip signature entirely
- Load HTML signature from configured path
- Replace local image paths (e.g., `Exospace_file/image001.png`) with CID references (`cid:exospace-logo`)
- Load logo as base64 for inline attachment via Microsoft Graph API

**Image CID Conversion**:
- Original: `src="Exospace_file/image001.png"`
- Converted: `src="cid:exospace-logo"`
- The inline attachment includes `contentId: "exospace-logo"` for linking

**Error Handling**:
- Signature disabled: continue without signature
- Signature file missing: warn and continue with text-only email
- Logo file missing: warn and continue with text signature (no inline logo)
- Never crash the run due to signature issues

**Environment Variables**:
- `SIGNATURE_ENABLED` - Set to `true` to enable (default: `false`)
- `SIGNATURE_HTML_PATH` - Path to signature HTML file
- `SIGNATURE_LOGO_PATH` - Path to logo image file
- `SIGNATURE_LOGO_CONTENT_ID` - CID for inline image (default: `exospace-logo`)

### index.ts (Orchestrator)

**Execution Flow**:
1. Load `.env` and validate required vars
2. Generate `run_id`
3. Load leads from CSV
4. Identify due leads
5. If no leads due: show message, exit cleanly (no auth needed)
6. Load templates from `.docx`
7. Prepare dry-run summary
8. Display dry-run to user
9. Prompt for confirmation
10. If declined or no input: cancel, exit cleanly
11. Authenticate (Device Code Flow if needed)
12. Create drafts via Graph API
13. Log all results
14. Display final summary

**Dry-Run Display**:
```
┌─────────────────────────────────────────────────────────────┐
│ DRY-RUN SUMMARY                                             │
├─────────────────────────────────────────────────────────────┤
│ Total rows loaded:      200                                  │
│ Valid leads:            3                                    │
│ Due for follow-up:      3                                    │
├─────────────────────────────────────────────────────────────┤
│ LEADS READY FOR DRAFT:                                       │
│                                                             │
│ L-001 | ClearSpace | nicolas.croisard@clearspace.today      │
│   Template: company-specific                                │
│   Subject: Following up on ExoSpace introduction            │
│   Preview: Good afternoon Mr. Croisard, I hope you are...   │
│                                                             │
│ L-002 | UnknownCorp | contact@unknown.com                   │
│   Template: generic_fallback                                │
│   Subject: Following up on ExoSpace introduction            │
│   Preview: Good afternoon, I hope you are well...          │
├─────────────────────────────────────────────────────────────┤
│ SKIPPED LEADS:                                              │
│   L-004 | MissingEmail Corp | no email                      │
│     Reason: missing_email                                   │
├─────────────────────────────────────────────────────────────┤
│ Run ID: 20260424-143000                                      │
└─────────────────────────────────────────────────────────────┘

Create 2 draft(s)? [y/N]
```

**Final Summary**:
```
┌─────────────────────────────────────────────────────────────┐
│ RESULTS                                                     │
├─────────────────────────────────────────────────────────────┤
│ Drafts created:  2                                          │
│ Skipped:         1                                          │
│ Failed:          0                                          │
│ Logged to:       logs/drafts.csv                            │
└─────────────────────────────────────────────────────────────┘
```

**Confirmation**:
- Default: No (only proceed on explicit `y` or `yes`)
- Case-insensitive input acceptance

**Error Handling**:
- Missing `.env`: show setup instructions, exit
- Missing env vars: list which ones, exit
- No leads due: exit cleanly without auth
- User cancels: show "Cancelled", exit cleanly
- Partial failures: show counts with reasons

## Dependencies

### Production
- `@azure/msal-node` - Authentication
- `@microsoft/microsoft-graph-client` - Graph API
- `dotenv` - Environment variables
- `csv-parse` - CSV parsing
- `zod` - Runtime validation (optional)
- `mammoth` - .docx text extraction

### Development
- `typescript`
- `tsx` - Run TypeScript directly
- `@types/node`
- `@types/express` (if using express later)

## Out of Scope for v1

- Automatic email sending
- Bulk send functionality
- Webhook/email trigger integration
- Scheduled/cron execution
- Alias mapping for company names
- HTML email bodies
- Attachment support
- Database storage (SQLite, etc.)
- Web UI

## Security Considerations

- Tokens cached locally in gitignored directory
- No client secret in public client flow
- `.env` never committed
- Drafts only, no auto-send
- User explicitly confirms each batch
- No sensitive data logged (no tokens, only draft metadata)