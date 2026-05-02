import 'dotenv/config';
import * as readline from 'readline';
import { parseCliArgs, displayHelp, displayModeInfo } from './cli.js';
import { loadLeads, filterDueLeads, type SkipReason } from './leads.js';
import { loadTemplates, getTemplateForLead, populateTemplate, isGenericTemplate } from './templates.js';
import { getSignatureConfig, prepareEmailBody, type InlineAttachment } from './signature.js';
import { createMsalClient, getAccessToken, hasCachedAccount } from './auth.js';
import { createGraphClient, createDraftsBatch, buildDraftRequest, validateEmail, type GraphDraftRequest, type DraftResult } from './drafts.js';
import {
  generateRunId,
  initLogFile,
  appendLogBatch,
  createDraftLogEntry,
  createSkippedLogEntry,
  createFailedLogEntry,
  type DraftLogEntry,
  type DraftStatus,
  type TemplateType as LogTemplateType,
} from './log.js';
import type { Lead, EmailTemplate, Config, Mode } from './types.js';

// Configuration from environment
function getConfig(mode: Mode): Config {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;

  if (!tenantId || !clientId) {
    throw new Error('Missing required environment variables: AZURE_TENANT_ID and AZURE_CLIENT_ID must be set');
  }

  const scopes = (process.env.GRAPH_SCOPES || 'Mail.ReadWrite,offline_access')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return {
    tenantId,
    clientId,
    scopes,
    mode,
    leadsCsvPath: process.env.LEADS_CSV_PATH || 'lead_db/Exospace_lead_tracker_v1.1.csv',
    templatesDocxPath: process.env.TEMPLATES_DOCX_PATH || 'lead_db/template_answer_leads.docx',
    outreachTemplatePath: process.env.OUTREACH_TEMPLATE_PATH || 'lead_db/outreach_template.txt',
    presentationPath: process.env.PRESENTATION_PATH || 'lead_db/ExoSpace_company_presentation.pptx',
    logPath: process.env.LOG_PATH || 'logs/drafts.csv',
    tokenCachePath: process.env.TOKEN_CACHE_PATH || '.cache/msal-tokens.json',
  };
}

// Interface for draft preparation
interface PreparedDraft {
  lead: Lead;
  template: EmailTemplate;
  templateType: 'company_specific' | 'generic_fallback';
  subject: string;
  htmlBody: string;
  attachments: InlineAttachment[];
}

// Interface for dry-run summary
interface DryRunSummary {
  readonly totalLeads: number;
  readonly dueLeads: number;
  readonly skippedLeads: number;
  readonly bySkipReason: Record<SkipReason, number>;
  readonly templatesFound: number;
  readonly usingFallback: boolean;
}

/**
 * Ask user for confirmation via stdin
 * Returns true only if user types 'y' or 'yes'
 */
function askConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Display dry-run summary before authentication
 */
function displayDryRunSummary(summary: DryRunSummary, leads: readonly Lead[], templates: readonly EmailTemplate[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('DRY RUN SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n📊 Lead Analysis:`);
  console.log(`   Total leads loaded:     ${summary.totalLeads}`);
  console.log(`   Leads due for follow-up: ${summary.dueLeads}`);
  console.log(`   Leads skipped:          ${summary.skippedLeads}`);

  if (summary.skippedLeads > 0) {
    console.log('\n   Skip reasons:');
    for (const [reason, count] of Object.entries(summary.bySkipReason)) {
      if (count > 0) {
        console.log(`     - ${reason.replace(/_/g, ' ')}: ${count}`);
      }
    }
  }

  console.log(`\n📝 Templates:`);
  console.log(`   Company-specific templates: ${summary.templatesFound}`);
  console.log(`   Using generic fallback:     ${summary.usingFallback ? 'Yes' : 'No'}`);

  if (leads.length > 0) {
    console.log(`\n📋 Leads due for follow-up (${leads.length}):`);
    console.log('-'.repeat(60));

    const maxDisplay = 10;
    for (let i = 0; i < Math.min(leads.length, maxDisplay); i++) {
      const lead = leads[i];
      if (!lead) continue;
      const template = getTemplateForLead(templates, lead);
      const templateLabel = isGenericTemplate(template.template) ? '[Generic]' : '[Custom]';

      console.log(`   ${i + 1}. ${lead.company}`);
      console.log(`      ID: ${lead.leadId}`);
      console.log(`      Email: ${lead.email}`);
      console.log(`      Template: ${templateLabel}`);
    }

    if (leads.length > maxDisplay) {
      console.log(`   ... and ${leads.length - maxDisplay} more`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Display final summary after draft creation
 */
function displayFinalSummary(results: readonly DraftResult[], skippedCount: number): void {
  const created = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n📊 Draft Creation Results:`);
  console.log(`   ✅ Created:  ${created}`);
  console.log(`   ❌ Failed:   ${failed}`);
  console.log(`   ⏭️  Skipped:  ${skippedCount}`);
  console.log(`   📧 Total:    ${results.length + skippedCount}`);

  if (failed > 0) {
    console.log('\n❌ Failed drafts:');
    for (const result of results) {
      if (!result.success && result.error) {
        console.log(`   - ${result.company}: ${result.error}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Drafts have been created in your Outlook Drafts folder.');
  console.log('   Please review and send them manually from Outlook.\n');
}

/**
 * Map skip reason to log status
 */
function mapSkipReasonToStatus(reason: SkipReason): DraftStatus {
  switch (reason) {
    case 'missing_email':
      return 'skipped_no_email';
    case 'invalid_email':
      return 'skipped_invalid_email';
    case 'inactive_status':
      return 'skipped_inactive_status';
    case 'not_due':
      return 'skipped_not_due';
    default:
      return 'skipped_no_email';
  }
}

/**
 * Map template type for logging
 */
function mapTemplateType(templateType: 'company_specific' | 'generic_fallback'): LogTemplateType {
  return templateType;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse CLI arguments
  const cliArgs = parseCliArgs();

  // Handle help flag
  if (cliArgs.help) {
    displayHelp();
    process.exit(0);
  }

  console.log('\n🚀 Lead Follow-Up Agent for Exospace\n');

  // Display mode information
  displayModeInfo(cliArgs.mode);

  // Load configuration
  let config: Config;
  try {
    config = getConfig(cliArgs.mode);
  } catch (error) {
    console.error('❌ Configuration error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('\nPlease set the required environment variables:');
    console.error('  - AZURE_TENANT_ID');
    console.error('  - AZURE_CLIENT_ID');
    console.error('\nYou can create a .env file based on .env.example');
    process.exit(1);
  }

  const runId = generateRunId();
  console.log(`Run ID: ${runId}\n`);

  // Step 1: Load leads from CSV
  console.log('📂 Loading leads from CSV...');
  let parseResult;
  try {
    parseResult = await loadLeads(config.leadsCsvPath);
  } catch (error) {
    console.error('❌ Failed to load leads:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  console.log(`   Loaded ${parseResult.summary.validLeads} valid leads`);

  if (parseResult.summary.malformedCount > 0) {
    console.log(`   ⚠️  ${parseResult.summary.malformedCount} malformed rows skipped`);
  }

  // Step 2: Filter leads due for follow-up
  console.log('\n🔍 Filtering leads due for follow-up...');
  const dueResult = filterDueLeads(parseResult.leads);

  console.log(`   ${dueResult.summary.dueCount} leads due for follow-up`);
  console.log(`   ${dueResult.summary.skippedCount} leads skipped`);

  // If no leads are due, exit cleanly without authentication
  if (dueResult.dueLeads.length === 0) {
    console.log('\n✅ No leads are currently due for follow-up.');
    console.log('   Nothing to do. Exiting.\n');
    process.exit(0);
  }

  // Step 3: Load templates
  console.log('\n📄 Loading email templates...');
  let templates: readonly EmailTemplate[];
  let usingFallback = false;

  try {
    const templateResult = await loadTemplates(config.templatesDocxPath);

    templates = templateResult.templates;

    if (templateResult.parseErrors.length > 0) {
      for (const error of templateResult.parseErrors) {
        console.log(`   ⚠️  ${error}`);
      }
    }

    if (templateResult.source === 'fallback' || templates.length === 0) {
      usingFallback = true;
      console.log('   ℹ️  Using generic fallback template for all leads');
    } else {
      console.log(`   Loaded ${templates.length} company-specific template(s)`);
    }
  } catch (error) {
    console.log('   ⚠️  Failed to load templates, using generic fallback');
    usingFallback = true;
    templates = [];
  }

  // Step 4: Display dry-run summary
  const dryRunSummary: DryRunSummary = {
    totalLeads: parseResult.summary.validLeads,
    dueLeads: dueResult.summary.dueCount,
    skippedLeads: dueResult.summary.skippedCount,
    bySkipReason: dueResult.summary.bySkipReason,
    templatesFound: templates.length,
    usingFallback,
  };

  displayDryRunSummary(dryRunSummary, dueResult.dueLeads, templates);

  // Step 5: Ask for confirmation before proceeding
  console.log('\n⚠️  This will authenticate with Microsoft Graph and create draft emails.');
  console.log('   Drafts will NOT be sent automatically.\n');

  const confirmed = await askConfirmation('Do you want to proceed?');

  if (!confirmed) {
    console.log('\n❌ Cancelled by user. No authentication or draft creation performed.');
    console.log('   Exiting.\n');
    process.exit(0);
  }

  // Step 6: Authenticate
  console.log('\n🔐 Authenticating with Microsoft Graph...');

  const msalClient = createMsalClient(config);
  let accessToken: string;

  try {
    accessToken = await getAccessToken(msalClient, config);
  } catch (error) {
    console.error('❌ Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // Step 7: Prepare drafts
  console.log('\n📝 Preparing email drafts...');

  const signatureConfig = getSignatureConfig();
  const preparedDrafts: PreparedDraft[] = [];

  for (const lead of dueResult.dueLeads) {
    if (!lead) continue;

    // Get template (company-specific or generic fallback)
    const templateMatch = getTemplateForLead(templates, lead);
    const populatedTemplate = populateTemplate(templateMatch.template, lead);

    // Prepare email body with signature
    const { htmlBody, attachments } = await prepareEmailBody(populatedTemplate.body, signatureConfig);

    preparedDrafts.push({
      lead,
      template: templateMatch.template,
      templateType: templateMatch.templateType,
      subject: populatedTemplate.subject,
      htmlBody,
      attachments,
    });
  }

  console.log(`   Prepared ${preparedDrafts.length} draft(s)`);

  // Step 8: Ask for final confirmation before creating drafts
  console.log(`\n⚠️  About to create ${preparedDrafts.length} draft email(s) in your Outlook account.`);

  const finalConfirmed = await askConfirmation('Create these drafts?');

  if (!finalConfirmed) {
    console.log('\n❌ Cancelled by user. No drafts created.');
    console.log('   Exiting.\n');
    process.exit(0);
  }

  // Step 9: Create drafts via Microsoft Graph
  console.log('\n📧 Creating draft emails...');

  const graphClient = createGraphClient(accessToken);
  const draftRequests: GraphDraftRequest[] = preparedDrafts.map(draft =>
    buildDraftRequest(draft.lead, draft.subject, draft.htmlBody, draft.attachments)
  );

  let results: DraftResult[];
  try {
    results = await createDraftsBatch(graphClient, draftRequests);
  } catch (error) {
    console.error('❌ Draft creation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // Step 10: Log results
  console.log('\n📋 Logging results...');

  initLogFile(config.logPath);

  const logEntries: DraftLogEntry[] = [];

  // Log created and failed drafts
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const draft = preparedDrafts[i];

    if (!result || !draft) continue;

    if (result.success) {
      logEntries.push(
        createDraftLogEntry(
          runId,
          result.leadId,
          result.company,
          result.email,
          result.subject,
          result.draftId ?? '',
          mapTemplateType(draft.templateType)
        )
      );
    } else {
      logEntries.push(
        createFailedLogEntry(
          runId,
          result.leadId,
          result.company,
          result.email,
          result.subject,
          mapTemplateType(draft.templateType),
          result.error ?? 'Unknown error'
        )
      );
    }
  }

  // Log skipped leads
  for (const skipped of dueResult.skipped) {
    logEntries.push(
      createSkippedLogEntry(
        runId,
        skipped.leadId ?? 'unknown',
        skipped.company,
        '',
        mapSkipReasonToStatus(skipped.skipReason),
        'none'
      )
    );
  }

  appendLogBatch(config.logPath, logEntries);
  console.log(`   Logged ${logEntries.length} entries to ${config.logPath}`);

  // Step 11: Display final summary
  displayFinalSummary(results, dueResult.skipped.length);

  // Exit cleanly
  process.exit(0);
}

// Run the main function
main().catch((error) => {
  console.error('\n❌ Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});