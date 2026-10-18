import path from 'node:path';
import { backupDir, openDb, resolveDataDir } from '../src/server/db';
import { seedSample } from '../src/server/sample';

// Adds clearly fictional sample data to an EMPTY library so you can try the app.
const dir = resolveDataDir();
const db = openDb(path.join(dir, 'vault.db'), { safetyBackupDir: backupDir(dir) });
try {
  seedSample(db);
  console.log(`Sample data added to ${path.join(dir, 'vault.db')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
