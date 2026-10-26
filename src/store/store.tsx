import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types';
import { loadData, saveData, saveSnapshot } from './db';

interface Store {
  data: AppData;
  /** Apply an immutable update; it is saved to IndexedDB shortly after. */
  update: (recipe: (d: AppData) => AppData) => void;
  saveError: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<AppData | null>(null);

  useEffect(() => {
    loadData().then(setData, (e) => setLoadError(String(e)));
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (latest.current) {
      saveData(latest.current).then(
        () => setSaveError(null),
        (e) => setSaveError(`Couldn't save: ${e}`),
      );
    }
  }, []);

  const schedule = useCallback(
    (d: AppData) => {
      latest.current = d;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 300);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => {
      if (timer.current === undefined) return;
      // IndexedDB writes are async and may not finish while the page closes, so also keep a
      // synchronous copy of the small state; loadData prefers it when it's newer.
      if (latest.current) saveSnapshot(latest.current);
      flush();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const update = useCallback(
    (recipe: (d: AppData) => AppData) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = recipe(prev);
        if (next !== prev) schedule(next);
        return next;
      });
    },
    [schedule],
  );

  if (loadError) return <div className="card" style={{ margin: 40 }}>Couldn't open your saved data: {loadError}</div>;
  if (!data) return <>{fallback}</>;
  return <Ctx.Provider value={{ data, update, saveError }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
