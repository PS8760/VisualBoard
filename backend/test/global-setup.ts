import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Stands up the isolated test database before the suite runs:
 *  - creates it (Postgres) if it does not exist
 *  - applies the same migrations as production (`prisma migrate deploy`)
 */
export default function globalSetup() {
  const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
  dotenv.config({ path: path.join(root, '.env') });

  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST must be set to run the test suite');
  }

  const { hostname, port, pathname } = new URL(testUrl);
  const dbName = pathname.replace(/^\//, '');
  const adminUrl = `${testUrl.slice(0, testUrl.lastIndexOf('/'))}/postgres`;

  try {
    execSync(
      `psql "${adminUrl}" -tc "SELECT 1 FROM pg_database WHERE datname = '${dbName}'" | grep -q 1 || psql "${adminUrl}" -c "CREATE DATABASE \\"${dbName}\\""`,
      { stdio: 'pipe' },
    );

    execSync('npx prisma migrate deploy', {
      cwd: root,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: testUrl,
        NODE_ENV: 'test',
      },
    });
  } catch (err) {
    const detail = (err as { stderr?: Buffer }).stderr?.toString() ?? (err as Error).message;
    throw new Error(`[test] failed to prepare test database: ${detail}`);
  }

  // eslint-disable-next-line no-console
  console.log(`[test] test database ready at postgres://…@${hostname}:${port}/${dbName}`);
}