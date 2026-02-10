'use client'

import { useEffect, useRef, useContext } from 'react'
import { initSttAvailability } from '@/lib/s2t'
import { initTtsAvailability } from '@/lib/t2s'
import { isNetworkError } from '@/lib/utils'
import { InterviewHealthContext } from '@/context/health'

const intervalMs = 5000 // 5s->10s->...->120s->120s->...

type UseServiceHealthOpts = {
  apiUrl: string | undefined
  projectSlug: string
  voiceEnabled: boolean
  interviewMode: number
}

export function useServiceHealth({
  apiUrl,
  projectSlug,
  voiceEnabled,
  interviewMode,
}: UseServiceHealthOpts) {
  const health = useContext(InterviewHealthContext)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const cancelledRef = useRef(false)
  const attemptRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    cancelledRef.current = false
    attemptRef.current = 0

    const checkOnce = async () => {
      if (runningRef.current) return
      runningRef.current = true
      try {
        await Promise.all([
          (async () => {
            try {
              await initTtsAvailability(apiUrl ?? '', projectSlug)
              if (!cancelledRef.current) {
                health.setBackendUnavailable(false)
                health.setTtsUnavailable(false)
              }
            } catch (err) {
              if (cancelledRef.current) return
              const net = isNetworkError(err)
              health.setBackendUnavailable(net)
              if (interviewMode != 2) health.setTtsUnavailable(true)
            }
          })(),
          (async () => {
            try {
              await initSttAvailability(apiUrl ?? '', projectSlug ?? '')
              if (!cancelledRef.current) {
                health.setBackendUnavailable(false)
                health.setSttUnavailable(false)
              }
            } catch (err) {
              if (cancelledRef.current) return
              const net = isNetworkError(err)
              health.setBackendUnavailable(net)
              if (voiceEnabled || interviewMode != 2) health.setSttUnavailable(true)
            }
          })(),
        ])
      } finally {
        runningRef.current = false
      }
    }

    const scheduleNext = () => {
      const base = intervalMs
      const nextDelay = Math.min((attemptRef.current + 1) * base, 120_000)
      timerRef.current = window.setTimeout(async () => {
        await checkOnce().catch(() => {})
        attemptRef.current += 1
        if (!cancelledRef.current) scheduleNext()
      }, nextDelay)
    }

    scheduleNext()

    const onVisibility = () => {
      if (!document.hidden) {
        clearTimer()
        attemptRef.current = 0
        checkOnce()
          .catch(() => {})
          .finally(() => {
            if (!cancelledRef.current) scheduleNext()
          })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelledRef.current = true
      clearTimer()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [
    apiUrl,
    projectSlug,
    voiceEnabled,
    interviewMode,
    intervalMs,
    health.backendUnavailable,
    health.ttsUnavailable,
    health.sttUnavailable,
  ])
}
