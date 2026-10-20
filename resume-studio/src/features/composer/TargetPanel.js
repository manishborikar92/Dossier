'use client';
import { Button, Field, Icon, MeterBar } from '@/components/ui';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { tailor } from '@/lib/domain/tailor';

const REASON = {
  available: { tone: 'warn', text: 'in your library, not selected' },
  'needs-review': { tone: 'hl', text: 'needs your review' },
  excluded: { tone: 'no', text: 'excluded by you' },
  absent: { tone: 'bad', text: 'not in your library' },
};

export default function TargetPanel({ ed }) {
  const { data, target, cov } = ed;
  const confirm = useConfirm();
  const toast = useToast();

  const retailor = async () => {
    const ok = await confirm({ title: 'Replace the current selection?', body: 'A fresh auto-tailored selection replaces what is ticked now. Your formatting and per-resume wording edits are kept.', confirmLabel: 'Re-run auto-tailor' });
    if (!ok) return;
    ed.patchSel(tailor(data, target).selection);
    toast({ tone: 'ok', title: 'Selection refreshed', description: `Tailored for ${target.name}.` });
  };

  return (
    <div className="panel panel--form">
      <section className="dsec" aria-labelledby="t-h">
        <h3 id="t-h">Target</h3>
        <Field label="This resume is for" hint="Pick a job target to see how well the resume matches its keywords.">
          <select className="select" value={ed.resume.targetId || ''} onChange={(e) => ed.setTarget(e.target.value)}>
            <option value="">No target</option>
            {data.targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        {target && <Button icon="sparkle" onClick={retailor}>Re-run auto-tailor</Button>}
      </section>

      {cov && (
        <section className="dsec" aria-labelledby="t-cov">
          <h3 id="t-cov">Keyword coverage</h3>
          <div className="bigstat">
            <div className="bigstat__n">{cov.pct}<span>%</span></div>
            <MeterBar label={`${cov.pct}% of keywords covered`} segments={[{ tone: 'ok', value: cov.pct }, { tone: 'none', value: 100 - cov.pct }]} />
          </div>
          <ul className="kws">{cov.matched.map((k) => <li key={k.key} className="kw kw--ok"><Icon name="check" size={13} />{k.label}</li>)}</ul>
          <h4 className="small-h">Not on this resume</h4>
          <ul className="kws">{cov.missing.map((k) => <li key={k.key} className={`kw kw--${REASON[k.where].tone}`}><b>{k.label}</b><small>{REASON[k.where].text}</small></li>)}</ul>
        </section>
      )}
    </div>
  );
}
