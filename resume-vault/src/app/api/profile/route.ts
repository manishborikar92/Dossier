import { getDb } from '@/server/db';
import { handle, json, readJson } from '@/server/http';
import { getProfile, saveProfile } from '@/server/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => json(getProfile(getDb())));

export const PUT = handle(async (req) => json(saveProfile(getDb(), await readJson(req))));
