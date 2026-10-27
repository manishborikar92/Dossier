'use client';

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

export interface HeaderData {
  crumbs?: Crumb[];
  actions?: ReactNode;
  title?: string;
}

interface HeaderState {
  crumbs: Crumb[];
  actions: ReactNode | null;
  title?: string;
}

interface HeaderDispatch {
  registerHeader: (id: string, data: HeaderData) => void;
  unregisterHeader: (id: string) => void;
}

export type HeaderContextType = HeaderState & HeaderDispatch;

const HeaderStateContext = createContext<HeaderState>({
  crumbs: [],
  actions: null,
});

const HeaderDispatchContext = createContext<HeaderDispatch>({
  registerHeader: () => undefined,
  unregisterHeader: () => undefined,
});

function areCrumbsEqual(a?: Crumb[], b?: Crumb[]): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((crumb, i) => crumb.label === b[i].label && crumb.href === b[i].href);
}

function areHeaderDataEqual(a: HeaderData, b: HeaderData): boolean {
  if (a.title !== b.title) return false;
  if (!areCrumbsEqual(a.crumbs, b.crumbs)) return false;
  if (a.actions !== b.actions) return false;
  return true;
}

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Record<string, HeaderData>>({});

  const registerHeader = useCallback((id: string, data: HeaderData) => {
    setRegistry((prev) => {
      const curr = prev[id];
      if (curr && areHeaderDataEqual(curr, data)) {
        return prev;
      }
      return { ...prev, [id]: data };
    });
  }, []);

  const unregisterHeader = useCallback((id: string) => {
    setRegistry((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const entries = useMemo(() => Object.values(registry), [registry]);
  const active = entries[entries.length - 1] ?? {};

  const stateValue = useMemo<HeaderState>(
    () => ({
      crumbs: active.crumbs ?? [],
      actions: active.actions ?? null,
      title: active.title,
    }),
    [active.crumbs, active.actions, active.title],
  );

  const dispatchValue = useMemo<HeaderDispatch>(
    () => ({
      registerHeader,
      unregisterHeader,
    }),
    [registerHeader, unregisterHeader],
  );

  return (
    <HeaderDispatchContext.Provider value={dispatchValue}>
      <HeaderStateContext.Provider value={stateValue}>{children}</HeaderStateContext.Provider>
    </HeaderDispatchContext.Provider>
  );
}

export function useHeaderContext(): HeaderContextType {
  const state = useContext(HeaderStateContext);
  const dispatch = useContext(HeaderDispatchContext);
  return {
    ...state,
    ...dispatch,
  };
}

export function useHeaderDispatch(): HeaderDispatch {
  return useContext(HeaderDispatchContext);
}

export function useHeader({ crumbs, actions, title }: HeaderData) {
  const { registerHeader, unregisterHeader } = useHeaderDispatch();
  const id = useId();

  // Update header data whenever props change
  useEffect(() => {
    registerHeader(id, { crumbs, actions, title });
  }, [id, crumbs, actions, title, registerHeader]);

  // Unregister header strictly upon component unmount
  useEffect(() => {
    return () => {
      unregisterHeader(id);
    };
  }, [id, unregisterHeader]);
}

export function HeaderPortal({ crumbs, actions, title }: HeaderData) {
  useHeader({ crumbs, actions, title });
  return null;
}
