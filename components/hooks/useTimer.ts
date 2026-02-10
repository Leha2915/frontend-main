'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Options = {
  key: string; //session id
  limitMinutes: number;
  intervalMs?: number;
  onTimeout?: () => void;
  autostartIfMissing?: boolean;
};

type PersistedShape = {
  startAt: number | null;
  carrySeconds: number;
  paused: boolean;
  pausedAt: number | null;
};

const readPersisted = (storageKey: string): PersistedShape => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { startAt: null, carrySeconds: 0, paused: false, pausedAt: null };
    const parsed = JSON.parse(raw) as PersistedShape;
    return {
      startAt: parsed.startAt ?? null,
      carrySeconds: parsed.carrySeconds ?? 0,
      paused: !!parsed.paused,
      pausedAt: parsed.pausedAt ?? null,
    };
  } catch {
    return { startAt: null, carrySeconds: 0, paused: false, pausedAt: null };
  }
};

const writePersisted = (storageKey: string, data: PersistedShape) => {
  localStorage.setItem(storageKey, JSON.stringify(data));
};

export function usePersistentTimer({
  key,
  limitMinutes,
  intervalMs = 1000,
  onTimeout,
  autostartIfMissing = true,
}: Options) {
  const storageKey = useMemo(() => `interview_timer_${key}`, [key]);
  const limitSeconds = limitMinutes * 60;

  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(limitSeconds);
  const [expired, setExpired] = useState(false);

  const persistedRef = useRef<PersistedShape | null>(null);
  const tickRef = useRef<number | null>(null);

  const computeElapsed = useCallback((p: PersistedShape): number => {
    if (!p.startAt) return p.carrySeconds;
    if (p.paused) {
      const pausedDelta = p.pausedAt ? Math.max(0, Math.floor((p.pausedAt - p.startAt) / 1000)) : 0;
      return p.carrySeconds + pausedDelta;
    }
    const runningDelta = Math.max(0, Math.floor((Date.now() - p.startAt) / 1000));
    return p.carrySeconds + runningDelta;
  }, []);

  const persistAndUpdate = useCallback((next: PersistedShape) => {
    persistedRef.current = next;
    writePersisted(storageKey, next);
    const e = computeElapsed(next);
    setElapsed(e);
    const r = Math.max(0, limitSeconds - e);
    setRemaining(r);
    const isExpired = e >= limitSeconds;
    setExpired(isExpired);
    if (isExpired && onTimeout) onTimeout();
  }, [computeElapsed, limitSeconds, onTimeout, storageKey]);

  const start = useCallback(() => {
    const current = persistedRef.current ?? readPersisted(storageKey);
    if (current.startAt && !current.paused) return;
    const now = Date.now();
    const next: PersistedShape = {
      startAt: now,
      carrySeconds: current.carrySeconds,
      paused: false,
      pausedAt: null,
    };
    persistAndUpdate(next);
  }, [persistAndUpdate, storageKey]);

  const pause = useCallback(() => {
    const current = persistedRef.current ?? readPersisted(storageKey);
    if (!current.startAt || current.paused) return;
    const pausedAt = Date.now();
    const delta = Math.max(0, Math.floor((pausedAt - current.startAt) / 1000));
    const next: PersistedShape = {
      startAt: null,
      carrySeconds: current.carrySeconds + delta,
      paused: true,
      pausedAt,
    };
    persistAndUpdate(next);
  }, [persistAndUpdate, storageKey]);

  const resume = useCallback(() => {
    const current = persistedRef.current ?? readPersisted(storageKey);
    if (!current.paused) return;
    const next: PersistedShape = {
      startAt: Date.now(),
      carrySeconds: current.carrySeconds,
      paused: false,
      pausedAt: null,
    };
    persistAndUpdate(next);
  }, [persistAndUpdate, storageKey]);

  const reset = useCallback(() => {
    const next: PersistedShape = { startAt: null, carrySeconds: 0, paused: false, pausedAt: null };
    persistAndUpdate(next);
  }, [persistAndUpdate]);

  useEffect(() => {
    const initial = readPersisted(storageKey);
    persistedRef.current = initial;

    if (!initial.startAt && !initial.paused && autostartIfMissing) {
      const next: PersistedShape = { startAt: Date.now(), carrySeconds: 0, paused: false, pausedAt: null };
      persistAndUpdate(next);
    } else {
      persistAndUpdate(initial);
    }
  }, [storageKey]);

  useEffect(() => {
    if (expired) return;
    const current = persistedRef.current;
    if (!current || current.paused || !current.startAt) {
      tickRef.current = window.setInterval(() => {
        const latest = readPersisted(storageKey);
        persistAndUpdate(latest);
      }, intervalMs);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }

    tickRef.current = window.setInterval(() => {
      const latest = readPersisted(storageKey);
      persistAndUpdate(latest);
    }, intervalMs);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [expired, intervalMs, persistAndUpdate, storageKey]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as PersistedShape;
          persistAndUpdate(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(storageKey);
      bc.onmessage = (ev) => {
        if (ev?.data?.type === 'SYNC' && ev?.data?.payload) {
          persistAndUpdate(ev.data.payload as PersistedShape);
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
    };
  }, [persistAndUpdate, storageKey]);

  const persistAndBroadcast = useCallback((next: PersistedShape) => {
    writePersisted(storageKey, next);
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(storageKey);
      bc.postMessage({ type: 'SYNC', payload: next });
      bc.close();
    }
  }, [storageKey]);

  const actions = useMemo(() => ({
    start: () => {
      const current = persistedRef.current ?? readPersisted(storageKey);
      if (current.startAt && !current.paused) return;
      const next: PersistedShape = { startAt: Date.now(), carrySeconds: current.carrySeconds, paused: false, pausedAt: null };
      persistedRef.current = next;
      setExpired(false);
      persistAndBroadcast(next);
    },
    pause: () => {
      const current = persistedRef.current ?? readPersisted(storageKey);
      if (!current.startAt || current.paused) return;
      const pausedAt = Date.now();
      const delta = Math.max(0, Math.floor((pausedAt - current.startAt) / 1000));
      const next: PersistedShape = { startAt: null, carrySeconds: current.carrySeconds + delta, paused: true, pausedAt };
      persistedRef.current = next;
      persistAndBroadcast(next);
    },
    resume: () => {
      const current = persistedRef.current ?? readPersisted(storageKey);
      if (!current.paused) return;
      const next: PersistedShape = { startAt: Date.now(), carrySeconds: current.carrySeconds, paused: false, pausedAt: null };
      persistedRef.current = next;
      persistAndBroadcast(next);
    },
    reset: () => {
      const next: PersistedShape = { startAt: null, carrySeconds: 0, paused: false, pausedAt: null };
      persistedRef.current = next;
      setExpired(false);
      persistAndBroadcast(next);
    },
  }), [persistAndBroadcast, storageKey]);

  return {
    elapsed,
    remaining,
    expired,
    isPaused: persistedRef.current?.paused ?? false,
    ...actions,
  };
}
