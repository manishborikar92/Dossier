'use client';
import { Icon } from '@/components/ui';
import { useStore } from '@/components/providers/StoreProvider';

/** Global autosave status, announced politely to screen readers. */
export default function SaveIndicator() {
  const { status, error } = useStore();
  let body = null;
  if (error && status === 'error') body = <span className="save save--error" title={error}><Icon name="alert" size={14} />Could not save. {error.slice(0, 80)}</span>;
  else if (status === 'saving') body = <span className="save"><span className="spinner spinner--sm" aria-hidden="true" />Saving</span>;
  else if (status === 'saved') body = <span className="save save--ok"><Icon name="check" size={14} />All changes saved</span>;
  return <div className="save-wrap" aria-live="polite">{body}</div>;
}
