// Thin fetch wrapper that turns server validation errors into readable messages.
export async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = body?.issues ? `${body.error}: ${body.issues.join('; ')}` : body?.error || text || res.statusText;
    throw new Error(detail);
  }
  return body;
}
