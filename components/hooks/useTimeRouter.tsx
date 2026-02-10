'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsContext } from '@/context/settings';
import { usePersistentTimer } from '@/components/hooks/useTimer';

type Ctx = {
  elapsed: number;
  remaining: number;
  expired: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
};

export const InterviewTimerContext = createContext<Ctx | null>(null);

export function InterviewTimerProvider({
  children,
  storageKey,
  timeoutHref = '/timeout',
  disabled = false,
}: {
  children: React.ReactNode;
  storageKey: string;
  timeoutHref?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { timeLimit } = useContext(SettingsContext); // Minuten (kann -1 sein)

  // --- NO-OP: wenn deaktiviert oder timeLimit < 0
  if (disabled || (typeof timeLimit === 'number' && timeLimit < 0)) {
    const value: Ctx = {
      elapsed: 0,
      remaining: Number.MAX_SAFE_INTEGER,
      expired: false,
      isPaused: false,
      start: () => {},
      pause: () => {},
      resume: () => {},
      reset: () => {},
    };
    return (
      <InterviewTimerContext.Provider value={value}>
        {children}
      </InterviewTimerContext.Provider>
    );
  }

  const timer = usePersistentTimer({
    key: storageKey,
    limitMinutes: Math.max(0, timeLimit ?? 0),
    intervalMs: 1000,
    autostartIfMissing: true,
    onTimeout: () => router.push(timeoutHref),
  });

  const value = useMemo<Ctx>(() => ({
    elapsed: timer.elapsed,
    remaining: timer.remaining,
    expired: timer.expired,
    isPaused: timer.isPaused,
    start: timer.start,
    pause: timer.pause,
    resume: timer.resume,
    reset: timer.reset,
  }), [timer]);

  return (
    <InterviewTimerContext.Provider value={value}>
      {children}
    </InterviewTimerContext.Provider>
  );
}

export const useInterviewTimer = () => {
  const ctx = useContext(InterviewTimerContext);
  if (!ctx) throw new Error('useInterviewTimer must be used within InterviewTimerProvider');
  return ctx;
};
