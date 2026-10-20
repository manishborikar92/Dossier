'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useStore } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { api } from '@/lib/client/api';

/** Re-import the project knowledge base. Only adds; never overwrites anything you wrote. */
export default function KnowledgeBasePanel() {
  const { flush, reload } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (file) => {
    setBusy(true);
    try {
      const body = file ? await file.text() : '';
      await flush();
      const s = await api('/api/import-kb', { method: 'POST', body });
      await reload();
      toast({ tone: 'ok', title: 'Knowledge base merged', description: `${s.added} new projects, ${s.updated} updated, ${s.bulletsAdded} new bullets added as Needs review. Nothing you wrote was overwritten.`, duration: 9000 });
    } catch (e) { toast({ tone: 'error', title: 'Import failed', description: e.message }); } finally { setBusy(false); }
  };

  return (
    <section className="kb" aria-labelledby="kb-h">
      <h3 id="kb-h">Knowledge base</h3>
      <p className="muted">Re-import after your knowledge base changes. It only adds new projects and new bullets (as Needs review) and refreshes the read-only panel on each project. Your edits are never overwritten.</p>
      <div className="row">
        <Button size="sm" loading={busy} onClick={() => run(null)}>Re-import the bundled file</Button>
        <label className="btn btn--secondary btn--sm">
          <span className="btn__label">Import a different file</span>
          <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files[0] && run(e.target.files[0])} />
        </label>
      </div>
    </section>
  );
}
