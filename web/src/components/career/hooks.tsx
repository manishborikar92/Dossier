'use client';

import { useCallback, useState } from 'react';
import type { z } from 'zod';
import { ApiError, api, errorMessage, type EntityInput, type EntityRecord } from '@/lib/api';
import { issuesToFields } from '@/lib/schemas';
import type { EntityName } from '@/lib/types';
import { ConfirmDialog, useToast } from '../ui';

interface Used {
  id: number;
  usedInCount: number;
}

/** A library list that can be reloaded and reordered. */
export function useEntityList<E extends EntityName>(entity: E, initial: EntityRecord<E>[]) {
  const toast = useToast();
  const [items, setItems] = useState<EntityRecord<E>[]>(initial);
  const reload = useCallback(async () => {
    setItems(await api.library.list(entity));
  }, [entity]);
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    try {
      await api.library.reorder(
        entity,
        next.map((i) => (i as { id: number }).id),
      );
    } catch (error) {
      toast.error(errorMessage(error));
      await reload();
    }
  };
  return { items, reload, move };
}

/** State and save logic for an add/edit dialog. `D` is the shape of the draft being edited. */
export function useEntityEditor<E extends EntityName, D extends object>(
  entity: E,
  schema: z.ZodType<EntityInput<E>>,
  onSaved: () => Promise<void>,
  savedMessage: string,
) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: number | null; draft: D } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (draft: D, id: number | null = null) => {
    setErrors({});
    setEditing({ id, draft });
  };
  const patch = (changes: Partial<D>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...changes } } : e));
  const save = async () => {
    if (!editing) return;
    const parsed = schema.safeParse(editing.draft);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      return;
    }
    setSaving(true);
    try {
      if (editing.id === null) await api.library.create(entity, parsed.data);
      else await api.library.update(entity, editing.id, parsed.data);
      await onSaved();
      toast.success(savedMessage);
      setEditing(null);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return { editing, errors, saving, open, patch, save, close: () => setEditing(null) };
}

/** Delete with a confirmation that says how many resumes use the item. */
export function useDeleter(entity: EntityName, onDeleted: () => Promise<void>, noun: string) {
  const toast = useToast();
  const [target, setTarget] = useState<(Used & { label: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.library.remove(entity, target.id);
      await onDeleted();
      toast.success(`${noun} deleted.`);
      setTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title={`Delete this ${noun.toLowerCase()}?`}
      confirmLabel="Delete"
      danger
      busy={busy}
      onConfirm={confirm}
      onCancel={() => setTarget(null)}
    >
      <p>
        <strong>{target?.label}</strong> will be removed from your library.
      </p>
      <p className="text-muted mt-2">
        {target && target.usedInCount > 0
          ? `It is used in ${target.usedInCount} ${target.usedInCount === 1 ? 'resume' : 'resumes'}. Those resumes keep their own copy, so nothing already written changes.`
          : 'No resume uses it yet.'}
      </p>
    </ConfirmDialog>
  );
  return { ask: (item: Used, label: string) => setTarget({ id: item.id, usedInCount: item.usedInCount, label }), dialog };
}
