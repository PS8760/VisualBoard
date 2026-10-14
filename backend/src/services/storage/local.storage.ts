import { createReadStream } from 'node:fs';
import { mkdir, writeFile, readFile, unlink, access, stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { join, resolve, dirname, sep } from 'node:path';
import type { StorageDriver } from './driver.js';

/**
 * Local-disk storage driver (development default).
 * Files live under STORAGE_LOCAL_DIR, keyed by hashed safe names.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private dir: string;

  constructor(dir: string) {
    this.dir = resolve(dir);
  }

  private pathFor(key: string): string {
    // Keys are server-generated, but never let one escape the upload root.
    const target = resolve(join(this.dir, key));
    if (!target.startsWith(this.dir + sep) && target !== this.dir) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async save(key: string, data: Buffer): Promise<{ key: string; existed: boolean }> {
    await mkdir(this.dir, { recursive: true });
    const target = this.pathFor(key);
    let existed = true;
    try {
      await access(target);
    } catch {
      existed = false;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    return { key, existed };
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async stream(key: string): Promise<{ body: Readable; size?: number } | null> {
    try {
      const path = this.pathFor(key);
      const info = await stat(path);
      return { body: createReadStream(path), size: info.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await unlink(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  getUrl(_key: string): string | null {
    // Local storage is only reachable through the API download endpoint.
    return null;
  }
}

export default LocalStorageDriver;
