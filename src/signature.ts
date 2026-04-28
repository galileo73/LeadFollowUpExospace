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

// Result of loading signature
export interface SignatureResult {
  readonly signatureHtml: string | null;
  readonly logoAttachment: InlineAttachment | null;
  readonly warnings: readonly string[];
}

/**
 * Check if signature is enabled
 */
export function isSignatureEnabled(envValue: string | undefined): boolean {
  if (envValue === undefined || envValue === '') {
    return false;
  }
  const normalized = envValue.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Load signature HTML from file
 * Returns null if file doesn't exist or on error
 */
export async function loadSignatureHtml(filePath: string): Promise<string | null> {
  try {
    const absolutePath = resolve(process.cwd(), filePath);

    if (!existsSync(absolutePath)) {
      console.warn(`Warning: Signature HTML file not found: ${filePath}`);
      return null;
    }

    const content = readFileSync(absolutePath, 'utf-8');

    // Replace the local image path with CID reference for inline images
    // The original Outlook signature uses Exospace_file/image001.png
    const cidContent = content.replace(
      /src=["']Exospace_file\/image001\.png["']/gi,
      'src="cid:exospace-logo"'
    );

    return cidContent;
  } catch (error) {
    console.warn(`Warning: Failed to load signature HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Convert plain text to HTML body
 * Wraps text in paragraph tags and converts newlines to <br>
 */
export function textToHtmlBody(text: string): string {
  if (!text) {
    return '<p></p>';
  }

  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert double newlines to paragraph breaks
  const paragraphs = escaped.split(/\n\n+/);

  // Wrap each paragraph and convert single newlines to <br>
  const htmlParagraphs = paragraphs.map(p => {
    const withBreaks = p.replace(/\n/g, '<br>\n');
    return `<p>${withBreaks}</p>`;
  });

  return htmlParagraphs.join('\n');
}

/**
 * Append signature to email body
 * If signature is null, returns bodyHtml unchanged
 */
export function appendSignatureToBody(bodyHtml: string, signatureHtml: string | null): string {
  if (!signatureHtml) {
    return bodyHtml;
  }

  // Add a separator before signature
  return `${bodyHtml}\n<br><br>\n${signatureHtml}`;
}

/**
 * Load inline logo as base64 attachment for Microsoft Graph
 * Returns null if file doesn't exist or on error
 */
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

    // Determine content type from extension
    const contentType = getContentType(logoPath);

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

/**
 * Get content type from file extension
 */
function getContentType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();

  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png'; // Default to PNG
  }
}

/**
 * Load signature configuration from environment
 */
export function getSignatureConfig(): SignatureConfig {
  const enabled = isSignatureEnabled(process.env.SIGNATURE_ENABLED);
  const htmlPath = process.env.SIGNATURE_HTML_PATH || 'assets/signature/exospace-signature.html';
  const logoPath = process.env.SIGNATURE_LOGO_PATH || 'assets/signature/Exospace_file/image001.png';
  const logoContentId = process.env.SIGNATURE_LOGO_CONTENT_ID || 'exospace-logo';

  return {
    enabled,
    htmlPath,
    logoPath,
    logoContentId,
  };
}

/**
 * Load signature and logo for email
 * Handles all error cases gracefully
 */
export async function loadSignature(config: SignatureConfig): Promise<SignatureResult> {
  const warnings: string[] = [];

  // If signature is disabled, return early
  if (!config.enabled) {
    return {
      signatureHtml: null,
      logoAttachment: null,
      warnings: [],
    };
  }

  // Load signature HTML
  let signatureHtml: string | null = null;
  try {
    signatureHtml = await loadSignatureHtml(config.htmlPath);
    if (!signatureHtml) {
      warnings.push(`Signature HTML file not found: ${config.htmlPath}`);
    }
  } catch (error) {
    warnings.push(`Failed to load signature HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Load logo attachment
  let logoAttachment: InlineAttachment | null = null;
  try {
    logoAttachment = await loadInlineLogoAttachment(config.logoPath, config.logoContentId);
    if (!logoAttachment) {
      warnings.push(`Logo file not found: ${config.logoPath}`);
    }
  } catch (error) {
    warnings.push(`Failed to load logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    signatureHtml,
    logoAttachment,
    warnings,
  };
}

/**
 * Prepare email body with signature and logo
 * Returns the HTML body and any attachments needed
 */
export async function prepareEmailBody(
  textBody: string,
  signatureConfig: SignatureConfig
): Promise<{
  htmlBody: string;
  attachments: InlineAttachment[];
  warnings: string[];
}> {
  const attachments: InlineAttachment[] = [];
  const warnings: string[] = [];

  // Convert text to HTML
  let htmlBody = textToHtmlBody(textBody);

  // Load signature if enabled
  if (signatureConfig.enabled) {
    const signatureResult = await loadSignature(signatureConfig);

    // Collect warnings
    warnings.push(...signatureResult.warnings);

    // Append signature to body
    if (signatureResult.signatureHtml) {
      htmlBody = appendSignatureToBody(htmlBody, signatureResult.signatureHtml);

      // Add logo attachment if available
      if (signatureResult.logoAttachment) {
        attachments.push(signatureResult.logoAttachment);
      }
    }
  }

  return {
    htmlBody,
    attachments,
    warnings,
  };
}