'use client';

import { ArrowDown, ArrowUp, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cx } from '@/lib/classes';
import type { ResumeItem } from '@/lib/types';
import { Badge, Button, IconButton } from '../ui';
import { ItemEditor } from './ItemEditor';
import { itemMeta, itemTitle, unverifiedCount } from './helpers';
import type { Mutate } from './types';

interface Props {
  item: ResumeItem;
  resumeId: number;
  /** Position among its siblings, used to enable the move buttons. */
  index: number;
  count: number;
  compact?: boolean;
  mutate: Mutate;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (item: ResumeItem) => void;
  onReview: (item: ResumeItem) => void;
}

/** One item on a resume: show/hide, reorder, edit its own copy, or remove it. */
export function ItemRow({ item, resumeId, index, count, compact, mutate, onMove, onRemove, onReview }: Props) {
  const [editing, setEditing] = useState(false);
  const unverified = unverifiedCount(item);
  const title = itemTitle(item);
  const meta = itemMeta(item);
  const isHeader = item.section === 'header';

  return (
    <li className={cx('border-line rounded-lg border', item.included ? 'bg-surface' : 'bg-sunken')}>
      <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3', compact ? 'py-1.5' : 'py-2.5')}>
        {!isHeader ? (
          <input
            type="checkbox"
            checked={item.included}
            aria-label={`Show ${title} on this resume`}
            onChange={(e) => void mutate(() => api.resumes.updateItem(resumeId, item.id, { included: e.target.checked }))}
            className="accent-brand size-4 shrink-0"
          />
        ) : null}
        <div className="min-w-0 flex-1 basis-40">
          <p
            className={cx(
              'text-ink text-sm font-medium break-words',
              compact ? 'truncate' : 'line-clamp-2',
              !item.included && 'text-muted line-through',
            )}
          >
            {title}
          </p>
          {meta && !compact ? <p className="text-muted line-clamp-1 text-xs break-words">{meta}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.sync === 'changed' ? (
            <button
              type="button"
              onClick={() => onReview(item)}
              className="bg-warn-soft text-warn ring-warn/20 hover:bg-warn/10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset"
            >
              <RefreshCw className="size-3" aria-hidden />
              Library changed. Review
            </button>
          ) : null}
          {item.sync === 'missing' ? (
            <Badge title="The library entry this was copied from has been deleted. This resume keeps its own copy.">
              Deleted from library
            </Badge>
          ) : null}
          {unverified > 0 ? (
            <Badge tone="warn" title="Printed bullets not marked verified in your library">
              {unverified} unverified
            </Badge>
          ) : null}
        </div>
        <div className="ml-auto flex shrink-0 items-center">
          {!isHeader ? (
            <>
              <IconButton label={`Move ${title} up`} icon={ArrowUp} disabled={index === 0} onClick={() => onMove(index, -1)} />
              <IconButton label={`Move ${title} down`} icon={ArrowDown} disabled={index === count - 1} onClick={() => onMove(index, 1)} />
            </>
          ) : null}
          <Button
            size="sm"
            className="mx-1"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            aria-label={`${editing ? 'Close editor for' : 'Edit'} ${title}`}
          >
            <Pencil className="size-3.5" aria-hidden />
            {editing ? 'Close' : 'Edit'}
          </Button>
          {!isHeader ? (
            <IconButton label={`Remove ${title} from this resume`} icon={Trash2} tone="danger" onClick={() => onRemove(item)} />
          ) : null}
        </div>
      </div>
      {editing ? (
        <ItemEditor
          item={item}
          onCancel={() => setEditing(false)}
          onSave={async (data) => {
            const ok = await mutate(() => api.resumes.updateItem(resumeId, item.id, { data }), 'Changes saved to this resume.');
            if (ok) setEditing(false);
          }}
        />
      ) : null}
    </li>
  );
}
