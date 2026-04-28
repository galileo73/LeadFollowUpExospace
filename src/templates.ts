import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import type { Lead, EmailTemplate } from './types.ts';

// Template type for identification
export type TemplateType = 'company_specific' | 'generic_fallback';

// Result of loading templates
export interface TemplateLoadResult {
  readonly templates: readonly EmailTemplate[];
  readonly parseErrors: readonly string[];
  readonly source: 'docx' | 'fallback';
}

// Result of finding a template for a lead
export interface TemplateMatchResult {
  readonly template: EmailTemplate;
  readonly templateType: TemplateType;
}

// Company alias mapping (for future use)
export type CompanyAliasMap = Map<string, string>;

// Normalize company name for matching
function normalizeCompanyName(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

// Generic fallback template
const GENERIC_TEMPLATE: EmailTemplate = {
  company: '__generic__',
  subject: 'Following up on ExoSpace introduction',
  body: `Good afternoon{ContactNameGreeting},

I hope you are well.

I am following up on my previous email regarding ExoSpace Engineering & Consulting s.r.l. and our potential support for {Company} activities.

I would be glad to understand whether a short introductory call could be of interest.

Kind regards,
{OwnerName}`,
};

/**
 * Find the next non-empty line starting from a given index
 * Returns the trimmed line and its index, or null if none found
 */
function findNextNonEmptyLine(lines: readonly string[], startIndex: number): { line: string; index: number } | null {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        return { line: trimmed, index: i };
      }
    }
  }
  return null;
}

/**
 * Extract templates from .docx content
 * Expected format: Company names as headers followed by Subject: and body
 */
export function parseTemplatesFromText(text: string): { templates: EmailTemplate[]; parseErrors: string[] } {
  const templates: EmailTemplate[] = [];
  const parseErrors: string[] = [];

  // Split by company sections - look for lines that could be company names
  // A company section starts with a company name line, followed by Subject: line
  const lines = text.split('\n');

  let currentCompany: string | null = null;
  let currentSubject: string | null = null;
  let currentBody: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const trimmedLine = line.trim();

    // Check if this line is a Subject: line
    if (trimmedLine.toLowerCase().startsWith('subject:')) {
      currentSubject = trimmedLine.substring(8).trim();
      continue;
    }

    // Skip empty lines
    if (trimmedLine.length === 0) {
      continue;
    }

    // Check if this could be a company header
    // A company header is a non-empty line where the NEXT non-empty line starts with "Subject:"
    const nextNonEmpty = findNextNonEmptyLine(lines, i + 1);
    const nextLineIsSubject = nextNonEmpty !== null &&
      nextNonEmpty.line.toLowerCase().startsWith('subject:');

    const isCompanyHeader =
      nextLineIsSubject &&
      !trimmedLine.toLowerCase().startsWith('subject:') &&
      !trimmedLine.startsWith('{') &&
      !trimmedLine.startsWith('-');

    if (isCompanyHeader) {
      // Save previous template if exists
      if (currentCompany && currentSubject) {
        templates.push({
          company: currentCompany,
          subject: currentSubject,
          body: currentBody.join('\n').trim(),
        });
      }

      // Start new company section
      currentCompany = trimmedLine;
      currentSubject = null;
      currentBody = [];
      continue;
    }

    // Add line to current body if we're in a company section with a subject
    if (currentCompany && currentSubject) {
      currentBody.push(trimmedLine);
    }
  }

  // Save last template
  if (currentCompany && currentSubject) {
    templates.push({
      company: currentCompany,
      subject: currentSubject,
      body: currentBody.join('\n').trim(),
    });
  }

  return { templates, parseErrors };
}

/**
 * Load templates from .docx file
 * Falls back to generic template if file cannot be loaded
 */
export async function loadTemplates(filePath: string): Promise<TemplateLoadResult> {
  try {
    const buffer = readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });

    const text = result.value;
    const { templates, parseErrors } = parseTemplatesFromText(text);

    if (templates.length === 0) {
      // No templates found, return fallback
      return {
        templates: [],
        parseErrors: ['No valid templates found in document. Using generic fallback.'],
        source: 'fallback',
      };
    }

    return {
      templates,
      parseErrors,
      source: 'docx',
    };
  } catch (error) {
    // File not found or parse error - return fallback
    const errorMessage = error instanceof Error ? error.message : 'Unknown error loading templates';
    return {
      templates: [],
      parseErrors: [errorMessage],
      source: 'fallback',
    };
  }
}

/**
 * Load templates from plain text (for testing purposes)
 */
export async function loadTemplatesFromText(text: string): Promise<TemplateLoadResult> {
  const { templates, parseErrors } = parseTemplatesFromText(text);

  if (templates.length === 0) {
    return {
      templates: [],
      parseErrors: ['No valid templates found. Using generic fallback.'],
      source: 'fallback',
    };
  }

  return {
    templates,
    parseErrors,
    source: 'docx', // Treat as successful parse
  };
}

/**
 * Find a template matching the company name
 * Returns null if no match found
 */
export function findTemplate(
  templates: readonly EmailTemplate[],
  company: string,
  _aliasMap?: CompanyAliasMap
): EmailTemplate | null {
  const normalizedCompany = normalizeCompanyName(company);

  for (const template of templates) {
    const normalizedTemplateCompany = normalizeCompanyName(template.company);
    if (normalizedTemplateCompany === normalizedCompany) {
      return template;
    }
  }

  return null;
}

/**
 * Get the generic fallback template
 */
export function getGenericTemplate(): EmailTemplate {
  return { ...GENERIC_TEMPLATE };
}

/**
 * Check if a template is the generic fallback
 */
export function isGenericTemplate(template: EmailTemplate): boolean {
  return template.company === '__generic__';
}

/**
 * Populate placeholders in a template with lead data
 * Handles missing ContactName by omitting from greeting
 */
export function populateTemplate(template: EmailTemplate, lead: Lead): EmailTemplate {
  const contactName = lead.contactName?.trim() ?? '';
  const companyName = lead.company ?? '';
  const ownerName = lead.owner?.trim() || 'ExoSpace Team';

  // Handle ContactName in greeting
  // If the template has {ContactNameGreeting}, replace it appropriately
  // If ContactName is missing, remove the placeholder entirely
  let body = template.body;

  // Replace ContactNameGreeting - special handling for greeting context
  if (contactName) {
    // If we have a name, use it with a comma
    body = body.replace(/{ContactNameGreeting}/g, ` ${contactName}`);
  } else {
    // If no name, remove the placeholder (greeting becomes just "Good afternoon,")
    body = body.replace(/{ContactNameGreeting}/g, '');
  }

  // Replace remaining placeholders
  body = body
    .replace(/{ContactName}/g, contactName)
    .replace(/{Company}/g, companyName)
    .replace(/{OwnerName}/g, ownerName);

  // Clean up any double spaces or spaces before commas
  body = body.replace(/\s+/g, ' ').replace(/\s+,/g, ',');

  // Populate subject
  let subject = template.subject;
  subject = subject
    .replace(/{ContactName}/g, contactName)
    .replace(/{Company}/g, companyName)
    .replace(/{OwnerName}/g, ownerName);

  return {
    company: template.company,
    subject,
    body,
  };
}

/**
 * Find the appropriate template for a lead
 * Returns the template and its type (company_specific or generic_fallback)
 */
export function getTemplateForLead(
  templates: readonly EmailTemplate[],
  lead: Lead,
  aliasMap?: CompanyAliasMap
): TemplateMatchResult {
  const companyTemplate = findTemplate(templates, lead.company, aliasMap);

  if (companyTemplate) {
    return {
      template: companyTemplate,
      templateType: 'company_specific',
    };
  }

  return {
    template: getGenericTemplate(),
    templateType: 'generic_fallback',
  };
}