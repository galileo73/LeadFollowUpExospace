# Lead Follow-Up Agent for Exospace

A Node.js + TypeScript CLI tool for Exospace lead email drafting using Microsoft Graph API. Supports two modes: follow-up for existing leads and outreach for new contacts.

**Important:** This agent **never sends emails automatically**. It creates draft emails only. You must manually review and send each draft from Outlook.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Safety Model](#safety-model)
3. [Modes](#modes)
   - [Follow-up Mode](#follow-up-mode)
   - [Outreach Mode](#outreach-mode)
4. [Environment Configuration](#environment-configuration)
5. [File Structure](#file-structure)
6. [Lead CSV Format](#lead-csv-format)
7. [Template .docx Format](#template-docx-format)
8. [Outreach Template Format](#outreach-template-format)
9. [Presentation Attachment](#presentation-attachment)
10. [Signature Support](#signature-support)
11. [First Safe Test Procedure](#first-safe-test-procedure)
12. [Logs](#logs)
13. [Git Hygiene](#git-hygiene)
14. [Development Commands](#development-commands)
15. [Known Limitations / Future Improvements](#known-limitations--future-improvements)
16. [Architecture](#architecture)
17. [Microsoft Entra Setup](#microsoft-entra-setup)
18. [Troubleshooting](#troubleshooting)

---

## Project Overview

This is a local CLI tool for Exospace lead email drafting. It reads lead data from CSV and creates Outlook draft emails via Microsoft Graph API.

**Key features:**
- Two modes: follow-up (default) and outreach (first contact)
- Company-specific email templates
- ExoSpace HTML signature with inline logo
- PPTX presentation attachment (outreach mode)
- Dry-run summaries before authentication
- Explicit user confirmation required

**What it does NOT do:**
- Send emails automatically
- Use `/sendMail` endpoint
- Create drafts without user confirmation
- Modify CRM or external systems

---

## Safety Model

This agent is designed with safety as the top priority:

- **Drafts only** — Emails are created as drafts in your Outlook Drafts folder
- **No `/sendMail` endpoint** — The agent never calls the Microsoft Graph sendMail API
- **Explicit confirmation required** — You must confirm twice:
  1. Before authentication (to access your Microsoft account)
  2. Before draft creation (to create drafts in Outlook)
- **Default is No** — If you press Enter without typing `y` or `yes`, the agent cancels
- **Manual review required** — You must open Outlook and manually review/send each draft
- **PPTX validation before auth** — In outreach mode, presentation file is validated BEFORE authentication

**You are always in control.** The agent will not authenticate or create drafts without your explicit consent.

---

## Modes

### Follow-up Mode

Default mode for following up with existing leads.

**Command:**
```bash
npm run start
```

**Required inputs:**
| Input | Environment Variable | Description |
|-------|----------------------|-------------|
| Lead CSV | `LEADS_CSV_PATH` | Lead data with contact info |
| Templates | `TEMPLATES_DOCX_PATH` | Company-specific follow-up templates |
| Signature | `SIGNATURE_ENABLED`, etc. | Optional HTML signature with logo |

**Lead filtering criteria:**
- `Days to Follow-up` ≤ 0 (due or overdue)
- Valid email address
- Active status: New, Contacted, In Progress, Qualified

**Workflow:**
1. Load leads from CSV
2. Filter due follow-ups
3. Match company templates
4. Show dry-run summary
5. Request confirmation → Authenticate
6. Request confirmation → Create drafts
7. Log results

---

### Outreach Mode

First-contact mode for new lead outreach with presentation attachment.

**Command:**
```bash
npm run start -- --mode outreach
```

**Required inputs:**
| Input | Environment Variable | Description |
|-------|----------------------|-------------|
| Lead CSV | `LEADS_CSV_PATH` | Lead data with contact info |
| Outreach Template | `OUTREACH_TEMPLATE_PATH` | Plain text template for outreach |
| Presentation | `PRESENTATION_PATH` | PPTX file to attach |
| Signature | `SIGNATURE_ENABLED`, etc. | Optional HTML signature with logo |

**Lead filtering criteria:**
- Status = `New` OR `Qualified`
- Valid email address
- `Days to Follow-up` is NOT used for outreach mode

**PPTX validation:**
- File must exist
- File must be under 3 MB
- Validation happens BEFORE authentication (fail-fast)

**Workflow:**
1. Load leads from CSV
2. Validate PPTX file
3. Filter outreach leads (New/Qualified)
4. Show dry-run summary (includes PPTX info)
5. Request confirmation → Authenticate
6. Load PPTX attachment
7. Request confirmation → Create drafts with attachments
8. Log results

**Attachment types:**
- Signature logo: Inline attachment (embedded in email body)
- PPTX presentation: Normal file attachment (downloadable)

---

## Environment Configuration

Create a `.env` file in the project root:

```env
# Azure AD App Registration (required)
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here

# Microsoft Graph scopes (default)
GRAPH_SCOPES=Mail.ReadWrite,offline_access

# File paths (defaults shown)
LEADS_CSV_PATH=lead_db/Exospace_lead_tracker_v1.1.CSV
TEMPLATES_DOCX_PATH=lead_db/template_answer_leads.docx
TOKEN_CACHE_PATH=.cache/msal-tokens.json
LOG_PATH=logs/drafts.csv

# Signature configuration (optional)
SIGNATURE_ENABLED=true
SIGNATURE_HTML_PATH=assets/signature/exospace-signature.html
SIGNATURE_LOGO_PATH=assets/signature/Exospace_file/image001.png
SIGNATURE_LOGO_CONTENT_ID=exospace-logo

# Outreach mode configuration
OUTREACH_TEMPLATE_PATH=lead_db/outreach_template.txt
PRESENTATION_PATH=lead_db/Exospace_Company_Profile_Overall_v1.0.pptx
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_CLIENT_ID` | App registration client ID |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPH_SCOPES` | `Mail.ReadWrite,offline_access` | Microsoft Graph scopes |
| `LEADS_CSV_PATH` | `lead_db/Exospace_lead_tracker_v1.1.CSV` | Path to leads CSV |
| `TEMPLATES_DOCX_PATH` | `lead_db/template_answer_leads.docx` | Path to follow-up templates |
| `TOKEN_CACHE_PATH` | `.cache/msal-tokens.json` | MSAL token cache location |
| `LOG_PATH` | `logs/drafts.csv` | Draft log file location |
| `SIGNATURE_ENABLED` | `false` | Enable HTML signature |
| `SIGNATURE_HTML_PATH` | `assets/signature/exospace-signature.html` | Signature HTML file |
| `SIGNATURE_LOGO_PATH` | `assets/signature/Exospace_file/image001.png` | Logo image file |
| `SIGNATURE_LOGO_CONTENT_ID` | `exospace-logo` | CID for inline logo |
| `OUTREACH_TEMPLATE_PATH` | `lead_db/outreach_template.txt` | Path to outreach template |
| `PRESENTATION_PATH` | `lead_db/Exospace_Company_Profile_Overall_v1.0.pptx` | PPTX presentation path |

---

## File Structure

```
lead_db/
├── Exospace_lead_tracker_v1.1.CSV    # Lead data (CSV)
├── template_answer_leads.docx        # Follow-up templates (.docx)
├── outreach_template.txt             # Outreach template (plain text)
└── Exospace_Company_Profile_Overall_v1.0.pptx  # Presentation (PPTX)

assets/signature/
├── exospace-signature.html           # HTML signature
└── Exospace_file/
    └── image001.png                  # Inline logo image

logs/
└── drafts.csv                        # Draft creation log

.cache/
└── msal-tokens.json                  # MSAL token cache
```

### File Notes

| File | Required | Mode | Notes |
|------|----------|------|-------|
| Lead CSV | Yes | Both | Source of truth for lead data |
| Follow-up templates | Follow-up only | `.docx` format |
| Outreach template | Yes | Outreach | Plain text format |
| Presentation PPTX | Yes | Outreach | Must be under 3 MB |
| Signature HTML | Optional | Both | Enabled via `SIGNATURE_ENABLED=true` |
| Signature logo | Optional | Both | PNG format recommended |

---

## Lead CSV Format

The agent reads lead data from a CSV file with **semicolon delimiter** and **European date format**.

### Required Columns

| Column | Description |
|--------|-------------|
| `Lead ID` | Unique identifier (required) |
| `Company` | Company name |
| `Contact Name` | Contact person name |
| `Email` | Email address (required for drafts) |
| `Status` | Lead status |
| `Next Follow-up Date` | Target follow-up date (DD/MM/YYYY) |
| `Days to Follow-up` | Days until follow-up (≤0 = due) |

### Active Statuses (Follow-up Mode)

- `New`
- `Contacted`
- `In Progress`
- `Qualified`

### Outreach Statuses (Outreach Mode)

- `New`
- `Qualified`

### Example CSV

```csv
Lead ID;Company;Contact Name;Email;Status;Next Follow-up Date;Days to Follow-up
L001;Acme Corp;John Doe;john@acme.com;New;15/04/2026;0
L002;Beta Inc;Jane Smith;jane@beta.io;Qualified;14/04/2026;-1
L003;Gamma Ltd;Bob Wilson;bob@gamma.com;Contacted;20/04/2026;5
```

---

## Template .docx Format

Follow-up templates are read from a Microsoft Word `.docx` file.

### Expected Structure

Each template consists of:

```
Company Name
Subject: Your email subject line
Email body text here...

{ContactName}
{Company}
{OwnerName}
```

### Supported Placeholders

| Placeholder | Replaced With |
|-------------|---------------|
| `{ContactName}` | Lead's contact name |
| `{ContactNameGreeting}` | Contact name in greeting context (or omitted if missing) |
| `{Company}` | Lead's company name |
| `{OwnerName}` | Lead owner's name (defaults to "ExoSpace Team") |

### Template Matching

- Case-insensitive company name matching
- Whitespace trimmed and collapsed
- Exact match required
- Generic fallback used if no match found

---

## Outreach Template Format

Outreach templates are plain text files with a simple format.

### Format

```
Subject: Your subject line here

Email body text here...
{ContactNameGreeting},

I hope this email finds you well.

...

Kind regards,
{OwnerName}
```

### Subject Line

- Must start with `Subject:` (case-insensitive)
- Subject line is extracted and removed from the body

### Supported Placeholders

| Placeholder | Replaced With |
|-------------|---------------|
| `{ContactName}` | Lead's contact name |
| `{ContactNameGreeting}` | Contact name in greeting context |
| `{Company}` | Lead's company name |
| `{OwnerName}` | Lead owner's name (defaults to "ExoSpace Team") |

### Contact Name Greeting

If `ContactName` is present:
```
Good afternoon {ContactNameGreeting},
```
becomes:
```
Good afternoon John Doe,
```

If `ContactName` is missing:
```
Good afternoon{ContactNameGreeting},
```
becomes:
```
Good afternoon,
```

### Default Template

If the outreach template file is not found, a fallback template is used with:
- Subject: `Introducing ExoSpace Engineering & Consulting`
- Generic greeting

---

## Presentation Attachment

### Configuration

The presentation file is configured via `PRESENTATION_PATH` environment variable.

### Requirements

- Format: `.pptx` (PowerPoint)
- Maximum size: **3 MB**
- Must exist before running outreach mode

### Validation

The agent validates the presentation BEFORE authentication:

1. Check file exists
2. Check file size ≤ 3 MB
3. If invalid, exit with error message

### Behavior

- **Inline logo** (signature): Embedded in email body, visible when email is read
- **PPTX attachment** (outreach): Normal file attachment, downloadable by recipient

### Future Improvement

Files larger than 3 MB require Microsoft Graph upload sessions. This is a planned future enhancement.

---

## Signature Support

The same signature configuration is used for both follow-up and outreach modes.

### Configuration

Set `SIGNATURE_ENABLED=true` in your `.env` file.

### Required Files

| File | Purpose |
|------|---------|
| `assets/signature/exospace-signature.html` | HTML signature content |
| `assets/signature/Exospace_file/image001.png` | Logo image for inline embedding |

### How It Works

1. Signature HTML is appended to email body
2. Logo image is embedded as inline attachment using Content-ID (CID)
3. Image reference in HTML is replaced with `cid:exospace-logo`

### Signature HTML Example

```html
<p>Best regards,<br>
<strong>ExoSpace Engineering & Consulting s.r.l.</strong></p>
<img src="cid:exospace-logo" alt="ExoSpace" width="200">
```

### Notes

- If signature files are missing, the agent continues without signature (warning only)
- Set `SIGNATURE_ENABLED=false` to disable signatures
- Same signature is used for follow-up and outreach modes

---

## First Safe Test Procedure

Before running on real leads, follow this safe test procedure for outreach mode.

### Step A: Set One Test Lead

Edit your CSV to have one test lead:

```csv
Lead ID;Company;Contact Name;Email;Status;Next Follow-up Date;Days to Follow-up
TEST001;ClearSpace;Nicolas Croisard;engineering@exospace.space;New;12/05/2026;0
```

**Important:** Use your own email address to receive test drafts.

### Step B: Run Outreach Mode

```bash
npm run start -- --mode outreach
```

### Step C: Check Dry-Run Summary

Verify the output shows:

```
📋 Mode: outreach
📊 Lead Analysis:
   Total leads loaded:       1
   Eligible outreach leads:   1
   
📎 Presentation Attachment:
   Name: Exospace_Company_Profile_Overall_v1.0.pptx
   Size: X.XX MB

✉️  Signature:
   ✅ Enabled

📋 Eligible outreach leads (1):
   1. ClearSpace
      ID: TEST001
      Email: engineering@exospace.space
      Contact: Nicolas Croisard
```

### Step D: Confirm Only If Correct

When prompted:

```
Do you want to proceed? (y/N):
```

**Press Enter (or type `n`)** to cancel and verify the cancel mechanism works.

Then run again and answer `y` only if all information is correct.

### Step E: Check Outlook Drafts

After confirming both prompts:

1. Open Outlook
2. Go to **Drafts** folder
3. Verify:
   - Recipient email is correct
   - Subject line is correct
   - Email body is formatted properly
   - Signature appears (if enabled)
   - Logo is visible inline
   - PPTX attachment is attached
4. **Confirm email was NOT sent** (Sent folder is empty)
5. Delete the test draft

---

## Logs

The agent logs all activity to a CSV file (`logs/drafts.csv` by default).

### Log Fields

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 timestamp |
| `run_id` | Unique run identifier (YYYYMMDD-HHMMSS) |
| `lead_id` | Lead identifier |
| `company` | Company name |
| `email` | Recipient email |
| `subject` | Email subject |
| `draft_id` | Microsoft Graph draft ID |
| `status` | Result status |
| `template_type` | Template used (company_specific/generic_fallback/outreach/none) |
| `error` | Error message if failed |

### Status Values

| Status | Meaning |
|--------|---------|
| `created` | Draft successfully created |
| `failed` | Draft creation failed |
| `skipped_no_email` | Lead has no email |
| `skipped_invalid_email` | Email format invalid |
| `skipped_inactive_status` | Lead status inactive |
| `skipped_not_due` | Lead not due for follow-up |

---

## Git Hygiene

### Files to Never Commit

| Pattern | Reason |
|---------|--------|
| `.env` | Contains secrets |
| `.env.local` | Local environment overrides |
| `.cache/` | Token cache |
| `logs/` | Log files |
| `lead_db/*.pptx` | Presentation files (often large/binary) |
| Real lead CSV | May contain sensitive contact data |

### .gitignore Patterns

```
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

# Office temporary files
~$*.xlsx
~$*.xls
~$*.docx

# Lead database generated files
lead_db/*.pptx
```

### Notes on Real Files

- **Real PPTX**: Should remain local; `.gitignore` excludes `lead_db/*.pptx`
- **Real CSV**: Should remain local if it contains sensitive lead data
- **Test fixtures**: Can be committed in `tests/fixtures/` with dummy data

---

## Development Commands

```bash
# Install dependencies
npm install

# Type checking
npm run lint

# Run tests
npm test

# Run in follow-up mode (default)
npm run start

# Run in outreach mode
npm run start -- --mode outreach

# Run with tsx directly
npx tsx src/index.ts
npx tsx src/index.ts --mode outreach
```

---

## Known Limitations / Future Improvements

### Current Limitations

| Limitation | Description |
|------------|-------------|
| **PPTX size limit** | Files over 3 MB are not supported |
| **No CRM update** | Draft creation does not update CRM status |
| **No automatic sending** | By design — drafts must be sent manually |
| **CSV as source** | No direct database/CRM integration |
| **No scheduling** | Must be run manually or via external scheduler |

### Planned Improvements

| Improvement | Description |
|-------------|--------------|
| **Upload sessions** | Support PPTX files > 3 MB via Microsoft Graph upload sessions |
| **Multiple attachments** | Support multiple file attachments per draft |
| **Scheduling** | Automated daily/weekly runs via cron or task scheduler |
| **CRM sync** | Direct integration with Dynamics 365, HubSpot, Salesforce |
| **Template aliases** | Support company aliases for better template matching |

---

## Architecture

The agent is modular, with each file handling a specific concern:

| Module | Purpose |
|--------|---------|
| `src/index.ts` | Main orchestrator, mode routing, workflow steps |
| `src/cli.ts` | CLI argument parsing, mode detection |
| `src/leads.ts` | CSV parsing, lead filtering (follow-up and outreach) |
| `src/templates.ts` | Template loading, company matching, placeholder population |
| `src/signature.ts` | HTML signature loading, inline logo attachment |
| `src/attachments.ts` | PPTX file loading, size validation |
| `src/drafts.ts` | Microsoft Graph draft creation, mixed attachments |
| `src/auth.ts` | MSAL Device Code Flow, token caching |
| `src/log.ts` | CSV logging for created, skipped, and failed drafts |
| `src/types.ts` | TypeScript type definitions |

### Data Flow

```
CSV Leads → Filter Leads (by mode) → Load Templates/PPTX
    ↓
User Confirmation → MSAL Authentication → Microsoft Graph API
    ↓
Create Drafts (with attachments) → Log Results → Display Summary
```

---

## Microsoft Entra Setup

The agent uses **Device Code Flow**, which requires an App Registration in Microsoft Entra ID (Azure AD). No client secret is needed.

### Step 1: Create App Registration

1. Sign in to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations**
3. Click **New registration**
4. Enter a name (e.g., "Lead Follow-Up Agent")
5. Select **Accounts in this organizational directory only** (Single tenant)
6. Click **Register**

### Step 2: Get IDs

After registration, note these values from the **Overview** page:

- **Application (client) ID** — Your `AZURE_CLIENT_ID`
- **Directory (tenant) ID** — Your `AZURE_TENANT_ID`

### Step 3: Configure API Permissions

1. Go to **API permissions** in your app registration
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `Mail.ReadWrite` — Read and write mail
   - `offline_access` — Maintain access (refresh tokens)
6. Click **Add permissions**

### Step 4: Admin Consent (if required)

If your organization requires admin consent:

1. In **API permissions**, click **Grant admin consent for [Your Organization]**
2. Confirm the consent

---

## Troubleshooting

### npm blocked by PowerShell execution policy

**Error:**
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled
```

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Missing .env file

**Error:**
```
❌ Configuration error: Missing required environment variables
```

**Solution:**
1. Copy `.env.example` to `.env`
2. Add your Azure credentials
3. Ensure file is in project root

### Microsoft login issue

**Error:**
```
❌ Authentication failed: No access token received
```

**Solutions:**
- Check your internet connection
- Verify `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` are correct
- Try clearing the token cache: delete `.cache/msal-tokens.json`
- Ensure app registration has correct permissions

### Missing Graph permission

**Error:**
```
❌ Draft creation failed: Forbidden
```

**Solution:**
1. Go to Azure Portal → App registrations
2. Check API permissions include `Mail.ReadWrite`
3. Grant admin consent if required
4. Wait a few minutes for permissions to propagate

### Presentation file missing or too large

**Error:**
```
❌ Presentation file not found: lead_db/Exospace_Company_Profile_Overall_v1.0.pptx
```

**Solution:**
- Ensure `PRESENTATION_PATH` points to a valid `.pptx` file
- Check file size is under 3 MB

**Error:**
```
❌ Presentation file is too large (5.23 MB). Maximum size is 3 MB.
```

**Solution:**
- Compress the PPTX file or reduce image quality
- Future versions will support upload sessions for larger files

### No leads eligible

**Follow-up mode:**
```
✅ No leads are currently due for follow-up.
   Nothing to do. Exiting.
```

**Solution:**
- Check CSV has leads with `Days to Follow-up ≤ 0`
- Ensure leads have valid emails
- Verify status is active (New, Contacted, In Progress, Qualified)

**Outreach mode:**
```
✅ No leads are eligible for outreach.
   Nothing to do. Exiting.
```

**Solution:**
- Check CSV has leads with status `New` or `Qualified`
- Ensure leads have valid emails

### Signature logo missing

**Warning:**
```
Warning: Logo file not found: assets/signature/Exospace_file/image001.png
```

**Solution:**
- Create the signature files, or
- Set `SIGNATURE_ENABLED=false` in `.env`

### Draft not visible in Outlook

**Possible causes:**
1. Draft created in wrong folder — Check all folders
2. Outlook not synced — Click Send/Receive
3. Wrong mailbox — Verify you signed in with correct account

**Solution:**
```bash
# Clear token cache to force re-authentication
rm .cache/msal-tokens.json  # Linux/macOS
del .cache\msal-tokens.json  # Windows

npm run start
```

---

## License

ISC

---

## Support

For issues and questions, please open an issue in the repository.