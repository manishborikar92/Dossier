'use client';

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, Dialog, IconButton } from '../ui';

/** Reorder / edit / delete controls shown on every library row. */
export function RowActions({
  index,
  count,
  label,
  onMove,
  onEdit,
  onDelete,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton label={`Move ${label} up`} icon={ArrowUp} disabled={index === 0} onClick={() => onMove(-1)} />
      <IconButton label={`Move ${label} down`} icon={ArrowDown} disabled={index === count - 1} onClick={() => onMove(1)} />
      <Button size="sm" onClick={onEdit} aria-label={`Edit ${label}`} className="mx-1">
        <Pencil className="size-3.5" aria-hidden />
        Edit
      </Button>
      <IconButton label={`Delete ${label}`} icon={Trash2} tone="danger" onClick={onDelete} />
    </div>
  );
}

export function FormDialog({
  open,
  title,
  description,
  onClose,
  onSave,
  saving,
  children,
  size,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={onSave}>
            Save
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/** The row at the top of each tab: a short explanation and the main "add" action. */
export function TabIntro({ children, addLabel, onAdd }: { children: ReactNode; addLabel: string; onAdd: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted max-w-2xl text-sm">{children}</p>
      <Button variant="primary" onClick={onAdd}>
        <Plus className="size-4" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

export const usedBadge = (n: number): ReactNode => (n > 0 ? <Badge title="Resumes that contain a copy of this">Used in {n}</Badge> : null);

export type { LucideIcon };
