import type { Mode } from './types.js';

/**
 * Parsed CLI arguments
 */
export interface CliArgs {
  readonly mode: Mode;
  readonly help: boolean;
}

/**
 * Default mode if not specified
 */
export const DEFAULT_MODE: Mode = 'follow-up';

/**
 * Valid mode values
 */
export const VALID_MODES: readonly Mode[] = ['follow-up', 'outreach'] as const;

/**
 * Parse CLI arguments from process.argv
 * Supports: --mode <follow-up|outreach>, --help
 */
export function parseCliArgs(args: readonly string[] = process.argv.slice(2)): CliArgs {
  let mode: Mode = DEFAULT_MODE;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--mode') {
      const nextArg = args[i + 1];
      if (nextArg && isValidMode(nextArg)) {
        mode = nextArg as Mode;
        i++; // Skip the mode value
      } else {
        console.error(`Error: Invalid mode "${nextArg}". Valid modes: ${VALID_MODES.join(', ')}`);
        console.error('Use --help for usage information.');
        process.exit(1);
      }
      continue;
    }

    // Handle --mode=<value> format
    if (arg?.startsWith('--mode=')) {
      const value = arg.substring(7);
      if (isValidMode(value)) {
        mode = value as Mode;
      } else {
        console.error(`Error: Invalid mode "${value}". Valid modes: ${VALID_MODES.join(', ')}`);
        console.error('Use --help for usage information.');
        process.exit(1);
      }
      continue;
    }

    // Unknown argument
    if (arg && !arg.startsWith('-')) {
      // Positional argument - could be mode
      if (isValidMode(arg)) {
        mode = arg as Mode;
      }
    }
  }

  return { mode, help };
}

/**
 * Check if a value is a valid mode
 */
function isValidMode(value: string): value is Mode {
  return VALID_MODES.includes(value as Mode);
}

/**
 * Display help message
 */
export function displayHelp(): void {
  console.log(`
Lead Follow-Up Agent for Exospace

Usage: npm run start -- [options]

Options:
  --mode <mode>    Agent mode (default: follow-up)
                   - follow-up: Create follow-up drafts for due leads
                   - outreach:  Create first-contact drafts with presentation
  --help, -h       Display this help message

Examples:
  npm run start                           # Run in follow-up mode (default)
  npm run start -- --mode follow-up       # Run in follow-up mode
  npm run start -- --mode outreach        # Run in outreach mode

Safety:
  - Drafts are created but NEVER sent automatically
  - Explicit confirmation required before authentication
  - Explicit confirmation required before draft creation
  - Default answer is always No (press Enter to cancel)

Configuration:
  Set environment variables in .env file:
  - AZURE_TENANT_ID      Azure AD tenant ID (required)
  - AZURE_CLIENT_ID      App registration client ID (required)
  - LEADS_CSV_PATH       Path to leads CSV file
  - TEMPLATES_DOCX_PATH  Path to follow-up templates .docx
  - OUTREACH_TEMPLATE_PATH  Path to outreach template .txt
  - PRESENTATION_PATH    Path to company presentation .pptx
  - SIGNATURE_ENABLED    Enable HTML signature (true/false)
`);
}

/**
 * Display mode-specific information at startup
 */
export function displayModeInfo(mode: Mode): void {
  const modeDescriptions: Record<Mode, string> = {
    'follow-up': 'Create follow-up email drafts for due leads',
    'outreach': 'Create first-contact email drafts with presentation attachment',
  };

  console.log(`\n📧 Mode: ${mode}`);
  console.log(`   ${modeDescriptions[mode]}`);

  if (mode === 'outreach') {
    console.log('   ⚠️  Outreach mode requires presentation file (PPTX, max 3 MB)');
  }
}