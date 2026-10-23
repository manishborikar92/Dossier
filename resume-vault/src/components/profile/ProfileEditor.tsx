'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { issuesToFields, profileSchema } from '@/lib/schemas';
import type { ProfileData } from '@/lib/types';
import { Badge, Button, IconButton, SectionCard, TextArea, TextField, useToast } from '../ui';

interface FormState {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { id?: number; label: string; url: string }[];
  summaries: { id?: number; label: string; text: string }[];
}

const toForm = (p: ProfileData): FormState => ({
  fullName: p.fullName,
  headline: p.headline,
  email: p.email,
  phone: p.phone,
  location: p.location,
  links: p.links.map((l) => ({ ...l })),
  summaries: p.summaries.map((s) => ({ id: s.id, label: s.label, text: s.text })),
});

export function ProfileEditor({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const toast = useToast();
  const [baseline, setBaseline] = useState<FormState>(() => toForm(initial));
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

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
      const saved = await api.profile.save(parsed.data);
      const next = toForm(saved);
      setForm(next);
      setBaseline(next);
      toast.success('Profile saved.');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const contactPreview = [form.location, form.email, form.phone, ...form.links.map((l) => l.label)].filter(Boolean).join('  ·  ');

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <SectionCard
          id="identity"
          title="Identity and contact"
          description="This is the header of every resume. Each resume can still hide individual details."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              required
              value={form.fullName}
              onChange={(v) => set('fullName', v)}
              error={errors.fullName}
              autoComplete="name"
            />
            <TextField
              label="Professional headline"
              value={form.headline}
              onChange={(v) => set('headline', v)}
              error={errors.headline}
              hint="Optional, e.g. Full-stack developer."
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => set('email', v)}
              error={errors.email}
              autoComplete="email"
            />
            <TextField label="Phone" value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone} autoComplete="tel" />
            <TextField
              label="Location"
              value={form.location}
              onChange={(v) => set('location', v)}
              error={errors.location}
              className="sm:col-span-2"
              hint="City and country, as you want it printed."
            />
          </div>
        </SectionCard>

        <SectionCard
          id="links"
          title="Links"
          description="The text is what appears on the resume. The address is where it links to."
          action={
            <Button size="sm" onClick={() => set('links', [...form.links, { label: '', url: '' }])}>
              <Plus className="size-4" aria-hidden />
              Add link
            </Button>
          }
        >
          {form.links.length === 0 ? <p className="text-muted text-sm">No links yet. Add your LinkedIn, GitHub or portfolio.</p> : null}
          <div className="space-y-3">
            {form.links.map((l, i) => (
              <div key={l.id ?? `new-${i}`} className="grid items-start gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                <TextField
                  label="Text on resume"
                  value={l.label}
                  onChange={(v) =>
                    set(
                      'links',
                      form.links.map((x, j) => (j === i ? { ...x, label: v } : x)),
                    )
                  }
                  error={errors[`links.${i}.label`]}
                />
                <TextField
                  label="Address"
                  value={l.url}
                  placeholder="https://"
                  onChange={(v) =>
                    set(
                      'links',
                      form.links.map((x, j) => (j === i ? { ...x, url: v } : x)),
                    )
                  }
                  error={errors[`links.${i}.url`]}
                />
                <IconButton
                  label={`Remove link ${i + 1}`}
                  icon={Trash2}
                  tone="danger"
                  className="sm:mt-7"
                  onClick={() =>
                    set(
                      'links',
                      form.links.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          id="summaries"
          title="Summary variants"
          description="Write a few versions of your professional summary, such as one for full-stack roles and one for data roles. Each resume picks one and edits its own copy."
          action={
            <Button size="sm" onClick={() => set('summaries', [...form.summaries, { label: '', text: '' }])}>
              <Plus className="size-4" aria-hidden />
              Add variant
            </Button>
          }
        >
          {form.summaries.length === 0 ? <p className="text-muted text-sm">No summaries yet.</p> : null}
          <div className="space-y-4">
            {form.summaries.map((s, i) => (
              <div
                key={s.id ?? `new-${i}`}
                className="border-line bg-sunken grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[13rem_1fr_auto]"
              >
                <TextField
                  label="Label"
                  value={s.label}
                  onChange={(v) =>
                    set(
                      'summaries',
                      form.summaries.map((x, j) => (j === i ? { ...x, label: v } : x)),
                    )
                  }
                  error={errors[`summaries.${i}.label`]}
                />
                <TextArea
                  label="Summary"
                  rows={4}
                  value={s.text}
                  onChange={(v) =>
                    set(
                      'summaries',
                      form.summaries.map((x, j) => (j === i ? { ...x, text: v } : x)),
                    )
                  }
                  error={errors[`summaries.${i}.text`]}
                />
                <IconButton
                  label={`Remove summary ${i + 1}`}
                  icon={Trash2}
                  tone="danger"
                  className="sm:mt-7"
                  onClick={() =>
                    set(
                      'summaries',
                      form.summaries.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="border-line bg-surface shadow-card rounded-xl border p-5">
          <p className="text-muted mb-3 text-[11px] font-semibold tracking-wider uppercase">Header preview</p>
          <p className="text-brand text-lg font-semibold tracking-tight">{form.fullName || 'Your name'}</p>
          {form.headline ? <p className="text-ink-2 text-sm">{form.headline}</p> : null}
          <p className="text-muted mt-1 text-xs leading-relaxed break-words">{contactPreview || 'Your contact details appear here.'}</p>
        </div>
        <div className="border-line bg-surface shadow-card rounded-xl border p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-ink text-sm font-semibold">Changes</p>
            {dirty ? <Badge tone="warn">Unsaved</Badge> : <Badge tone="ok">Saved</Badge>}
          </div>
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={save} className="w-full">
            Save profile
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => {
                setForm(baseline);
                setErrors({});
              }}
            >
              Discard changes
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
