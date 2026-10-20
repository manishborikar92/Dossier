'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button, Dialog } from '@/components/ui';

const ConfirmContext = createContext(async () => true);

/** const confirm = useConfirm();  if (await confirm({ title, body, confirmLabel, danger })) { ... } */
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);
  const confirm = useCallback((o) => new Promise((resolve) => { resolver.current = resolve; setOpts(o); }), []);
  const finish = (answer) => { resolver.current?.(answer); resolver.current = null; setOpts(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!opts} onClose={() => finish(false)} size="sm" title={opts?.title || 'Are you sure?'}
        footer={(
          <>
            <Button variant="ghost" onClick={() => finish(false)}>{opts?.cancelLabel || 'Cancel'}</Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => finish(true)}>{opts?.confirmLabel || 'Continue'}</Button>
          </>
        )}
      >
        {opts?.body && <p className="dialog__text">{opts.body}</p>}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
