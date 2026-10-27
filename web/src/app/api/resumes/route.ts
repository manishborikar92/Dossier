import { getDb } from '@/server/db';
import { handle, json, readJson } from '@/server/http';
import { createResume, listResumes } from '@/server/resumes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => json(listResumes(getDb())));

export const POST = handle(async (req) => json(createResume(getDb(), await readJson(req)), 201));
