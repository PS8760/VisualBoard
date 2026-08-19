import { env } from '../../config/env.js';
import { LocalStorageDriver } from './local.storage.js';
import { S3StorageDriver } from './s3.storage.js';
import type { StorageDriver } from './driver.js';
import { logger } from '../../utils/logger.js';

let driver: StorageDriver;

export function getStorage(): StorageDriver {
  if (driver) return driver;

  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_BUCKET) {
      throw new Error('[storage] STORAGE_DRIVER=s3 requires S3_BUCKET to be configured');
    }
    driver = new S3StorageDriver({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    });
    logger.info('[storage] using S3-compatible driver');
  } else {
    driver = new LocalStorageDriver(env.STORAGE_LOCAL_DIR);
    logger.info({ dir: env.STORAGE_LOCAL_DIR }, '[storage] using local disk driver');
  }

  return driver;
}

export default getStorage;
