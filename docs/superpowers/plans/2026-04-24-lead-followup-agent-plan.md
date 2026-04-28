# Lead Follow-Up Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js + TypeScript CLI agent that creates Outlook draft emails for leads due for follow-up, using Microsoft Graph API and MSAL Device Code Flow authentication.

**Architecture:** Minimal modular design with 8 files: types.ts (shared interfaces), auth.ts (MSAL), leads.ts (CSV parsing), templates.ts (.docx parsing), signature.ts (HTML signature with inline logo), drafts.ts (Graph API), log.ts (CSV logging), index.ts (orchestrator). Dry-run confirmation workflow before any API calls.

**Tech Stack:** Node.js, TypeScript, @azure/msal-node, @microsoft/microsoft-graph-client, csv-parse, mammoth, dotenv

---

## Implementation Phases

| Phase | Description | Milestone |
|-------|-------------|-----------|
| Phase 1 | Project setup, types, config | Project compiles, types validated |
| Phase 2 | CSV parsing & lead filtering | Can load and filter leads from CSV |
| Phase 3 | Template parsing | Can extract templates from .docx |
| Phase 4 | Logging module | Can write to CSV log file |
| Phase 4.5 | Email signature support | Can add HTML signature with inline logo |
| Phase 5 | Authentication | Can authenticate via Device Code Flow |
| Phase 6 | Draft creation | Can create Outlook drafts via Graph API |
| Phase 7 | Orchestrator + CLI | Full dry-run → confirm → draft workflow |

---

## File Structure

```
src/
├── index.ts      # Orchestrator entry point
├── types.ts      # Shared TypeScript interfaces
├── config.ts     # Environment config loader
├── auth.ts       # MSAL Device Code Flow + token cache
├── leads.ts      # CSV parsing, due lead filtering
├── templates.ts  # .docx parsing, company matching
├── signature.ts  # HTML signature with inline logo
├── drafts.ts     # Microsoft Graph draft creation
└── log.ts        # CSV logging
tests/
├── leads.test.ts
├── templates.test.ts
├── signature.test.ts
├── log.test.ts
└── fixtures/
    └── sample-leads.csv
```

---

## Phase 1: Project Setup, Types, Config

### Task 1.1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add mammoth dependency**

```bash
cd "C:\Users\rossi\Claude_Projects\lead-followup-agent\LeadFollowUpExospace"
npm install mammoth
npm install -D @types/mammoth
```

Expected: `mammoth` added to dependencies

- [ ] **Step 2: Verify package.json dependencies**

Run: `cat package.json | grep -A 20 '"dependencies"'`

Expected output should include:
```json
"dependencies": {
  "@azure/msal-node": "^5.1.4",
  "@microsoft/microsoft-graph-client": "^3.0.7",
  "csv-parse": "^6.2.1",
  "dotenv": "^17.4.2",
  "express": "^5.2.1",
  "isomorphic-fetch": "^3.0.0",
  "mammoth": "^1.x.x",
  "zod": "^4.3.6"
}
```

- [ ] **Step 3: Commit dependency addition**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: add mammoth for .docx parsing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Update package.json Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts to package.json**

Edit `package.json` to replace the scripts section:

```json
"scripts": {
  "start": "tsx src/index.ts",
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "test": "node --import tsx --test tests/**/*.test.ts",
  "test:watch": "node --import tsx --test --watch tests/**/*.test.ts",
  "lint": "tsc --noEmit"
}
```

- [ ] **Step 2: Verify scripts**

Run: `npm run lint`

Expected: No output (tsc passes with no errors since no source files yet)

- [ ] **Step 3: Commit scripts**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: add npm scripts for start, dev, build, test, lint

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Create .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Write .gitignore file**

```gitignore
# Environment
.env
.env.local

# Dependencies
node_modules/

# Build output
dist/

# Token cache
.cache/

# Logs
logs/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Verify .gitignore**

Run: `cat .gitignore`

Expected: File contents displayed

- [ ] **Step 3: Commit .gitignore**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: add .gitignore for env, cache, logs, build

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Create .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write .env.example file**

```bash
# Azure AD App Registration (Delegated/User auth)
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here

# Microsoft Graph scopes (delegated)
GRAPH_SCOPES=Mail.ReadWrite,offline_access

# Paths (optional, defaults shown)
LEADS_CSV_PATH=lead_db/Exospace_lead_tracker_v1.1.csv
TEMPLATES_DOCX_PATH=lead_db/template_answer_leads.docx
TOKEN_CACHE_PATH=.cache/msal-tokens.json
LOG_PATH=logs/drafts.csv
```

- [ ] **Step 2: Verify .env.example**

Run: `cat .env.example`

Expected: File contents displayed

- [ ] **Step 3: Commit .env.example**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
chore: add .env.example with required config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Create src/types.ts

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src directory**

```bash
mkdir -p "C:\Users\rossi\Claude_Projects\lead-followup-agent\LeadFollowUpExospace\src"
```

- [ ] **Step 2: Write types.ts**

```typescript
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
```

- [ ] **Step 3: Run lint to verify types**

Run: `npm run lint`

Expected: No errors

- [ ] **Step 4: Commit types.ts**

```bash
git add src/types.ts
git commit -m "$(cat <<'EOF'
feat: add TypeScript interfaces for Lead, Template, Log, Config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.6: Create src/config.ts

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Write config.ts**

```typescript
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Config } from './types.ts';

// Load .env file
config();

const requiredEnvVars = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
] as const;

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvArray(name: string, defaultValue: string): readonly string[] {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue.split(',').map(s => s.trim());
  }
  return value.split(',').map(s => s.trim());
}

export function loadConfig(): Config {
  // Check for .env file
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    console.error('Warning: .env file not found. Using environment variables.');
  }

  // Validate required vars
  const missing = requiredEnvVars.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease create a .env file based on .env.example`);
  }

  return {
    tenantId: getEnv('AZURE_TENANT_ID'),
    clientId: getEnv('AZURE_CLIENT_ID'),
    scopes: getEnvArray('GRAPH_SCOPES', 'Mail.ReadWrite,offline_access'),
    leadsCsvPath: getEnv('LEADS_CSV_PATH', 'lead_db/Exospace_lead_tracker_v1.1.csv'),
    templatesDocxPath: getEnv('TEMPLATES_DOCX_PATH', 'lead_db/template_answer_leads.docx'),
    logPath: getEnv('LOG_PATH', 'logs/drafts.csv'),
    tokenCachePath: getEnv('TOKEN_CACHE_PATH', '.cache/msal-tokens.json'),
  };
}

export function validateConfig(config: Config): void {
  if (!config.tenantId || config.tenantId === 'your-tenant-id-here') {
    throw new Error('AZURE_TENANT_ID is not configured. Please update your .env file.');
  }
  if (!config.clientId || config.clientId === 'your-client-id-here') {
    throw new Error('AZURE_CLIENT_ID is not configured. Please update your .env file.');
  }
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No errors

- [ ] **Step 3: Commit config.ts**

```bash
git add src/config.ts
git commit -m "$(cat <<'EOF'
feat: add config loader with env validation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: CSV Parsing & Lead Filtering

### Task 2.1: Create test fixtures

**Files:**
- Create: `tests/fixtures/sample-leads.csv`

- [ ] **Step 1: Create tests directory structure**

```bash
mkdir -p "C:\Users\rossi\Claude_Projects\lead-followup-agent\LeadFollowUpExospace\tests\fixtures"
```

- [ ] **Step 2: Write sample-leads.csv**

```csv
Lead ID;Company;Contact Name;Role;Email;Phone;Country;Segment;Service Line;Source;Lead Score;Status;Last Contact Date;Next Follow-up Date;Days to Follow-up;Owner;Need / Pain;Next Action;Offer Value (€);Probability %;Weighted Pipeline (€);Meeting Booked;Proposal Sent;Last Message / Notes;Website;LinkedIn;Priority
L-001;ClearSpace;Nicolas Croisard;CEO;nicolas.croisard@clearspace.today;;Switzerland;Space;Engineering;Direct;70;Contacted;09/04/2026;15/04/2026;-9;Gianluigi Rossi;Need for systems engineering;Send follow-up;;20%;;No;No;Intro sent;https://clearspace.today;;A
L-002;Reflex Aerospace;Mr. Motzki;CTO;motzki@reflexaerospace.com;;Germany;Space;Engineering;Direct;80;Contacted;10/04/2026;20/04/2026;-4;Gianluigi Rossi;Validation support;Follow up;;30%;;No;No;Intro sent;https://reflexaerospace.com;;B
L-003;NoEmail Corp;John Doe;Manager;;;USA;Tech;Consulting;Web;50;New;01/04/2026;25/04/2026;1;Gianluigi Rossi;Consulting;Call;;;No;No;New lead;;;
L-004;Future Lead;Jane Smith;Director;jane@future.com;;UK;Space;Engineering;Referral;60;New;01/05/2026;15/05/2026;21;Gianluigi Rossi;Potential project;Wait;;10%;;No;No;Referred;;;
L-005;Closed Corp;Bob Wilson;CEO;bob@closed.com;;France;Defence;Systems;Event;40;Closed Won;01/03/2026;01/03/2026;54;Gianluigi Rossi;Won contract;None;;100%;;Yes;Yes;Contract signed;;;
```

- [ ] **Step 3: Commit test fixture**

```bash
git add tests/fixtures/sample-leads.csv
git commit -m "$(cat <<'EOF'
test: add sample leads CSV fixture

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Write leads.test.ts

**Files:**
- Create: `tests/leads.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, assert } from 'node:test';
import { resolve } from 'path';
import { loadLeads, filterValidLeads, isDueForFollowUp, getDueLeads } from '../src/leads.ts';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with "Cannot find module '../src/leads.ts'"

- [ ] **Step 3: Commit test file**

```bash
git add tests/leads.test.ts
git commit -m "$(cat <<'EOF'
test: add leads module tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Implement leads.ts

**Files:**
- Create: `src/leads.ts`

- [ ] **Step 1: Write leads.ts implementation**

```typescript
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import type { Lead, DueLeadCheck, ACTIVE_STATUSES } from './types.ts';

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
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 3: Commit leads.ts**

```bash
git add src/leads.ts
git commit -m "$(cat <<'EOF'
feat: implement CSV lead parsing with European date format

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Template Parsing

### Task 3.1: Write templates.test.ts

**Files:**
- Create: `tests/templates.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, assert } from 'node:test';
import { resolve } from 'path';
import {
  loadTemplates,
  findTemplate,
  getGenericTemplate,
  isGenericTemplate,
  populateTemplate,
  normalizeCompanyName,
} from '../src/templates.ts';
import type { Lead } from '../src/types.ts';

const docxPath = resolve(import.meta.dirname, '../lead_db/template_answer_leads.docx');

// Sample lead for testing
const sampleLead: Lead = {
  leadId: 'L-001',
  company: 'ClearSpace',
  contactName: 'Nicolas Croisard',
  email: 'nicolas.croisard@clearspace.today',
  phone: null,
  country: 'Switzerland',
  segment: 'Space',
  serviceLine: 'Engineering',
  source: 'Direct',
  leadScore: 70,
  status: 'Contacted',
  lastContactDate: new Date(2026, 3, 9),
  nextFollowUpDate: new Date(2026, 3, 15),
  daysToFollowUp: -9,
  owner: 'Gianluigi Rossi',
  needPain: 'Need for systems engineering',
  nextAction: 'Send follow-up',
  priority: 'A',
  lastMessageNotes: 'Intro sent',
  website: 'https://clearspace.today',
  linkedIn: '',
};

describe('templates', () => {
  describe('normalizeCompanyName', () => {
    it('should trim spaces', () => {
      assert.strictEqual(normalizeCompanyName('  ClearSpace  '), 'clearspace');
    });

    it('should collapse multiple spaces', () => {
      assert.strictEqual(normalizeCompanyName('Clear   Space'), 'clear space');
    });

    it('should convert to lowercase', () => {
      assert.strictEqual(normalizeCompanyName('CLEARSPACE'), 'clearspace');
    });
  });

  describe('loadTemplates', () => {
    it('should load templates from .docx file', async () => {
      const templates = await loadTemplates(docxPath);
      assert.ok(templates.length > 0, 'Should load at least one template');
    });

    it('should extract ClearSpace template', async () => {
      const templates = await loadTemplates(docxPath);
      const clearSpace = templates.find(t => normalizeCompanyName(t.company) === 'clearspace');
      assert.ok(clearSpace, 'Should find ClearSpace template');
      assert.ok(clearSpace?.subject.length > 0, 'Should have subject');
      assert.ok(clearSpace?.body.length > 0, 'Should have body');
    });

    it('should extract subject line correctly', async () => {
      const templates = await loadTemplates(docxPath);
      const clearSpace = templates.find(t => normalizeCompanyName(t.company) === 'clearspace');
      assert.ok(clearSpace?.subject.toLowerCase().includes('following up'));
    });
  });

  describe('findTemplate', () => {
    it('should find template by exact company name', async () => {
      const templates = await loadTemplates(docxPath);
      const found = findTemplate(templates, 'ClearSpace');
      assert.ok(found, 'Should find ClearSpace template');
    });

    it('should find template case-insensitively', async () => {
      const templates = await loadTemplates(docxPath);
      const found = findTemplate(templates, 'clearspace');
      assert.ok(found, 'Should find template regardless of case');
    });

    it('should find template with trimmed spaces', async () => {
      const templates = await loadTemplates(docxPath);
      const found = findTemplate(templates, '  ClearSpace  ');
      assert.ok(found, 'Should find template with trimmed input');
    });

    it('should return null for unknown company', async () => {
      const templates = await loadTemplates(docxPath);
      const found = findTemplate(templates, 'Unknown Company XYZ');
      assert.strictEqual(found, null);
    });
  });

  describe('getGenericTemplate', () => {
    it('should return a template with subject', () => {
      const template = getGenericTemplate(sampleLead);
      assert.ok(template.subject.length > 0);
    });

    it('should return a template with body', () => {
      const template = getGenericTemplate(sampleLead);
      assert.ok(template.body.length > 0);
    });

    it('should mark company as generic', () => {
      const template = getGenericTemplate(sampleLead);
      assert.strictEqual(template.company, '__generic__');
    });
  });

  describe('isGenericTemplate', () => {
    it('should return true for generic template', () => {
      const template = getGenericTemplate(sampleLead);
      assert.strictEqual(isGenericTemplate(template), true);
    });

    it('should return false for company-specific template', async () => {
      const templates = await loadTemplates(docxPath);
      const clearSpace = findTemplate(templates, 'ClearSpace');
      assert.strictEqual(isGenericTemplate(clearSpace!), false);
    });
  });

  describe('populateTemplate', () => {
    it('should replace {Company} placeholder', () => {
      const template = getGenericTemplate(sampleLead);
      const populated = populateTemplate(template, sampleLead);
      assert.ok(populated.body.includes('ClearSpace'));
    });

    it('should replace {ContactName} placeholder', () => {
      const template = getGenericTemplate(sampleLead);
      const populated = populateTemplate(template, sampleLead);
      assert.ok(populated.body.includes('Nicolas Croisard'));
    });

    it('should replace {OwnerName} placeholder', () => {
      const template = getGenericTemplate(sampleLead);
      const populated = populateTemplate(template, sampleLead);
      assert.ok(populated.body.includes('Gianluigi Rossi'));
    });

    it('should handle missing contact name gracefully', () => {
      const leadNoName = { ...sampleLead, contactName: '' };
      const template = getGenericTemplate(leadNoName);
      const populated = populateTemplate(template, leadNoName);
      // Should not have dangling comma or awkward spacing
      assert.ok(!populated.body.includes(' ,'));
      assert.ok(!populated.body.includes(', ,'));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with "Cannot find module '../src/templates.ts'"

- [ ] **Step 3: Commit test file**

```bash
git add tests/templates.test.ts
git commit -m "$(cat <<'EOF'
test: add templates module tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Implement templates.ts

**Files:**
- Create: `src/templates.ts`

- [ ] **Step 1: Write templates.ts implementation**

```typescript
import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import type { EmailTemplate, Lead } from './types.ts';

const GENERIC_TEMPLATE_COMPANY = '__generic__';

const GENERIC_TEMPLATE_SUBJECT = 'Following up on ExoSpace introduction';

const GENERIC_TEMPLATE_BODY = `Good afternoon{ContactName},

I hope you are well.

I am following up on my previous email regarding ExoSpace Engineering & Consulting s.r.o. and our potential support for {Company} activities.

I would be glad to understand whether a short introductory call could be of interest.

Kind regards,
{OwnerName}`;

export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

export async function loadTemplates(filePath: string): Promise<readonly EmailTemplate[]> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    return parseTemplatesFromText(text);
  } catch (error) {
    console.error(`Warning: Could not load templates from ${filePath}:`, error);
    return [];
  }
}

function parseTemplatesFromText(text: string): EmailTemplate[] {
  const templates: EmailTemplate[] = [];

  // Known company names from the document (can be extended)
  // The document has sections like "ClearSpace" followed by subject and body
  const companyPattern = /^(ClearSpace|Reflex Aerospace|Helsing)\s*$/gm;

  // Find all company headers
  const matches = [...text.matchAll(companyPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match) continue;

    const companyName = match[1];
    const startIndex = match.index! + match[0].length;

    // Find the end (next company or end of text)
    const nextMatch = matches[i + 1];
    const endIndex = nextMatch ? nextMatch.index! : text.length;

    const sectionText = text.slice(startIndex, endIndex).trim();

    // Extract subject line
    const subjectMatch = /^Subject:\s*(.+?)$/m.exec(sectionText);
    const subject = subjectMatch ? subjectMatch[1]!.trim() : 'No subject';

    // Body is everything after the subject line
    const bodyStart = subjectMatch ? sectionText.indexOf(subjectMatch[0]) + subjectMatch[0].length : 0;
    const body = sectionText.slice(bodyStart).trim();

    templates.push({
      company: companyName,
      subject,
      body,
    });
  }

  return templates;
}

export function findTemplate(
  templates: readonly EmailTemplate[],
  company: string
): EmailTemplate | null {
  const normalizedSearch = normalizeCompanyName(company);

  for (const template of templates) {
    if (normalizeCompanyName(template.company) === normalizedSearch) {
      return template;
    }
  }

  return null;
}

export function getGenericTemplate(lead: Lead): EmailTemplate {
  return {
    company: GENERIC_TEMPLATE_COMPANY,
    subject: GENERIC_TEMPLATE_SUBJECT,
    body: GENERIC_TEMPLATE_BODY,
  };
}

export function isGenericTemplate(template: EmailTemplate): boolean {
  return template.company === GENERIC_TEMPLATE_COMPANY;
}

export function populateTemplate(template: EmailTemplate, lead: Lead): EmailTemplate {
  let body = template.body;
  let subject = template.subject;

  // Replace {ContactName}
  if (lead.contactName && lead.contactName.trim() !== '') {
    body = body.replace(/\{ContactName\}/g, ` ${lead.contactName}`);
  } else {
    // Remove placeholder entirely if no contact name
    body = body.replace(/\{ContactName\}/g, '');
  }

  // Replace {Company}
  body = body.replace(/\{Company\}/g, lead.company);

  // Replace {OwnerName}
  body = body.replace(/\{OwnerName\}/g, lead.owner || 'ExoSpace Team');

  // Clean up any double spaces or awkward spacing
  body = body.replace(/  +/g, ' ');
  body = body.replace(/,\s*,/g, ',');
  body = body.trim();

  return {
    company: template.company,
    subject,
    body,
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 3: Commit templates.ts**

```bash
git add src/templates.ts
git commit -m "$(cat <<'EOF'
feat: implement .docx template parsing with mammoth

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Logging Module

### Task 4.1: Write log.test.ts

**Files:**
- Create: `tests/log.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, assert, beforeEach, afterEach } from 'node:test';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initLogFile,
  appendLogEntry,
  appendLogBatch,
  generateRunId,
  escapeCsvValue,
} from '../src/log.ts';
import type { DraftLogEntry } from '../src/types.ts';

const testLogDir = resolve(import.meta.dirname, 'test-logs');
const testLogPath = resolve(testLogDir, 'test-drafts.csv');

describe('log', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(testLogDir)) {
      mkdirSync(testLogDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('generateRunId', () => {
    it('should generate a run ID with format YYYYMMDD-HHMMSS', () => {
      const runId = generateRunId();
      const pattern = /^\d{8}-\d{6}$/;
      assert.ok(pattern.test(runId), `Run ID ${runId} should match pattern`);
    });

    it('should generate unique IDs for different calls', () => {
      const id1 = generateRunId();
      // Small delay to ensure different timestamp
      const id2 = generateRunId();
      // IDs should be same if within same second, but format should be valid
      assert.ok(id1.length === 15);
      assert.ok(id2.length === 15);
    });
  });

  describe('escapeCsvValue', () => {
    it('should return simple value unchanged', () => {
      assert.strictEqual(escapeCsvValue('hello'), 'hello');
    });

    it('should quote values with commas', () => {
      assert.strictEqual(escapeCsvValue('hello, world'), '"hello, world"');
    });

    it('should quote values with quotes', () => {
      assert.strictEqual(escapeCsvValue('say "hi"'), '"say ""hi"""');
    });

    it('should quote values with newlines', () => {
      assert.strictEqual(escapeCsvValue('line1\nline2'), '"line1\nline2"');
    });

    it('should handle empty string', () => {
      assert.strictEqual(escapeCsvValue(''), '');
    });
  });

  describe('initLogFile', () => {
    it('should create log file with headers', async () => {
      await initLogFile(testLogPath);
      assert.ok(existsSync(testLogPath), 'Log file should exist');
    });

    it('should write correct headers', async () => {
      await initLogFile(testLogPath);
      const content = readFileSync(testLogPath, 'utf-8');
      assert.strictEqual(
        content.trim(),
        'timestamp,run_id,lead_id,company,email,subject,draft_id,status,template_type,error'
      );
    });

    it('should not overwrite existing file', async () => {
      await initLogFile(testLogPath);
      // Write some data
      const entry: DraftLogEntry = {
        timestamp: new Date().toISOString(),
        runId: 'test-run',
        leadId: 'L-001',
        company: 'TestCo',
        email: 'test@test.com',
        subject: 'Test subject',
        draftId: 'draft-123',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      };
      await appendLogEntry(testLogPath, entry);

      // Call init again
      await initLogFile(testLogPath);

      // File should still have our entry
      const content = readFileSync(testLogPath, 'utf-8');
      assert.ok(content.includes('L-001'), 'Should preserve existing entries');
    });
  });

  describe('appendLogEntry', () => {
    it('should append a single entry', async () => {
      await initLogFile(testLogPath);

      const entry: DraftLogEntry = {
        timestamp: '2026-04-24T14:30:00Z',
        runId: '20260424-143000',
        leadId: 'L-001',
        company: 'ClearSpace',
        email: 'test@clearspace.today',
        subject: 'Following up',
        draftId: 'draft-abc',
        status: 'created',
        templateType: 'company_specific',
        error: '',
      };

      await appendLogEntry(testLogPath, entry);

      const content = readFileSync(testLogPath, 'utf-8');
      assert.ok(content.includes('L-001'));
      assert.ok(content.includes('ClearSpace'));
      assert.ok(content.includes('created'));
    });
  });

  describe('appendLogBatch', () => {
    it('should append multiple entries', async () => {
      await initLogFile(testLogPath);

      const entries: DraftLogEntry[] = [
        {
          timestamp: '2026-04-24T14:30:00Z',
          runId: '20260424-143000',
          leadId: 'L-001',
          company: 'ClearSpace',
          email: 'test@clearspace.today',
          subject: 'Subject 1',
          draftId: 'draft-1',
          status: 'created',
          templateType: 'company_specific',
          error: '',
        },
        {
          timestamp: '2026-04-24T14:30:01Z',
          runId: '20260424-143000',
          leadId: 'L-002',
          company: 'Reflex',
          email: 'test@reflex.com',
          subject: 'Subject 2',
          draftId: 'draft-2',
          status: 'created',
          templateType: 'generic_fallback',
          error: '',
        },
      ];

      await appendLogBatch(testLogPath, entries);

      const content = readFileSync(testLogPath, 'utf-8');
      assert.ok(content.includes('L-001'));
      assert.ok(content.includes('L-002'));
      assert.ok(content.includes('ClearSpace'));
      assert.ok(content.includes('Reflex'));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with "Cannot find module '../src/log.ts'"

- [ ] **Step 3: Commit test file**

```bash
git add tests/log.test.ts
git commit -m "$(cat <<'EOF'
test: add log module tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: Implement log.ts

**Files:**
- Create: `src/log.ts`

- [ ] **Step 1: Write log.ts implementation**

```typescript
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import type { DraftLogEntry } from './types.ts';

const LOG_HEADERS = 'timestamp,run_id,lead_id,company,email,subject,draft_id,status,template_type,error';

const DEFAULT_LOG_PATH = 'logs/drafts.csv';

export function generateRunId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function escapeCsvValue(value: string): string {
  if (value === '') {
    return '';
  }

  // Check if quoting is needed
  const needsQuoting = value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r');

  if (!needsQuoting) {
    return value;
  }

  // Escape quotes by doubling them and wrap in quotes
  return `"${value.replace(/"/g, '""')}"`;
}

function formatLogEntry(entry: DraftLogEntry): string {
  const values = [
    entry.timestamp,
    entry.runId,
    entry.leadId,
    escapeCsvValue(entry.company),
    escapeCsvValue(entry.email),
    escapeCsvValue(entry.subject),
    entry.draftId,
    entry.status,
    entry.templateType,
    escapeCsvValue(entry.error),
  ];

  return values.join(',');
}

export async function initLogFile(filePath: string): Promise<void> {
  const absolutePath = resolve(filePath);
  const dir = dirname(absolutePath);

  // Create directory if needed
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Create file with headers if it doesn't exist
  if (!existsSync(absolutePath)) {
    writeFileSync(absolutePath, LOG_HEADERS + '\n', 'utf-8');
  }
}

export async function appendLogEntry(filePath: string, entry: DraftLogEntry): Promise<void> {
  const absolutePath = resolve(filePath);

  // Ensure file exists
  if (!existsSync(absolutePath)) {
    await initLogFile(absolutePath);
  }

  const line = formatLogEntry(entry);
  appendFileSync(absolutePath, line + '\n', 'utf-8');
}

export async function appendLogBatch(filePath: string, entries: readonly DraftLogEntry[]): Promise<void> {
  const absolutePath = resolve(filePath);

  // Ensure file exists
  if (!existsSync(absolutePath)) {
    await initLogFile(absolutePath);
  }

  const lines = entries.map(formatLogEntry).join('\n');
  appendFileSync(absolutePath, lines + '\n', 'utf-8');
}

export function getLogPath(customPath?: string): string {
  return customPath ?? DEFAULT_LOG_PATH;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 3: Commit log.ts**

```bash
git add src/log.ts
git commit -m "$(cat <<'EOF'
feat: implement CSV logging with run ID tracking

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4.5: Email Signature Support

### Task 4.5.1: Write signature.test.ts

**Files:**
- Create: `tests/signature.test.ts`

- [ ] **Step 1: Write the test file**

Tests should cover:
- Disabled signature returns null
- Missing signature file warns and continues
- Loading signature HTML from file
- Appending signature to email body
- Converting text to HTML body
- Loading inline logo as base64 attachment
- Missing logo fallback to text signature only

- [ ] **Step 2: Commit test file**

```bash
git add tests/signature.test.ts
git commit -m "$(cat <<'EOF'
test: add signature module tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.5.2: Implement signature.ts

**Files:**
- Create: `src/signature.ts`

- [ ] **Step 1: Write signature.ts implementation**

```typescript
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Inline attachment for Microsoft Graph API
export interface InlineAttachment {
  readonly '@odata.type': '#microsoft.graph.fileAttachment';
  readonly name: string;
  readonly contentType: string;
  readonly isInline: boolean;
  readonly contentId: string;
  readonly contentBytes: string;
}

// Signature configuration
export interface SignatureConfig {
  readonly enabled: boolean;
  readonly htmlPath: string;
  readonly logoPath: string;
  readonly logoContentId: string;
}

// Check if signature is enabled
export function isSignatureEnabled(envValue: string | undefined): boolean {
  if (envValue === undefined || envValue === '') {
    return false;
  }
  const normalized = envValue.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

// Load signature HTML from file, replace local image paths with CID
export async function loadSignatureHtml(filePath: string): Promise<string | null> {
  try {
    const absolutePath = resolve(process.cwd(), filePath);
    if (!existsSync(absolutePath)) {
      console.warn(`Warning: Signature HTML file not found: ${filePath}`);
      return null;
    }
    const content = readFileSync(absolutePath, 'utf-8');
    // Replace local image paths with CID references
    return content.replace(/src=["']Exospace_file\/image001\.png["']/gi, 'src="cid:exospace-logo"');
  } catch (error) {
    console.warn(`Warning: Failed to load signature HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

// Convert plain text to HTML body
export function textToHtmlBody(text: string): string {
  if (!text) return '<p></p>';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped.split(/\n\n+/);
  return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>\n')}</p>`).join('\n');
}

// Append signature to email body
export function appendSignatureToBody(bodyHtml: string, signatureHtml: string | null): string {
  if (!signatureHtml) return bodyHtml;
  return `${bodyHtml}\n<br><br>\n${signatureHtml}`;
}

// Load logo as inline attachment for Microsoft Graph
export async function loadInlineLogoAttachment(
  logoPath: string,
  contentId: string
): Promise<InlineAttachment | null> {
  try {
    const absolutePath = resolve(process.cwd(), logoPath);
    if (!existsSync(absolutePath)) {
      console.warn(`Warning: Logo file not found: ${logoPath}`);
      return null;
    }
    const buffer = readFileSync(absolutePath);
    const base64 = buffer.toString('base64');
    const ext = logoPath.toLowerCase().split('.').pop();
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: 'exospace-logo.png',
      contentType,
      isInline: true,
      contentId,
      contentBytes: base64,
    };
  } catch (error) {
    console.warn(`Warning: Failed to load logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

// Get signature configuration from environment
export function getSignatureConfig(): SignatureConfig {
  return {
    enabled: isSignatureEnabled(process.env.SIGNATURE_ENABLED),
    htmlPath: process.env.SIGNATURE_HTML_PATH || 'assets/signature/exospace-signature.html',
    logoPath: process.env.SIGNATURE_LOGO_PATH || 'assets/signature/Exospace_file/image001.png',
    logoContentId: process.env.SIGNATURE_LOGO_CONTENT_ID || 'exospace-logo',
  };
}

// Load signature and logo
export async function loadSignature(config: SignatureConfig): Promise<{
  signatureHtml: string | null;
  logoAttachment: InlineAttachment | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  if (!config.enabled) {
    return { signatureHtml: null, logoAttachment: null, warnings: [] };
  }
  
  let signatureHtml: string | null = null;
  let logoAttachment: InlineAttachment | null = null;
  
  try {
    signatureHtml = await loadSignatureHtml(config.htmlPath);
    if (!signatureHtml) {
      warnings.push(`Signature HTML file not found: ${config.htmlPath}`);
    }
  } catch (error) {
    warnings.push(`Failed to load signature HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  try {
    logoAttachment = await loadInlineLogoAttachment(config.logoPath, config.logoContentId);
    if (!logoAttachment) {
      warnings.push(`Logo file not found: ${config.logoPath}`);
    }
  } catch (error) {
    warnings.push(`Failed to load logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { signatureHtml, logoAttachment, warnings };
}

// Prepare email body with signature
export async function prepareEmailBody(
  textBody: string,
  signatureConfig: SignatureConfig
): Promise<{ htmlBody: string; attachments: InlineAttachment[]; warnings: string[] }> {
  const attachments: InlineAttachment[] = [];
  const warnings: string[] = [];
  
  let htmlBody = textToHtmlBody(textBody);
  
  if (signatureConfig.enabled) {
    const { signatureHtml, logoAttachment, warnings: sigWarnings } = await loadSignature(signatureConfig);
    warnings.push(...sigWarnings);
    
    if (signatureHtml) {
      htmlBody = appendSignatureToBody(htmlBody, signatureHtml);
      if (logoAttachment) {
        attachments.push(logoAttachment);
      }
    }
  }
  
  return { htmlBody, attachments, warnings };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`

Expected: All signature tests PASS

- [ ] **Step 3: Commit signature.ts**

```bash
git add src/signature.ts
git commit -m "$(cat <<'EOF'
feat: implement email signature support with inline logo

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.5.3: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add signature configuration variables**

Add to `.env.example`:

```bash
# Email signature (optional, disabled by default)
SIGNATURE_ENABLED=false
SIGNATURE_HTML_PATH=assets/signature/exospace-signature.html
SIGNATURE_LOGO_PATH=assets/signature/Exospace_file/image001.png
SIGNATURE_LOGO_CONTENT_ID=exospace-logo
```

- [ ] **Step 2: Commit .env.example**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
feat: add signature configuration to .env.example

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Authentication

### Task 5.1: Write auth.test.ts

**Files:**
- Create: `tests/auth.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, assert, beforeEach, afterEach } from 'node:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  createMsalClient,
  loadTokenCache,
  saveTokenCache,
  clearTokenCache,
} from '../src/auth.ts';
import type { Config } from '../src/types.ts';

const testCacheDir = resolve(import.meta.dirname, 'test-cache');
const testCachePath = resolve(testCacheDir, 'test-tokens.json');

const testConfig: Config = {
  tenantId: 'test-tenant-id',
  clientId: 'test-client-id',
  scopes: ['Mail.ReadWrite', 'offline_access'],
  leadsCsvPath: 'leads.csv',
  templatesDocxPath: 'templates.docx',
  logPath: 'logs/drafts.csv',
  tokenCachePath: testCachePath,
};

describe('auth', () => {
  beforeEach(() => {
    if (!existsSync(testCacheDir)) {
      mkdirSync(testCacheDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('createMsalClient', () => {
    it('should create MSAL PublicClientApplication', () => {
      const client = createMsalClient(testConfig);
      assert.ok(client, 'Should create client');
    });
  });

  describe('loadTokenCache', () => {
    it('should return null when cache does not exist', () => {
      const cache = loadTokenCache(testCachePath);
      assert.strictEqual(cache, null);
    });

    it('should load saved cache', () => {
      const testCache = {
        Account: 'test-account',
        RefreshToken: 'test-refresh-token',
      };
      saveTokenCache(testCachePath, testCache);
      const loaded = loadTokenCache(testCachePath);
      assert.deepStrictEqual(loaded, testCache);
    });
  });

  describe('saveTokenCache', () => {
    it('should create cache directory if needed', () => {
      const cache = { test: 'value' };
      saveTokenCache(testCachePath, cache);
      assert.ok(existsSync(testCachePath), 'Cache file should exist');
    });

    it('should save cache as JSON', () => {
      const cache = { Account: 'account-data' };
      saveTokenCache(testCachePath, cache);
      const loaded = loadTokenCache(testCachePath);
      assert.deepStrictEqual(loaded, cache);
    });
  });

  describe('clearTokenCache', () => {
    it('should remove cache file', () => {
      const cache = { test: 'value' };
      saveTokenCache(testCachePath, cache);
      assert.ok(existsSync(testCachePath));

      clearTokenCache(testCachePath);
      assert.ok(!existsSync(testCachePath), 'Cache should be deleted');
    });

    it('should not throw if cache does not exist', () => {
      // Should not throw
      clearTokenCache(testCachePath);
      assert.ok(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with "Cannot find module '../src/auth.ts'"

- [ ] **Step 3: Commit test file**

```bash
git add tests/auth.test.ts
git commit -m "$(cat <<'EOF'
test: add auth module tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.2: Implement auth.ts

**Files:**
- Create: `src/auth.ts`

- [ ] **Step 1: Write auth.ts implementation**

```typescript
import { PublicClientApplication, AuthenticationResult } from '@azure/msal-node';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, resolve } from 'path';
import type { Config } from './types.ts';

type TokenCache = Record<string, unknown>;

export function createMsalClient(config: Config): PublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
    cache: {
      cacheLocation: 'fileCache',
    },
  });
}

export function loadTokenCache(cachePath: string): TokenCache | null {
  const absolutePath = resolve(cachePath);

  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    const content = readFileSync(absolutePath, 'utf-8');
    return JSON.parse(content) as TokenCache;
  } catch (error) {
    console.error(`Warning: Could not load token cache from ${cachePath}:`, error);
    return null;
  }
}

export function saveTokenCache(cachePath: string, cache: TokenCache): void {
  const absolutePath = resolve(cachePath);
  const dir = dirname(absolutePath);

  // Create directory if needed
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(absolutePath, JSON.stringify(cache, null, 2), 'utf-8');
}

export function clearTokenCache(cachePath: string): void {
  const absolutePath = resolve(cachePath);

  if (existsSync(absolutePath)) {
    unlinkSync(absolutePath);
  }
}

export async function getAccessToken(
  client: PublicClientApplication,
  config: Config,
  cachePath: string
): Promise<string> {
  // Try to get token from cache
  const cachedTokens = loadTokenCache(cachePath);

  if (cachedTokens) {
    try {
      // Set the cache on the client
      const cache = client.getTokenCache();
      // Note: MSAL Node's cache management handles this internally

      // Try silent acquisition
      const accounts = await client.getAllAccounts();

      if (accounts.length > 0) {
        const result = await client.acquireTokenSilent({
          scopes: [...config.scopes],
          account: accounts[0],
        });

        if (result && result.accessToken) {
          return result.accessToken;
        }
      }
    } catch (error) {
      console.log('Token cache expired or invalid, will use device code flow');
    }
  }

  // No valid cache, use device code flow
  return authenticateWithDeviceCode(client, config, cachePath);
}

export async function authenticateWithDeviceCode(
  client: PublicClientApplication,
  config: Config,
  cachePath: string
): Promise<string> {
  console.log('\n🔐 Authentication Required\n');
  console.log('You need to sign in with your Microsoft account.\n');

  const deviceCodeRequest = {
    scopes: [...config.scopes],
    deviceCodeCallback: (response: { userCode: string; message: string }) => {
      console.log(response.message);
    },
  };

  try {
    const result: AuthenticationResult = await client.acquireTokenByDeviceCode(deviceCodeRequest);

    if (!result.accessToken) {
      throw new Error('No access token received');
    }

    // Save the account to cache
    const accounts = await client.getAllAccounts();
    if (accounts.length > 0) {
      const cacheData = {
        account: accounts[0].homeAccountId,
        timestamp: new Date().toISOString(),
      };
      saveTokenCache(cachePath, cacheData);
    }

    console.log('\n✅ Authentication successful!\n');
    return result.accessToken;
  } catch (error) {
    console.error('\n❌ Authentication failed:', error);
    throw new Error('Authentication failed. Please try again.');
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 3: Commit auth.ts**

```bash
git add src/auth.ts
git commit -m "$(cat <<'EOF'
feat: implement MSAL Device Code Flow with token caching

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Draft Creation

### Task 6.1: Write drafts.test.ts

**Files:**
- Create: `tests/drafts.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, assert } from 'node:test';
import { createGraphClient, validateEmail, createDraftRequestBody } from '../src/drafts.ts';

describe('drafts', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      assert.strictEqual(validateEmail('test@example.com'), true);
    });

    it('should return false for invalid email', () => {
      assert.strictEqual(validateEmail('invalid-email'), false);
    });

    it('should return false for empty string', () => {
      assert.strictEqual(validateEmail(''), false);
    });

    it('should return true for email with subdomain', () => {
      assert.strictEqual(validateEmail('user@mail.example.com'), true);
    });

    it('should return false for email without TLD', () => {
      assert.strictEqual(validateEmail('user@example'), false);
    });
  });

  describe('createDraftRequestBody', () => {
    it('should create valid request body', () => {
      const body = createDraftRequestBody(
        'test@example.com',
        'Test Subject',
        'Test body content'
      );

      assert.strictEqual(body.subject, 'Test Subject');
      assert.strictEqual(body.body?.contentType, 'Text');
      assert.strictEqual(body.body?.content, 'Test body content');
      assert.ok(Array.isArray(body.toRecipients));
      assert.strictEqual(body.toRecipients?.length, 1);
      assert.strictEqual(body.toRecipients?.[0]?.emailAddress?.address, 'test@example.com');
    });
  });

  // Note: createGraphClient and createDraft tests require real Graph API
  // These would be integration tests with a mock server
  describe('createGraphClient', () => {
    it('should create a Graph client', () => {
      const client = createGraphClient('fake-access-token');
      assert.ok(client, 'Should create client');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL with "Cannot find module '../src/drafts.ts'"

- [ ] **Step 3: Commit test file**

```bash
git add tests/drafts.test.ts
git commit -m "$(cat <<'EOF'
test: add drafts module tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.2: Implement drafts.ts

**Files:**
- Create: `src/drafts.ts`

- [ ] **Step 1: Write drafts.ts implementation**

```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import type { DraftRequest, DraftResult, EmailTemplate, Lead } from './types.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

export function validateEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export interface DraftRequestBody {
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
    };
  }>;
}

export function createDraftRequestBody(
  toEmail: string,
  subject: string,
  bodyContent: string
): DraftRequestBody {
  return {
    subject,
    body: {
      contentType: 'Text',
      content: bodyContent,
    },
    toRecipients: [
      {
        emailAddress: {
          address: toEmail,
        },
      },
    ],
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error)) {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
      console.log(`  Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryableError(error: unknown): boolean {
  // Rate limiting
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    // Retry on 429 (rate limit) and 5xx server errors
    return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
  }
  // Network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('econnreset') ||
           message.includes('econnrefused') ||
           message.includes('etimedout') ||
           message.includes('network');
  }
  return false;
}

export async function createDraft(
  client: Client,
  toEmail: string,
  subject: string,
  bodyContent: string
): Promise<string> {
  // Validate email first
  if (!validateEmail(toEmail)) {
    throw new Error(`Invalid email address: ${toEmail}`);
  }

  const requestBody = createDraftRequestBody(toEmail, subject, bodyContent);

  const result = await withRetry(
    async () => {
      const response = await client
        .api('/me/messages')
        .post(requestBody);

      return response as { id: string };
    },
    isRetryableError
  );

  return result.id;
}

export async function createDraftsBatch(
  client: Client,
  requests: readonly DraftRequest[]
): Promise<DraftResult[]> {
  const results: DraftResult[] = [];

  // Process sequentially to avoid rate limiting
  for (const request of requests) {
    const { lead, template } = request;

    // Validate email
    if (!validateEmail(lead.email)) {
      results.push({
        leadId: lead.leadId,
        company: lead.company,
        email: lead.email ?? '',
        subject: template.subject,
        draftId: null,
        success: false,
        error: 'Invalid or missing email address',
      });
      continue;
    }

    try {
      const draftId = await createDraft(
        client,
        lead.email,
        template.subject,
        template.body
      );

      results.push({
        leadId: lead.leadId,
        company: lead.company,
        email: lead.email,
        subject: template.subject,
        draftId,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        leadId: lead.leadId,
        company: lead.company,
        email: lead.email ?? '',
        subject: template.subject,
        draftId: null,
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`

Expected: All tests PASS

- [ ] **Step 3: Commit drafts.ts**

```bash
git add src/drafts.ts
git commit -m "$(cat <<'EOF'
feat: implement Graph API draft creation with retry logic

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7: Orchestrator + CLI

### Task 7.1: Create dry-run display helpers

**Files:**
- Create: `src/display.ts`

- [ ] **Step 1: Write display.ts**

```typescript
import type { DueLeadCheck, DraftResult, EmailTemplate } from './types.ts';
import { isGenericTemplate } from './templates.ts';

const BOX_WIDTH = 60;

function separator(char: string = '─'): string {
  return '┌' + char.repeat(BOX_WIDTH) + '┐';
}

function bottomSeparator(char: string = '─'): string {
  return '└' + char.repeat(BOX_WIDTH) + '┘';
}

function middleSeparator(char: string = '─'): string {
  return '├' + char.repeat(BOX_WIDTH) + '┤';
}

function line(text: string): string {
  const padding = BOX_WIDTH - text.length;
  return '│ ' + text + ' '.repeat(Math.max(0, padding - 1)) + '│';
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

export function displayDryRunSummary(
  totalRows: number,
  validLeads: number,
  dueLeads: readonly DueLeadCheck[],
  skippedLeads: readonly DueLeadCheck[],
  runId: string
): void {
  console.log('\n' + separator());
  console.log(line('DRY-RUN SUMMARY'));
  console.log(middleSeparator());
  console.log(line(`Total rows loaded:      ${totalRows}`));
  console.log(line(`Valid leads:            ${validLeads}`));
  console.log(line(`Due for follow-up:      ${dueLeads.length}`));
  console.log(middleSeparator());

  if (dueLeads.length > 0) {
    console.log(line('LEADS READY FOR DRAFT:'));
    console.log(line(''));

    for (const check of dueLeads) {
      const { lead, template, templateType } = check;
      const emailDisplay = lead.email ?? 'no email';

      console.log(line(`${lead.leadId} | ${lead.company} | ${emailDisplay}`));

      if (template) {
        const templateLabel = templateType === 'company_specific'
          ? 'company-specific'
          : 'generic_fallback';
        console.log(line(`  Template: ${templateLabel}`));
        console.log(line(`  Subject: ${truncate(template.subject, 50)}`));
        console.log(line(`  Preview: ${truncate(template.body, 50)}`));
      } else {
        console.log(line('  Template: none (will be skipped)'));
      }
      console.log(line(''));
    }
  }

  if (skippedLeads.length > 0) {
    console.log(middleSeparator());
    console.log(line('SKIPPED LEADS:'));
    console.log(line(''));

    for (const check of skippedLeads) {
      console.log(line(`  ${check.lead.leadId} | ${check.lead.company}`));
      console.log(line(`    Reason: ${check.skipReason ?? 'unknown'}`));
    }
    console.log(line(''));
  }

  console.log(middleSeparator());
  console.log(line(`Run ID: ${runId}`));
  console.log(bottomSeparator());
}

export function displayResultsSummary(
  created: number,
  skipped: number,
  failed: number,
  logPath: string
): void {
  console.log('\n' + separator());
  console.log(line('RESULTS'));
  console.log(middleSeparator());
  console.log(line(`Drafts created:  ${created}`));
  console.log(line(`Skipped:          ${skipped}`));
  console.log(line(`Failed:           ${failed}`));
  console.log(line(`Logged to:        ${logPath}`));
  console.log(bottomSeparator());
}

export function displayCancelledMessage(): void {
  console.log('\n❌ Cancelled. No drafts created.\n');
}

export function displayNoLeadsDueMessage(): void {
  console.log('\n✓ No leads due for follow-up at this time.\n');
}

export async function promptForConfirmation(defaultValue: boolean = false): Promise<boolean> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nProceed? [y/N] ', (answer: string) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === 'y' || normalized === 'yes') {
        resolve(true);
      } else {
        resolve(defaultValue);
      }
    });
  });
}
```

- [ ] **Step 2: Commit display.ts**

```bash
git add src/display.ts
git commit -m "$(cat <<'EOF'
feat: add CLI display helpers for dry-run and results

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.2: Implement index.ts orchestrator

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write index.ts**

```typescript
import {
  displayDryRunSummary,
  displayResultsSummary,
  displayCancelledMessage,
  displayNoLeadsDueMessage,
  promptForConfirmation,
} from './display.ts';
import { loadLeads, filterValidLeads, getDueLeads } from './leads.ts';
import { loadTemplates, findTemplate, getGenericTemplate, populateTemplate } from './templates.ts';
import { initLogFile, appendLogBatch, generateRunId } from './log.ts';
import { loadConfig, validateConfig } from './config.ts';
import { createMsalClient, getAccessToken } from './auth.ts';
import { createGraphClient, createDraftsBatch, validateEmail } from './drafts.ts';
import type { DueLeadCheck, DraftLogEntry, DraftRequest, EmailTemplate } from './types.ts';

async function main(): Promise<void> {
  try {
    // Step 1: Load and validate config
    console.log('Loading configuration...');
    const config = loadConfig();
    validateConfig(config);

    // Step 2: Generate run ID
    const runId = generateRunId();

    // Step 3: Load leads
    console.log('Loading leads from CSV...');
    const allLeads = await loadLeads(config.leadsCsvPath);
    const validLeads = filterValidLeads(allLeads);

    // Step 4: Identify due leads
    console.log('Identifying leads due for follow-up...');
    const dueLeadChecks = getDueLeads(validLeads);

    // Step 5: Exit early if no leads due
    if (dueLeadChecks.length === 0) {
      displayNoLeadsDueMessage();
      process.exit(0);
    }

    // Step 6: Load templates
    console.log('Loading email templates...');
    const templates = await loadTemplates(config.templatesDocxPath);

    // Step 7: Match templates to due leads
    const { ready, skipped } = matchTemplatesToLeads(dueLeadChecks, templates);

    // Step 8: Display dry-run summary
    displayDryRunSummary(
      allLeads.length,
      validLeads.length,
      ready,
      skipped,
      runId
    );

    // Step 9: Prompt for confirmation
    const confirmed = await promptForConfirmation(false);

    if (!confirmed) {
      displayCancelledMessage();
      process.exit(0);
    }

    // Step 10: Authenticate
    console.log('\nAuthenticating with Microsoft...');
    const msalClient = createMsalClient(config);
    const accessToken = await getAccessToken(msalClient, config, config.tokenCachePath);

    // Step 11: Create drafts
    console.log('\nCreating drafts...');
    const graphClient = createGraphClient(accessToken);
    const draftRequests = ready.map(check => ({
      lead: check.lead,
      template: check.template!,
    }));
    const results = await createDraftsBatch(graphClient, draftRequests);

    // Step 12: Log results
    console.log('\nLogging results...');
    await initLogFile(config.logPath);
    const logEntries = results.map((result): DraftLogEntry => ({
      timestamp: new Date().toISOString(),
      runId,
      leadId: result.leadId,
      company: result.company,
      email: result.email,
      subject: result.subject,
      draftId: result.draftId ?? 'N/A',
      status: result.success ? 'created' : 'failed',
      templateType: ready.find(r => r.lead.leadId === result.leadId)?.templateType ?? 'none',
      error: result.error ?? '',
    }));
    await appendLogBatch(config.logPath, logEntries);

    // Step 13: Display results
    const created = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skippedCount = skipped.length;

    displayResultsSummary(created, skippedCount, failed, config.logPath);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function matchTemplatesToLeads(
  dueLeads: readonly DueLeadCheck[],
  templates: readonly EmailTemplate[]
): { ready: DueLeadCheck[]; skipped: DueLeadCheck[] } {
  const ready: DueLeadCheck[] = [];
  const skipped: DueLeadCheck[] = [];

  for (const check of dueLeads) {
    const { lead } = check;

    // Check for valid email
    if (!validateEmail(lead.email)) {
      skipped.push({
        ...check,
        skipReason: 'missing_email',
      });
      continue;
    }

    // Try to find company-specific template
    const companyTemplate = findTemplate(templates, lead.company);

    if (companyTemplate) {
      const populated = populateTemplate(companyTemplate, lead);
      ready.push({
        ...check,
        template: populated,
        hasTemplate: true,
        templateType: 'company_specific',
      });
    } else {
      // Use generic template
      const genericTemplate = populateTemplate(getGenericTemplate(lead), lead);
      ready.push({
        ...check,
        template: genericTemplate,
        hasTemplate: true,
        templateType: 'generic_fallback',
      });
    }
  }

  return { ready, skipped };
}

main();
```

- [ ] **Step 2: Run lint to check for errors**

Run: `npm run lint`

Expected: No errors (or fix any issues)

- [ ] **Step 3: Commit index.ts**

```bash
git add src/index.ts
git commit -m "$(cat <<'EOF'
feat: implement main orchestrator with dry-run workflow

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.3: Final integration test

**Files:**
- None (manual test)

- [ ] **Step 1: Build the project**

Run: `npm run build`

Expected: TypeScript compiles successfully

- [ ] **Step 2: Create a sample .env file**

```bash
cp .env.example .env
# Edit .env with your actual Azure credentials
```

- [ ] **Step 3: Run the agent**

Run: `npm start`

Expected: Agent runs dry-run, shows summary, prompts for confirmation

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete lead follow-up agent v1

Features:
- MSAL Device Code Flow authentication with token caching
- CSV lead parsing with European date format
- Company-specific template matching from .docx
- Generic fallback template
- Microsoft Graph draft creation (no auto-send)
- CSV logging with run ID tracking
- Dry-run confirmation workflow

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Test Strategy

### Unit Tests
- `leads.test.ts` - CSV parsing, date format, filtering logic
- `templates.test.ts` - .docx parsing, company matching, placeholder substitution
- `log.test.ts` - CSV logging, run ID generation, escaping
- `auth.test.ts` - Token cache operations (MSAL requires real auth for full test)
- `drafts.test.ts` - Email validation, request body generation

### Integration Tests
- Manual end-to-end test with real Azure credentials
- Dry-run should display leads correctly
- Confirmation should trigger Device Code Flow
- Drafts should appear in Outlook

### Test Commands
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm run lint          # Type check only
```

---

## First Safe Milestone

**Milestone: Phase 2 Complete (CSV Parsing & Lead Filtering)**

After completing Phase 2, you can verify:
1. CSV parsing works with European format
2. Lead filtering identifies due leads correctly
3. Tests pass

This is a safe checkpoint before adding external dependencies (auth, Graph API).

---

## Summary

| Phase | Tasks | Files Created |
|-------|-------|---------------|
| Phase 1 | 1.1-1.6 | package.json scripts, .gitignore, .env.example, types.ts, config.ts |
| Phase 2 | 2.1-2.3 | sample-leads.csv, leads.test.ts, leads.ts |
| Phase 3 | 3.1-3.2 | templates.test.ts, templates.ts |
| Phase 4 | 4.1-4.2 | log.test.ts, log.ts |
| Phase 4.5 | 4.5.1-4.5.3 | signature.test.ts, signature.ts, .env.example update |
| Phase 5 | 5.1-5.2 | auth.test.ts, auth.ts |
| Phase 6 | 6.1-6.2 | drafts.test.ts, drafts.ts |
| Phase 7 | 7.1-7.3 | display.ts, index.ts |

**Total: 19 tasks, 15 source files, 6 test files**