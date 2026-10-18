import { readAll } from '../../../../lib/store.js';
import { buildModel } from '../../../../lib/model.js';
import { renderDocx } from '../../../../lib/render-docx.js';
import { renderPdf } from '../../../../lib/render-pdf.js';
import { renderText } from '../../../../lib/render-text.js';
import { fail } from '../../../../lib/http.js';

export const dynamic = 'force-dynamic';

const TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
};

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'docx').toLowerCase();
    if (!TYPES[format]) return new Response('Unknown format', { status: 400 });
    const data = await readAll();
    const resume = data.resumes.find((r) => r.id === id);
    if (!resume) return new Response('Resume not found', { status: 404 });

    const model = buildModel(data, resume);
    const meta = { author: data.profile.name, title: `${data.profile.name} - ${resume.name}` };
    let body;
    if (format === 'docx') body = await renderDocx(model, meta);
    else if (format === 'pdf') body = await renderPdf(model, meta);
    else body = renderText(model);

    const base = (resume.options?.fileName || `${data.profile.name}-Resume`).replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-') || 'Resume';
    const disposition = format === 'pdf' && url.searchParams.get('inline') ? 'inline' : 'attachment';
    return new Response(body, {
      headers: { 'Content-Type': TYPES[format], 'Content-Disposition': `${disposition}; filename="${base}.${format}"`, 'Cache-Control': 'no-store' },
    });
  } catch (e) { return fail(e); }
}
