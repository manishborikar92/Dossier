import { handle, intParam } from '@/server/http';
import { exportResponse } from '@/server/export/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req, ctx) => exportResponse(req, intParam((await ctx.params).id), 'docx'));
