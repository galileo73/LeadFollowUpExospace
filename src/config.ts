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