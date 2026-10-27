'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cx } from '@/lib/classes';
import type { ResumeItem, SyncDiff } from '@/lib/types';
import { Button, Dialog, Notice } from '../ui';
import type { Mutate } from './types';

function Column({ title, lines, other }: { title: string; lines: string[]; other: string[] }) {
  return (
    <div>
      <h3 className="text-ink mb-1.5 text-sm font-semibold">{title}</h3>
      <ul className="border-line bg-sunken space-y-1 rounded-lg border p-2 text-[13px]">
        {lines.length === 0 ? <li className="text-muted px-1">Nothing</li> : null}
        {lines.map((l, i) => (
          <li key={i} className={cx('rounded px-1.5 py-0.5 break-words', !other.includes(l) && 'bg-warn-soft')}>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compare a resume item with its library source and choose which version to keep. */
export function ReviewChangeDialog({
  resumeId,
  item,
  onClose,
  mutate,
}: {
  resumeId: number;
  item: ResumeItem | null;
  onClose: () => void;
  mutate: Mutate;
}) {
  const itemId = item?.id ?? null;
  const [state, setState] = useState<{ key: number; diff: SyncDiff | null; error: string | null }>({ key: 0, diff: null, error: null });

  // Load the comparison whenever a different item is opened.
  useEffect(() => {
    if (itemId === null) return;
    let cancelled = false;
    api.resumes
      .syncDiff(resumeId, itemId)
      .then((diff) => !cancelled && setState({ key: itemId, diff, error: null }))
      .catch((e) => !cancelled && setState({ key: itemId, diff: null, error: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [resumeId, itemId]);

  const current = itemId !== null && state.key === itemId ? state : null;
  const mine = current?.diff?.mine ?? [];
  const lib = current?.diff?.library ?? [];

  const act = async (action: 'pull' | 'keep') => {
    if (!item) return;
    const ok = await mutate(
      () => api.resumes.sync(resumeId, item.id, action),
      action === 'pull' ? 'This resume now has the latest library version.' : 'Kept your version.',
    );
    if (ok) onClose();
  };

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      size="lg"
      title="Your library has changed"
      description="Highlighted lines differ between this resume and your library."
      footer={
        <>
          <Button onClick={onClose}>Decide later</Button>
          <Button onClick={() => act('keep')}>Keep my version</Button>
          <Button variant="primary" onClick={() => act('pull')}>
            Use the library version
          </Button>
        </>
      }
    >
      {current?.error ? (
        <Notice tone="bad" alert>
          {current.error}
        </Notice>
      ) : null}
      {!current ? <p className="text-muted text-sm">Loading the comparison…</p> : null}
      {current?.diff ? (
        <div className="space-y-4">
          <p className="text-ink-2 text-sm">
            <strong>Use the library version</strong> replaces this resume&apos;s copy, including any edits and hidden bullets on it.{' '}
            <strong>Keep my version</strong> leaves it exactly as it is and stops the reminder.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Column title="This resume now" lines={mine} other={lib} />
            <Column title="Library now" lines={lib} other={mine} />
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
