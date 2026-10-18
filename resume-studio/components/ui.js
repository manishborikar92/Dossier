'use client';

export const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

export const STATUS_LABEL = { confident: 'Confident', prep: 'Needs review', exclude: 'Excluded' };

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function StatusPicker({ value, onChange }) {
  return (
    <span className="seg" role="group" aria-label="Status">
      {['confident', 'prep', 'exclude'].map((s) => (
        <button key={s} type="button" className={`${value === s ? 'on' : ''} ${s}`} onClick={() => onChange(s)}>{STATUS_LABEL[s]}</button>
      ))}
    </span>
  );
}

export function SaveBadge({ status, error }) {
  if (error) return <span className="badge" style={{ background: '#fde7e5', color: '#a1271b' }} title={error}>Save failed</span>;
  if (status === 'saving') return <span className="muted small">Saving…</span>;
  if (status === 'saved') return <span className="muted small">All changes saved</span>;
  return null;
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="small muted" style={{ marginTop: 3 }}>{hint}</span>}
    </label>
  );
}

export const csv = (arr = []) => arr.join(', ');
export const parseCsv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
