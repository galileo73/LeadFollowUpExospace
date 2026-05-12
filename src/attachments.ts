import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

// Maximum attachment size for Microsoft Graph simple upload (3 MB)
// TODO: For files larger than 3 MB, implement Microsoft Graph upload sessions
// See: https://learn.microsoft.com/en-us/graph/outlook-large-attachments
export const MAX_PRESENTATION_SIZE_BYTES = 3 * 1024 * 1024;

// PPTX content type
export const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// File attachment for Microsoft Graph API (not inline)
export interface FileAttachment {
  readonly '@odata.type': '#microsoft.graph.fileAttachment';
  readonly name: string;
  readonly contentType: string;
  readonly contentBytes: string;
  // Note: isInline is omitted (defaults to false) for regular attachments
}

// Result of loading a presentation attachment
export interface PresentationLoadResult {
  readonly attachment: FileAttachment | null;
  readonly error: string | null;
  readonly warning: string | undefined;
}

// Error types for presentation loading
export type PresentationLoadError =
  | 'file_not_found'
  | 'file_too_large'
  | 'read_error';

/**
 * Get the default presentation path
 */
export function getDefaultPresentationPath(): string {
  return 'lead_db/Exospace_Company_Profile_Overall_v1.0.pptx';
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath: string): number {
  const stats = statSync(filePath);
  return stats.size;
}

/**
 * Load a PPTX presentation as a Microsoft Graph file attachment
 * Returns null with error if file is missing or too large
 */
export function loadPresentationAttachment(
  filePath: string
): PresentationLoadResult {
  const absolutePath = resolve(process.cwd(), filePath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    return {
      attachment: null,
      error: `Presentation file not found: ${filePath}`,
      warning: undefined,
    };
  }

  // Check file size
  let size: number;
  try {
    size = getFileSize(absolutePath);
  } catch (error) {
    return {
      attachment: null,
      error: `Unable to read file size: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warning: undefined,
    };
  }

  if (size > MAX_PRESENTATION_SIZE_BYTES) {
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_PRESENTATION_SIZE_BYTES / 1024 / 1024).toFixed(0);
    return {
      attachment: null,
      error: `Presentation file is too large (${sizeMB} MB). Maximum size is ${maxMB} MB.`,
      warning: undefined,
    };
  }

  // Read file and encode as base64
  let buffer: Buffer;
  try {
    buffer = readFileSync(absolutePath);
  } catch (error) {
    return {
      attachment: null,
      error: `Unable to read presentation file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warning: undefined,
    };
  }

  const base64Content = buffer.toString('base64');
  const fileName = filePath.split(/[/\\]/).pop() ?? 'presentation.pptx';

  const attachment: FileAttachment = {
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: fileName,
    contentType: PPTX_CONTENT_TYPE,
    contentBytes: base64Content,
  };

  // Include warning if file is close to size limit
  const warning = size > MAX_PRESENTATION_SIZE_BYTES * 0.9
    ? `Presentation is close to size limit (${(size / 1024 / 1024).toFixed(2)} MB)`
    : undefined;

  return {
    attachment,
    error: null,
    warning,
  };
}

/**
 * Check if a presentation file exists and is within size limits
 * Returns error message if there's an issue, null if OK
 */
export function validatePresentationFile(filePath: string): string | null {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return `Presentation file not found: ${filePath}`;
  }

  let size: number;
  try {
    size = getFileSize(absolutePath);
  } catch (error) {
    return `Unable to read file size: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  if (size > MAX_PRESENTATION_SIZE_BYTES) {
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_PRESENTATION_SIZE_BYTES / 1024 / 1024).toFixed(0);
    return `Presentation file is too large (${sizeMB} MB). Maximum size is ${maxMB} MB.`;
  }

  return null;
}

/**
 * Get presentation file info without loading content
 */
export function getPresentationInfo(filePath: string): {
  exists: boolean;
  size?: number;
  sizeMB?: string;
  error?: string;
} {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return { exists: false, error: 'File not found' };
  }

  try {
    const size = getFileSize(absolutePath);
    return {
      exists: true,
      size,
      sizeMB: (size / 1024 / 1024).toFixed(2),
    };
  } catch (error) {
    return {
      exists: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}