import { readAll } from '../../../lib/store.js';
import { measure, fitResume } from '../../../lib/fit.js';
import { json, fail } from '../../../lib/http.js';

export const dynamic = 'force-dynamic';

// { action: 'measure' | 'fit', resume, target }  ->  exact page count (from the real PDF renderer)
export async function POST(request) {
  try {
    const { action, resume, target } = await request.json();
    if (!resume) return json({ error: 'resume is required' }, 400);
    const data = await readAll();
    if (action === 'fit') return json(await fitResume(data, resume, Number(target) || 2));
    return json({ pages: await measure(data, resume) });
  } catch (e) { return fail(e); }
}
