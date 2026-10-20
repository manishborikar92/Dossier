import { readAll, readCollection, writeCollection } from '@/lib/server/store.js';
import { json, fail } from '@/lib/server/http.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { name } = await params;
    if (name === '_all') {
      const data = await readAll();
      if (new URL(request.url).searchParams.get('download')) {
        return new Response(JSON.stringify(data, null, 2), {
          headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="resume-studio-backup.json"' },
        });
      }
      return json(data);
    }
    return json(await readCollection(name));
  } catch (e) { return fail(e); }
}

export async function PUT(request, { params }) {
  try {
    const { name } = await params;
    return json(await writeCollection(name, await request.json()));
  } catch (e) { return fail(e); }
}
