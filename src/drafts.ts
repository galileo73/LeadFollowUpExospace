import { Client } from '@microsoft/microsoft-graph-client';
import type { InlineAttachment } from './signature.js';
import type { Lead, EmailTemplate } from './types.js';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Draft request for creating a draft email
export interface GraphDraftRequest {
  readonly lead: Lead;
  readonly subject: string;
  readonly htmlBody: string;
  readonly attachments?: readonly InlineAttachment[];
}

// Result of creating a draft
export interface DraftResult {
  readonly leadId: string;
  readonly company: string;
  readonly email: string;
  readonly subject: string;
  readonly draftId: string | null;
  readonly success: boolean;
  readonly error?: string;
}

// Request body for Microsoft Graph /me/messages endpoint
interface MessageRequestBody {
  subject: string;
  body: {
    contentType: 'html' | 'text';
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
    };
  }>;
  attachments?: Array<{
    '@odata.type': '#microsoft.graph.fileAttachment';
    name: string;
    contentType: string;
    contentBytes: string;
    isInline: boolean;
    contentId?: string;
  }>;
}

/**
 * Validate email address format
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Create Microsoft Graph client from access token
 */
export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (429 rate limit or network error)
 */
function isRetryableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Check for rate limiting (429)
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;

    // Check for statusCode property (Graph API error)
    if ('statusCode' in errorObj && typeof errorObj.statusCode === 'number') {
      const statusCode = errorObj.statusCode;
      // Retry on 429 (rate limit) and 5xx server errors
      return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    }

    // Check for code property
    if ('code' in errorObj && typeof errorObj.code === 'string') {
      const code = errorObj.code;
      // Graph API error codes for rate limiting
      if (code === 'TooManyRequests' || code === 'ServiceUnavailable') {
        return true;
      }
    }
  }

  // Check for network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('network') ||
      message.includes('timeout')
    );
  }

  return false;
}

/**
 * Retry an operation with exponential backoff
 */
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

/**
 * Create a single draft email via Microsoft Graph API
 */
export async function createDraft(
  client: Client,
  toEmail: string,
  subject: string,
  htmlBody: string,
  attachments?: readonly InlineAttachment[]
): Promise<string> {
  // Validate email before API call
  if (!validateEmail(toEmail)) {
    throw new Error(`Invalid email address: ${toEmail}`);
  }

  // Build the message request body
  const messageBody: MessageRequestBody = {
    subject,
    body: {
      contentType: 'html',
      content: htmlBody,
    },
    toRecipients: [
      {
        emailAddress: {
          address: toEmail.trim(),
        },
      },
    ],
  };

  // Add inline attachments if provided
  if (attachments && attachments.length > 0) {
    messageBody.attachments = attachments.map((att) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
      isInline: att.isInline,
      contentId: att.contentId,
    }));
  }

  // Create draft with retry logic
  const result = await withRetry(
    async () => {
      const response = await client.api('/me/messages').post(messageBody);
      return response as { id: string };
    },
    isRetryableError
  );

  return result.id;
}

/**
 * Create multiple draft emails in batch
 * Processes sequentially to avoid rate limiting
 */
export async function createDraftsBatch(
  client: Client,
  requests: readonly GraphDraftRequest[]
): Promise<DraftResult[]> {
  const results: DraftResult[] = [];

  for (const request of requests) {
    const { lead, subject, htmlBody, attachments } = request;

    // Validate email
    if (!validateEmail(lead.email)) {
      results.push({
        leadId: lead.leadId,
        company: lead.company,
        email: lead.email ?? '',
        subject,
        draftId: null,
        success: false,
        error: 'Invalid or missing email address',
      });
      continue;
    }

    try {
      // At this point, lead.email is validated and guaranteed to be a valid email string
      const email = lead.email;
      if (!email) {
        // This should never happen since validateEmail would have returned false
        throw new Error('Email validation passed but email is null');
      }

      const draftId = await createDraft(
        client,
        email,
        subject,
        htmlBody,
        attachments
      );

      results.push({
        leadId: lead.leadId,
        company: lead.company,
        email: email,
        subject,
        draftId,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for auth/permission errors that should stop the run
      if (isAuthError(error)) {
        // Re-throw auth errors to stop the entire run
        throw error;
      }

      results.push({
        leadId: lead.leadId,
        company: lead.company,
        email: lead.email ?? '',
        subject,
        draftId: null,
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}

/**
 * Check if an error is an authentication/permission error
 */
function isAuthError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;

    // Check for statusCode
    if ('statusCode' in errorObj && typeof errorObj.statusCode === 'number') {
      const statusCode = errorObj.statusCode;
      // 401 Unauthorized, 403 Forbidden
      return statusCode === 401 || statusCode === 403;
    }

    // Check for error code
    if ('code' in errorObj && typeof errorObj.code === 'string') {
      const code = errorObj.code;
      return (
        code === 'Unauthorized' ||
        code === 'Forbidden' ||
        code === 'AuthenticationFailed' ||
        code === 'InvalidAuthenticationToken'
      );
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('authentication')
    );
  }

  return false;
}

/**
 * Build draft request from lead and template data
 */
export function buildDraftRequest(
  lead: Lead,
  subject: string,
  htmlBody: string,
  attachments?: readonly InlineAttachment[]
): GraphDraftRequest {
  if (attachments) {
    return {
      lead,
      subject,
      htmlBody,
      attachments,
    };
  }
  return {
    lead,
    subject,
    htmlBody,
  };
}