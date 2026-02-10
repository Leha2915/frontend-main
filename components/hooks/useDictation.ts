'use client'

import { useCallback, useRef, useState, useContext } from 'react'
import { useSpeechStream } from '@/components/hooks/useSpeechStream'
import { useSpeech } from '@/components/hooks/useSpeech'
import { useLevelHistory } from '@/components/hooks/useLevelHistory'
import { InterviewHealthContext } from '@/context/health'

type UseDictationOpts = {
  enabled?: boolean
  onOpen?: () => void
  onError?: (err?: unknown) => void
  onChunk?: (chunk: string) => void
  upload?: boolean
}

export type UseDictation = {
  recording: boolean
  paused: boolean
  micLevel: number
  bars: number[]
  bufferedTranscript: string

  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  setConfirmingPause: (p?: boolean) => void
  drainBuffer: () => string
  setBuffer: (v: string) => void
}

export function useDictation(opts: UseDictationOpts = {}): UseDictation {
  const { enabled = true, onOpen, onError, onChunk, upload } = opts

  const [bufferedTranscript, setBufferedTranscript] = useState('')
  const [micLevel, setMicLevel] = useState(0)

  const {
    recording,
    paused,
    bars,
    start: startHistory,
    stop: stopHistory,
    reset: resetHistory,
    togglePause: setConfirmingPause,
    setCurrentLevel: pushMicLevel,
  } = useLevelHistory({ historySeconds: 12, sampleMs: 50, barMax: 24, barMin: 1 })

  const health = useContext(InterviewHealthContext)
  const bufferRef = useRef('')

  const dictationStream = useSpeech({
    onTranscript: (t) => {
      bufferRef.current += t
      setBufferedTranscript((prev) => prev + t)
      onChunk?.(t)
    },
    onLevel: (lvl) => {
      setMicLevel(lvl)
      pushMicLevel(lvl)
    },
    onError: (err) => {
      onError?.(err)
      health.setSttUnavailable(true)
    },
    onOpen: () => {
      onOpen?.()
      health.setSttUnavailable(false)
      health.setBackendUnavailable(false)
    },
  }, upload)

  const start = useCallback(async () => {
    if (!enabled) return
    await dictationStream.start()
    resetHistory()
    startHistory()
  }, [enabled, dictationStream, resetHistory, startHistory])

  const stop = useCallback(async () => {
    await dictationStream.stop()
    stopHistory()
    setMicLevel(0)
  }, [dictationStream, stopHistory])

  const cancel = useCallback(async () => {
    try { await dictationStream.stop() } catch {}
    stopHistory()
    resetHistory()
    setMicLevel(0)
    bufferRef.current = ''
    setBufferedTranscript('')
  }, [dictationStream, resetHistory, stopHistory])

  const drainBuffer = useCallback(() => {
    const txt = bufferRef.current.trim()
    bufferRef.current = ''
    setBufferedTranscript('')
    return txt
  }, [])

  const setBuffer = useCallback((v: string) => {
    bufferRef.current = v
    setBufferedTranscript(v)
  }, [])

  return {
    recording,
    paused,
    micLevel,
    bars,
    bufferedTranscript,
    start,
    stop,
    cancel,
    setConfirmingPause,
    drainBuffer,
    setBuffer,
  }
}
