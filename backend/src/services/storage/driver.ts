/**
 * Storage abstraction for uploaded documents.
 *
 * Business logic only ever talks to this interface, so switching between
 * local disk, S3, or any compatible object store does not touch module code.
 */

export interface StoredFile {
  /** Storage key (stable identifier inside the storage backend). */
  key: string;
  /** Whether the object already existed in storage. */
  existed: boolean;
}

export interface StorageDriver {
  name: string;
  save(key: string, data: Buffer, mimeType: string): Promise<StoredFile>;
  read(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<boolean>;
  /** Signed/absolute URL for direct access when the driver supports it. */
  getUrl(key: string): string | null;
}
