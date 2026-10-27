import { backupDir, databasePath, openDb, resolveDataDir } from '../src/server/db';
import { seedSample } from '../src/server/sample';

// Adds clearly fictional sample data to an EMPTY library so you can try the app.
const dir = resolveDataDir();
const db = openDb(databasePath(dir), { safetyBackupDir: backupDir(dir) });
try {
  seedSample(db);
  console.log(`Sample data added to ${databasePath(dir)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
