import { mkdir, writeFile, readFile, unlink, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
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
    return join(this.dir, key);
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
