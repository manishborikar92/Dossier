const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2025-06' -> 'Jun 2025'. Returns '' for empty or malformed input. */
export function formatMonth(value: string): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Date range for an entry. An empty end means the role or course is ongoing. */
export function formatRange(start: string, end: string): string {
  const s = formatMonth(start);
  const e = formatMonth(end);
  if (s && e) return s === e ? s : `${s} \u2013 ${e}`;
  if (s) return `${s} \u2013 Present`;
  return e;
}

/** 'https://www.example.com/path/' -> 'example.com/path' (what a reader sees on paper). */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
