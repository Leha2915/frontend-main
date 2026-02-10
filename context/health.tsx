'use client'

import { createContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

export type HealthSeverity = 'error' | 'warning' | 'ok' | null
export type HealthStatus = 'backend' | 'stt' | 'tts' | 'ok'

export interface InterviewHealth {
  sttUnavailable: boolean
  setSttUnavailable: Dispatch<SetStateAction<boolean>>

  ttsUnavailable: boolean
  setTtsUnavailable: Dispatch<SetStateAction<boolean>>

  backendUnavailable: boolean
  setBackendUnavailable: Dispatch<SetStateAction<boolean>>

  tooltip?: string
  setTooltip: Dispatch<SetStateAction<string | undefined>>

  severity: HealthSeverity
  status: HealthStatus
}

export const InterviewHealthContext = createContext<InterviewHealth>({
  sttUnavailable: false,
  setSttUnavailable: () => {},
  ttsUnavailable: false,
  setTtsUnavailable: () => {},
  backendUnavailable: false,
  setBackendUnavailable: () => {},
  tooltip: undefined,
  setTooltip: () => {},
  severity: null,
  status: 'ok',
})

export function InterviewHealthProvider({ children }: { children: React.ReactNode }) {
  const [sttUnavailable, setSttUnavailable] = useState(false)
  const [ttsUnavailable, setTtsUnavailable] = useState(false)
  const [backendUnavailable, setBackendUnavailable] = useState(false)
  const [tooltip, setTooltip] = useState<string | undefined>(undefined)

  const status: HealthStatus = useMemo(() => {
    if (backendUnavailable) return 'backend'
    if (sttUnavailable) return 'stt'
    if (ttsUnavailable) return 'tts'
    return 'ok'
  }, [backendUnavailable, sttUnavailable, ttsUnavailable])

  const severity: HealthSeverity = useMemo(() => {
    if (status === 'backend') return 'error'
    if (status === 'stt' || status === 'tts') return 'warning'
    return null
  }, [status])

  useEffect(() => {
    switch (status) {
      case 'backend':
        setTooltip('backend unavailable')
        break
      case 'stt':
        setTooltip('speech processing service unavailable')
        break
      case 'tts':
        setTooltip('speech synth unavailable')
        break
      default:
        setTooltip('all systems needed for this interview ok')
    }
  }, [status])

  return (
    <InterviewHealthContext.Provider
      value={{
        sttUnavailable,
        setSttUnavailable,
        ttsUnavailable,
        setTtsUnavailable,
        backendUnavailable,
        setBackendUnavailable,
        tooltip,
        setTooltip,
        severity,
        status,
      }}
    >
      {children}
    </InterviewHealthContext.Provider>
  )
}
