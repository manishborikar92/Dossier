import type { DB } from './db';
import { appSettingsSchema } from '@/lib/schemas';
import type { z } from 'zod';

export type AppSettings = z.infer<typeof appSettingsSchema>;
const DEFAULTS: AppSettings = { defaultPageSize: 'A4', defaultTemplate: 'classic' };

export function getAppSettings(db: DB): AppSettings {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
  const raw: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) {
    try {
      raw[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore a corrupt value and fall back to the default */
    }
  }
  const parsed = appSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULTS;
}

export function saveAppSettings(db: DB, input: unknown): AppSettings {
  const value = appSettingsSchema.parse(input);
  db.transaction(() => {
    for (const [k, v] of Object.entries(value)) {
      db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
        k,
        JSON.stringify(v),
      );
    }
  })();
  return value;
}
