import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type { StorageDriver } from './driver.js';

interface S3Options {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible storage driver (AWS S3, MinIO, R2, GCS interop, ...).
 * Configured exclusively through environment variables.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private client: S3Client;
  private bucket: string;

  constructor(opts: S3Options) {
    this.bucket = opts.bucket;
    this.client = new S3Client({
      region: opts.region ?? 'us-east-1',
      endpoint: opts.endpoint || undefined,
      forcePathStyle: opts.forcePathStyle ?? Boolean(opts.endpoint),
      credentials: opts.accessKeyId
        ? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey ?? '' }
        : undefined,
    });
  }

  async save(key: string, data: Buffer, mimeType: string): Promise<{ key: string; existed: boolean }> {
    let existed = false;
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      existed = true;
    } catch {
      existed = false;
    }
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: mimeType }),
    );
    return { key, existed };
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = res.Body;
      if (!body) return null;
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  async stream(key: string): Promise<{ body: Readable; size?: number } | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const body = res.Body instanceof Readable ? res.Body : Readable.from(await res.Body.transformToByteArray());
      return { body, size: res.ContentLength };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string | null {
    return `s3://${this.bucket}/${key}`;
  }
}

export default S3StorageDriver;
