export const MimePolicy = {
  /** Safe MIME types for attachments. Everything else is rejected. */
  ALLOWED: new Set([
    'application/pdf',
    'application/json',
    'application/x-sql',
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/yaml',
    'text/javascript',
    'application/x-javascript',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/zip',
    'application/gzip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
} as const;

export const DocumentErrors = {
  NOT_FOUND: 'Document not found',
  MISSING: 'No file was provided',
  INVALID_TYPE: 'File type not allowed',
  TOO_LARGE: 'File exceeds the 10 MB size limit',
} as const;

export default { MimePolicy, DocumentErrors };