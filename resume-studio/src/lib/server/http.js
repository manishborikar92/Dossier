// Tiny helpers shared by the API routes (server only).
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function fail(e) {
  if (e?.name === 'ZodError') {
    const issues = e.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return json({ error: 'Validation failed', issues }, 400);
  }
  return json({ error: e?.message || 'Server error' }, e?.status || 500);
}
