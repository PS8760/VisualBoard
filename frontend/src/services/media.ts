/**
 * Client-side media helpers: upload pre-validation (fail fast, before any
 * bytes leave the browser) and image downscaling for canvas images.
 *
 * Canvas images are stored inline in the element as a compact data URL, so
 * they render identically for every collaborator, survive reloads and are
 * captured by version snapshots. (A `blob:` URL only exists in the tab that
 * created it — persisting one produced broken images for everyone else.)
 */

/** Mirrors backend document.constants MimePolicy. */
export const ALLOWED_UPLOAD_TYPES = [
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
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Element `content` is capped at 100k chars server-side; stay under it. */
const MAX_DATA_URL_CHARS = 95_000;

export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 10 MB`;
  if (file.size === 0) return `${file.name} is empty`;
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name}: this file type can't be attached`;
  }
  return null;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Re-encodes an image to fit the inline budget, shrinking quality first and
 * then dimensions. Returns the natural size of the encoded image.
 */
export async function imageToInlineDataUrl(
  file: Blob,
  maxEdge = 1280,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const decoded = await decode(file);
  try {
    let edge = Math.min(maxEdge, Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');

    for (let attempt = 0; attempt < 8; attempt++) {
      const ratio = Math.min(1, edge / Math.max(decoded.width, decoded.height));
      canvas.width = Math.max(1, Math.round(decoded.width * ratio));
      canvas.height = Math.max(1, Math.round(decoded.height * ratio));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.86, 0.72, 0.58]) {
        let dataUrl = canvas.toDataURL('image/webp', quality);
        // Browsers without a WebP encoder silently return PNG.
        if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_DATA_URL_CHARS) {
          return { dataUrl, width: canvas.width, height: canvas.height };
        }
      }
      edge = Math.round(edge * 0.72);
    }
    throw new Error('Image is too detailed to embed — attach it as a document instead');
  } finally {
    decoded.close();
  }
}
