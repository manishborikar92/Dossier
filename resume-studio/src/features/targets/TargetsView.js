'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cx } from '@/lib/client/cx';
import { Button, Check, EmptyState, Field, PageSkeleton, StatusBadge, TagsInput } from '@/components/ui';
import PageHeader from '@/components/layout/PageHeader';
import { useStore } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { createResume } from '@/lib/client/actions';
import { analyzeJD, tailor } from '@/lib/domain/tailor';
import { uid } from '@/lib/domain/ids';
import KeywordAnalysis from './KeywordAnalysis.js';

export default function TargetsView() {
  const store = useStore();
  const { data, update, error, reload } = store;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [sel, setSel] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data && sel === null) setSel(data.targets[0]?.id ?? null); }, [data, sel]);
  const target = data?.targets.find((t) => t.id === sel) || null;
  const kws = useMemo(() => (target ? analyzeJD(target.jd, target.keywords) : []), [target]);
  const plan = useMemo(() => (data && target && kws.length ? tailor(data, target) : null), [data, target, kws]);

  if (!data) {
    return error
      ? <div className="page"><EmptyState icon="alert" title="Could not load your data" action={<Button variant="primary" onClick={reload}>Try again</Button>}>{error}</EmptyState></div>
      : <PageSkeleton />;
  }

  const set = (patch) => update('targets', (arr) => arr.map((t) => (t.id === sel ? { ...t, ...patch } : t)));
  const add = () => {
    const t = { id: uid('target'), name: 'New target', kind: 'job', company: '', jd: '', keywords: [], focusProjectIds: [], notes: '' };
    update('targets', (arr) => [...arr, t]);
    setSel(t.id);
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete "${target.name}"?`, body: 'Resumes that used this target are kept.', confirmLabel: 'Delete target', danger: true }))) return;
    update('targets', (arr) => arr.filter((t) => t.id !== sel));
    setSel(data.targets.find((t) => t.id !== sel)?.id ?? null);
  };
  const make = async () => {
    setBusy(true);
    try {
      const r = await createResume(store, { mode: 'tailor', targetId: target.id, name: name.trim() || `${target.name}, tailored` });
      toast({ tone: 'ok', title: 'Tailored resume created', description: r.name });
      router.push(`/resume/${r.id}`);
    } catch (e) { toast({ tone: 'error', title: 'Could not create the resume', description: e.message }); } finally { setBusy(false); }
  };
  const projects = data.projects.filter((p) => p.visible !== false);
  const toggleFocus = (id) => set({ focusProjectIds: target.focusProjectIds.includes(id) ? target.focusProjectIds.filter((x) => x !== id) : [...target.focusProjectIds, id] });

  return (
    <div className="page page--wide">
      <PageHeader
        title="Targets"
        description="A target is a job description or a focus, like leading with your 3D work. Paste it in to see what your library can honestly offer."
        actions={<Button icon="plus" onClick={add}>Add target</Button>}
      />
      {!data.targets.length ? (
        <EmptyState icon="target" title="No targets yet" action={<Button variant="primary" icon="plus" onClick={add}>Add your first target</Button>}>
          Add a job description and Resume Studio will show which keywords you cover.
        </EmptyState>
      ) : (
        <div className="master">
          <div className="master__list">
            <ul className="itemlist" aria-label="Targets">
              {data.targets.map((t) => (
                <li key={t.id}>
                  <button type="button" aria-current={t.id === sel ? 'true' : undefined} className={cx('itemlist__btn', t.id === sel && 'is-on')} onClick={() => setSel(t.id)}>
                    <span className="itemlist__title">{t.name || <em>Untitled</em>}</span>
                    <span className="itemlist__meta"><span>{t.kind === 'focus' ? 'Focus' : 'Job'}</span>{t.company && <span>{t.company}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {target && (
            <div className="master__detail">
              <div className="form">
                <div className="form__head"><h2 className="form__title">Job description</h2><Button variant="danger" size="sm" icon="trash" onClick={remove}>Delete target</Button></div>
                <div className="form__row">
                  <Field label="Name"><input className="input" value={target.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                  <Field label="Company" hint="Optional."><input className="input" value={target.company} onChange={(e) => set({ company: e.target.value })} /></Field>
                </div>
                <Field label="Type">
                  <select className="select" value={target.kind} onChange={(e) => set({ kind: e.target.value })}>
                    <option value="job">Job or opportunity: paste the job description</option>
                    <option value="focus">Focus: highlight the projects you choose</option>
                  </select>
                </Field>
                <Field label="Job description or notes" hint="Paste the full text. Keywords come from a built-in technology dictionary, so nothing is sent anywhere.">
                  <textarea className="textarea" rows={12} value={target.jd} onChange={(e) => set({ jd: e.target.value })} />
                </Field>
                <Field label="Must-have keywords" hint="Comma separated, optional. These count for more. Anything outside the dictionary is matched as plain text.">
                  <TagsInput key={target.id} value={target.keywords} onChange={(k) => set({ keywords: k })} />
                </Field>
                <fieldset className="fieldset">
                  <legend>Always feature these projects</legend>
                  <div className="checklist">
                    {projects.map((p) => (
                      <div key={p.id} className="checklist__row">
                        <Check label={p.title} checked={target.focusProjectIds.includes(p.id)} onChange={() => toggleFocus(p.id)} />
                        {!p.bullets.some((b) => b.status === 'confident') && <StatusBadge status="prep" />}
                      </div>
                    ))}
                  </div>
                </fieldset>
              </div>

              <section className="form" aria-labelledby="offer-h">
                <h2 id="offer-h" className="form__title">What your library can offer</h2>
                {plan ? <KeywordAnalysis plan={plan} data={data} /> : <p className="muted">Paste a job description above to see matching keywords.</p>}
              </section>

              <div className="actionbar">
                <Field label="Name for the new resume" className="actionbar__name">
                  <input className="input" placeholder={`${target.name}, tailored`} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Button variant="primary" icon="sparkle" loading={busy} onClick={make}>Create tailored resume</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
