'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, Field } from '@/components/ui';
import { useStore } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { createResume } from '@/lib/client/actions';

const MODES = [
  { value: 'tailor', title: 'Tailor for a job', text: 'Picks your best confident items for a job description and fits your page target.' },
  { value: 'default', title: 'My default content', text: 'Everything marked Confident, in library order.' },
  { value: 'duplicate', title: 'Copy of an existing resume', text: 'Same content and formatting, ready to change.' },
];

export default function NewResumeDialog({ open, onClose }) {
  const store = useStore();
  const { data } = store;
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState('tailor');
  const [name, setName] = useState('');
  const [targetId, setTargetId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const noTargets = !data.targets.length;
  const noResumes = !data.resumes.length;
  const effectiveMode = (mode === 'tailor' && noTargets) ? 'default' : mode;

  const create = async () => {
    setBusy(true);
    try {
      const r = await createResume(store, {
        name: name.trim(), mode: effectiveMode, targetId: targetId || data.targets[0]?.id, sourceId: sourceId || data.resumes[0]?.id,
      });
      toast({ tone: 'ok', title: 'Resume created', description: r.name });
      onClose();
      router.push(`/resume/${r.id}`);
    } catch (e) {
      toast({ tone: 'error', title: 'Could not create the resume', description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <Dialog
      open={open} onClose={onClose} title="New resume"
      description="Resumes are recipes built from your library. Choose where this one starts."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={create}>Create resume</Button></>}
    >
      <fieldset className="choices">
        <legend className="sr-only">Start from</legend>
        {MODES.map((m) => {
          const disabled = (m.value === 'tailor' && noTargets) || (m.value === 'duplicate' && noResumes);
          return (
            <label key={m.value} className={`choice${effectiveMode === m.value ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
              <input type="radio" name="mode" value={m.value} checked={effectiveMode === m.value} disabled={disabled} onChange={() => setMode(m.value)} />
              <span><strong>{m.title}</strong><small>{disabled ? (m.value === 'tailor' ? 'Add a job target first.' : 'You have no resumes yet.') : m.text}</small></span>
            </label>
          );
        })}
      </fieldset>
      {effectiveMode === 'tailor' && (
        <Field label="Job target">
          <select className="select" value={targetId || data.targets[0]?.id || ''} onChange={(e) => setTargetId(e.target.value)}>
            {data.targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      {effectiveMode === 'duplicate' && (
        <Field label="Resume to copy">
          <select className="select" value={sourceId || data.resumes[0]?.id || ''} onChange={(e) => setSourceId(e.target.value)}>
            {data.resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Name" hint="Optional. Leave it empty and we will name it for you.">
        <input className="input" value={name} placeholder="Acme, backend developer" onChange={(e) => setName(e.target.value)} />
      </Field>
    </Dialog>
  );
}
