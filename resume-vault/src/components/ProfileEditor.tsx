'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { issuesToFields, profileSchema } from '@/lib/schemas';
import type { ProfileData } from '@/lib/types';
import { Button, TextArea, TextField, useToast } from './ui';

interface FormState {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { id?: number; label: string; url: string }[];
  summaries: { id?: number; label: string; text: string }[];
}

export function ProfileEditor({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    fullName: initial.fullName,
    headline: initial.headline,
    email: initial.email,
    phone: initial.phone,
    location: initial.location,
    links: initial.links.map((l) => ({ ...l })),
    summaries: initial.summaries.map((s) => ({ id: s.id, label: s.label, text: s.text })),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      toast.error('Some fields need attention. They are marked below.');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = await api<ProfileData>('/api/profile', { method: 'PUT', body: parsed.data });
      setForm((f) => ({ ...f, links: saved.links.map((l) => ({ ...l })), summaries: saved.summaries.map((s) => ({ id: s.id, label: s.label, text: s.text })) }));
      toast.success('Profile saved.');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="identity" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="identity" className="mb-4 font-serif text-lg font-semibold">
          Identity and contact
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" required value={form.fullName} onChange={(v) => set('fullName', v)} error={errors.fullName} />
          <TextField label="Professional headline" value={form.headline} onChange={(v) => set('headline', v)} error={errors.headline} hint="Optional. For example: Full-stack developer." />
          <TextField label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} error={errors.email} />
          <TextField label="Phone" value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone} />
          <TextField label="Location" value={form.location} onChange={(v) => set('location', v)} error={errors.location} className="sm:col-span-2" hint="City and country, as you want it printed." />
        </div>
      </section>

      <section aria-labelledby="links" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="links" className="font-serif text-lg font-semibold">
          Links
        </h2>
        <p className="mb-4 text-sm text-muted">The text is what appears on the resume. The address is where it links to.</p>
        <div className="space-y-3">
          {form.links.map((l, i) => (
            <div key={i} className="grid items-start gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <TextField label="Text on resume" value={l.label} onChange={(v) => set('links', form.links.map((x, j) => (j === i ? { ...x, label: v } : x)))} error={errors[`links.${i}.label`]} />
              <TextField label="Address" value={l.url} placeholder="https://" onChange={(v) => set('links', form.links.map((x, j) => (j === i ? { ...x, url: v } : x)))} error={errors[`links.${i}.url`]} />
              <Button className="sm:mt-6" aria-label={`Remove link ${i + 1}`} onClick={() => set('links', form.links.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-3" onClick={() => set('links', [...form.links, { label: '', url: '' }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add link
        </Button>
      </section>

      <section aria-labelledby="summaries" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="summaries" className="font-serif text-lg font-semibold">
          Summary variants
        </h2>
        <p className="mb-4 text-sm text-muted">Write a few versions of your professional summary, such as one for full-stack roles and one for data roles. Each resume picks one and can edit its own copy.</p>
        <div className="space-y-4">
          {form.summaries.map((s, i) => (
            <div key={i} className="rounded-md border border-rule p-3">
              <div className="grid items-start gap-2 sm:grid-cols-[14rem_1fr_auto]">
                <TextField label="Label" value={s.label} onChange={(v) => set('summaries', form.summaries.map((x, j) => (j === i ? { ...x, label: v } : x)))} error={errors[`summaries.${i}.label`]} />
                <TextArea label="Summary" rows={4} value={s.text} onChange={(v) => set('summaries', form.summaries.map((x, j) => (j === i ? { ...x, text: v } : x)))} error={errors[`summaries.${i}.text`]} />
                <Button className="sm:mt-6" aria-label={`Remove summary ${i + 1}`} onClick={() => set('summaries', form.summaries.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-3" onClick={() => set('summaries', [...form.summaries, { label: '', text: '' }])}>
          <Plus className="h-4 w-4" aria-hidden />
          Add summary variant
        </Button>
      </section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button variant="primary" loading={saving} onClick={save}>
          Save profile
        </Button>
      </div>
    </div>
  );
}
