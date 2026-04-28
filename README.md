# Lead Follow-Up Agent for Exospace

A Node.js + TypeScript CLI agent that automates lead follow-up email draft creation for Exospace. It reads lead data from CSV, matches company-specific email templates, and creates Outlook drafts via Microsoft Graph API.

**Important:** This agent **never sends emails automatically**. It creates draft emails only. You must manually review and send each draft from Outlook.

## Table of Contents

1. [Safety Model](#safety-model)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Microsoft Entra Setup](#microsoft-entra-setup)
6. [Environment Configuration](#environment-configuration)
7. [Lead CSV Format](#lead-csv-format)
8. [Template .docx Format](#template-docx-format)
9. [Signature Support](#signature-support)
10. [Running the Agent](#running-the-agent)
11. [Logs](#logs)
12. [Recommended First Test](#recommended-first-test)
13. [Git and Ignored Files](#git-and-ignored-files)
14. [Troubleshooting](#troubleshooting)
15. [Roadmap](#roadmap)

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

**You are always in control.** The agent will not authenticate or create drafts without your explicit consent.

---

## Architecture

The agent is modular, with each file handling a specific concern:

| Module | Purpose |
|--------|---------|
| `src/index.ts` | Main orchestrator and CLI workflow |
| `src/leads.ts` | CSV parsing, lead filtering, due date logic |
| `src/templates.ts` | .docx template parsing, company matching, placeholder population |
| `src/signature.ts` | HTML signature loading, inline logo attachment |
| `src/auth.ts` | MSAL Device Code Flow authentication, token caching |
| `src/drafts.ts` | Microsoft Graph API draft creation, retry logic |
| `src/log.ts` | CSV logging for created, skipped, and failed drafts |
| `src/types.ts` | TypeScript type definitions |

### Data Flow

```
CSV Leads → Filter Due Leads → Match Templates → Prepare Email Body
    ↓
User Confirmation → MSAL Authentication → Microsoft Graph API
    ↓
Create Drafts → Log Results → Display Summary
```

---

## Prerequisites

Before using this agent, ensure you have:

- **Windows PowerShell** (or compatible terminal)
- **Node.js** v18+ and npm
- **Microsoft 365 Outlook account** with mailbox access
- **Git** (for cloning and version control)
- **Azure / Microsoft Entra App Registration** (see setup below)
- **Microsoft Graph delegated permissions** configured

---

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd LeadFollowUpExospace

# Install dependencies
npm install

# Run type checking
npm run lint

# Run tests
npm test
```

If all tests pass, the agent is ready for configuration.

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

If admin consent is not required, users can consent during first authentication.

### Important Notes

- **No client secret needed** — Device Code Flow uses interactive login
- **Scopes required**:
  - `Mail.ReadWrite`
  - `offline_access`
- **Admin consent** may be required depending on your organization's policy

---

## Environment Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Azure AD App Registration (required)
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here

# Microsoft Graph scopes (default shown)
GRAPH_SCOPES=Mail.ReadWrite,offline_access

# File paths (defaults shown)
LEADS_CSV_PATH=lead_db/Exospace_lead_tracker_v1.1.csv
TEMPLATES_DOCX_PATH=lead_db/template_answer_leads.docx
TOKEN_CACHE_PATH=.cache/msal-tokens.json
LOG_PATH=logs/drafts.csv

# Email signature (optional)
SIGNATURE_ENABLED=false
SIGNATURE_HTML_PATH=assets/signature/exospace-signature.html
SIGNATURE_LOGO_PATH=assets/signature/Exospace_file/image001.png
SIGNATURE_LOGO_CONTENT_ID=exospace-logo
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
| `LEADS_CSV_PATH` | `lead_db/leads.csv` | Path to leads CSV file |
| `TEMPLATES_DOCX_PATH` | `lead_db/templates.docx` | Path to templates .docx |
| `TOKEN_CACHE_PATH` | `.cache/msal-tokens.json` | MSAL token cache location |
| `LOG_PATH` | `logs/drafts.csv` | Draft log file location |
| `SIGNATURE_ENABLED` | `false` | Enable HTML signature |
| `SIGNATURE_HTML_PATH` | `assets/signature/exospace-signature.html` | Signature HTML file |
| `SIGNATURE_LOGO_PATH` | `assets/signature/Exospace_file/image001.png` | Logo image file |
| `SIGNATURE_LOGO_CONTENT_ID` | `exospace-logo` | CID for inline logo |

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
| `Status` | Lead status (must be active) |
| `Next Follow-up Date` | Target follow-up date (DD/MM/YYYY) |
| `Days to Follow-up` | Days until follow-up (≤0 = due) |

### Active Statuses

Leads with these statuses are considered active:
- `New`
- `Contacted`
- `In Progress`
- `Qualified`

Leads with other statuses (e.g., `Closed Won`, `Closed Lost`) are skipped.

### Due Date Logic

A lead is **due for follow-up** when:
- `Days to Follow-up` ≤ 0 (zero or negative)
- Status is active
- Email is valid

### Example CSV

```csv
Lead ID;Company;Contact Name;Email;Status;Next Follow-up Date;Days to Follow-up
L001;Acme Corp;john.doe@acme.com;New;15/04/2026;0
L002;Beta Inc;Jane Smith;jane@beta.io;Contacted;14/04/2026;-1
L003;Gamma Ltd;Bob Wilson;bob@gamma.com;Closed Won;20/04/2026;5
```

In this example:
- L001 and L002 are due for follow-up
- L003 is skipped (inactive status and future date)

---

## Template .docx Format

The agent reads email templates from a Microsoft Word `.docx` file.

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

### Example Template

```
Acme Corp
Subject: Following up on ExoSpace introduction

Good afternoon{ContactNameGreeting},

I hope you are well.

I am following up on my previous email regarding ExoSpace Engineering & Consulting s.r.l. and our potential support for {Company} activities.

I would be glad to understand whether a short introductory call could be of interest.

Kind regards,
{OwnerName}
```

### Generic Fallback

If no company-specific template matches, the agent uses a generic fallback template. This ensures all leads receive an email even without a custom template.

### Template Matching

Templates are matched by company name:
- Case-insensitive matching
- Whitespace is trimmed and collapsed
- Exact match required (no partial matching)

---

## Signature Support

The agent supports optional HTML email signatures with inline logos.

### Configuration

Set `SIGNATURE_ENABLED=true` in your `.env` file.

### Required Files

| File | Purpose |
|------|---------|
| `assets/signature/exospace-signature.html` | HTML signature content |
| `assets/signature/Exospace_file/image001.png` | Logo image for inline embedding |

### How It Works

1. The signature HTML is appended to the email body
2. The logo image is embedded as an inline attachment using Content-ID (CID)
3. The image reference in HTML is replaced with `cid:exospace-logo`

### Signature HTML Example

```html
<p>Best regards,<br>
<strong>ExoSpace Engineering & Consulting s.r.l.</strong></p>
<img src="cid:exospace-logo" alt="ExoSpace" width="200">
```

### Notes

- If signature files are missing, the agent continues without signature
- No errors are thrown for missing signature files (warnings only)
- Set `SIGNATURE_ENABLED=false` to disable signatures

---

## Running the Agent

### Start the Agent

```bash
npm run start
```

Or using tsx directly:

```bash
npx tsx src/index.ts
```

### Workflow Steps

1. **Load Configuration** — Reads environment variables
2. **Load Leads** — Parses CSV file
3. **Filter Due Leads** — Identifies leads needing follow-up
4. **Load Templates** — Reads .docx templates
5. **Dry-Run Summary** — Displays what would happen
6. **First Confirmation** — "Do you want to proceed?" (auth)
7. **Authentication** — MSAL Device Code Flow login
8. **Second Confirmation** — "Create these drafts?"
9. **Draft Creation** — Creates drafts via Microsoft Graph
10. **Logging** — Records results to CSV
11. **Final Summary** — Displays created/failed counts

### Device Code Flow

When authenticating, the agent displays:

```
🔐 Authentication Required

You need to sign in with your Microsoft account.

To sign in, use a web browser to open the page https://microsoft.com/devicelogin
and enter the code XXXXXXXX to authenticate.
```

1. Open the URL in your browser
2. Enter the displayed code
3. Sign in with your Microsoft 365 account
4. Grant consent if prompted
5. Return to the terminal

The token is cached for subsequent runs.

### After Draft Creation

Drafts appear in your Outlook **Drafts** folder:

1. Open Outlook (web or desktop)
2. Go to Drafts folder
3. Review each draft
4. Edit if needed
5. Send manually when ready

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
| `status` | Result status (see below) |
| `template_type` | Template used (company_specific/generic_fallback/none) |
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

## Recommended First Test

Before running on real leads, follow this safe test procedure:

### Step 1: Prepare Test Data

Create a test CSV with **one lead**:

```csv
Lead ID;Company;Contact Name;Email;Status;Next Follow-up Date;Days to Follow-up
TEST001;Test Company;Your Name;your.email@example.com;New;28/04/2026;0
```

**Use your own email address** so you receive any test drafts.

### Step 2: Configure Environment

1. Copy `.env.example` to `.env`
2. Add your Azure credentials
3. Set `LEADS_CSV_PATH` to your test CSV

### Step 3: Run Dry-Run

```bash
npm run start
```

Review the dry-run summary. It shows:
- How many leads are due
- What templates would be used
- What emails would be sent

### Step 4: Answer "No" First

When prompted:

```
Do you want to proceed? (y/N):
```

Press **Enter** (or type `n`). The agent should exit cleanly:

```
❌ Cancelled by user. No authentication or draft creation performed.
```

This confirms the cancel mechanism works.

### Step 5: Run Again and Confirm

Run again and answer `y` to both confirmations.

### Step 6: Verify in Outlook

1. Open Outlook
2. Check your **Drafts** folder
3. Verify the draft appears
4. **Confirm no email was sent** (check Sent folder is empty)
5. Delete the test draft

### Step 7: Test Complete

If all steps worked, the agent is ready for production use.

---

## Git and Ignored Files

The `.gitignore` file excludes:

| Pattern | Reason |
|---------|--------|
| `.env` | Contains secrets |
| `.env.local` | Local environment overrides |
| `node_modules/` | Dependencies (via npm install) |
| `dist/` | Build output |
| `.cache/` | Token cache |
| `logs/` | Log files |
| `.vscode/` | IDE settings |
| `.idea/` | IDE settings |
| `.DS_Store` | macOS metadata |
| `Thumbs.db` | Windows thumbnail cache |
| `~$*.xlsx` | Excel temporary files |
| `~$*.xls` | Excel temporary files |
| `~$*.docx` | Word temporary files |

**Never commit `.env` or token cache files.**

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

### No leads due

**Message:**
```
✅ No leads are currently due for follow-up.
   Nothing to do. Exiting.
```

**Solution:**
- Check CSV file has leads with `Days to Follow-up ≤ 0`
- Ensure leads have valid emails
- Verify lead status is active (New, Contacted, In Progress, Qualified)

### Signature logo missing

**Warning:**
```
Warning: Logo file not found: assets/signature/Exospace_file/image001.png
```

**Solution:**
- Create the signature files, or
- Set `SIGNATURE_ENABLED=false` in `.env`

The agent continues without signature if files are missing.

### Draft not visible in Outlook

**Possible causes:**
1. Draft created in wrong folder — Check all folders
2. Outlook not synced — Click Send/Receive
3. Wrong mailbox — Verify you signed in with correct account

**Solution:**
```bash
# Clear token cache to force re-authentication
rm .cache/msal-tokens.json
npm run start
```

### Token cache reset

To force re-authentication:

```bash
# Delete the token cache
rm .cache/msal-tokens.json  # Linux/macOS
del .cache\msal-tokens.json  # Windows
```

The agent will prompt for Device Code Flow login on next run.

---

## Roadmap

Future improvements planned:

- **Scheduling** — Automated daily/weekly runs via cron or task scheduler
- **CRM Sync** — Direct integration with Dynamics 365, HubSpot, Salesforce
- **Template Alias Matching** — Support company aliases for better template matching
- **HTML Email Design** — Rich HTML templates with images and formatting
- **Dashboard** — Web UI for monitoring runs and drafts
- **MCP Integration** — Claude Desktop integration via Model Context Protocol
- **Manual Send Approval** — Optional workflow requiring approval before sending
- **Batch Operations** — Bulk draft creation with progress tracking
- **Email Analytics** — Track open rates, responses, conversions

---

## License

ISC

---

## Support

For issues and questions, please open an issue in the repository.