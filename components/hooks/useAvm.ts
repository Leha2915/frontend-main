'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpeechStream } from '@/components/hooks/useSpeechStream'
import { useSpeech } from './useSpeech'

type UseAvmOptions = {
  autoSend: boolean
  canRecord: boolean
  suspend: boolean
  onSend: (text: string) => void | Promise<void>
  onError?: (err?: unknown) => void
  onOpen?: () => void
  upload: boolean
}

export type UseAvm = {
  recording: boolean
  micLevel: number
  buffered: string
  start: () => Promise<void>
  stop: () => Promise<void>
  toggleRecording: () => Promise<void>
  flush: () => Promise<void>
  sendDisabled: boolean
  upload: boolean
  isFlushing: boolean
}

export function useAvm({
  autoSend,
  canRecord,
  suspend,
  onSend,
  onError,
  onOpen,
  upload,
}: UseAvmOptions): UseAvm {
  const [recording, setRecording] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [buffered, setBuffered] = useState('')
  const [isFlushing, setIsFlushing] = useState(false)

  const bufferRef = useRef('')
  const awaitFinalResolveRef = useRef<null | ((t: string) => void)>(null)
  const awaitFinalTimerRef = useRef<number | null>(null)
  const isFlushingRef = useRef(false)

  const initialAutoSend = useRef(autoSend).current
  const useSpeechImpl = useSpeech //initialAutoSend ? useSpeechStream :

  const waitForNextTranscript = useCallback(
    (timeoutMs = 400) =>
      new Promise<string | null>((resolve) => {
        if (awaitFinalTimerRef.current) window.clearTimeout(awaitFinalTimerRef.current)

        awaitFinalTimerRef.current = window.setTimeout(() => {
          awaitFinalTimerRef.current = null
          awaitFinalResolveRef.current = null
          resolve(null)
        }, timeoutMs)

        awaitFinalResolveRef.current = (t: string) => {
          if (awaitFinalTimerRef.current) window.clearTimeout(awaitFinalTimerRef.current)
          awaitFinalTimerRef.current = null
          awaitFinalResolveRef.current = null
          resolve(t)
        }
      }),
    []
  )

  const stream = useSpeechImpl(
    {
      onTranscript: async (t: string) => {
        if (awaitFinalResolveRef.current) {
          try {
            awaitFinalResolveRef.current(t)
          } catch {}
        }
        if (!canRecord) return

        setRecording(false)
        try {
          await stream.stop()
        } catch {}

        if (initialAutoSend) {
          await onSend(t)
        } else {
          const next = (bufferRef.current ? bufferRef.current + ' ' : '') + t
          bufferRef.current = next
          setBuffered(next)
        }

        if (canRecord && !suspend) {
          try {
            await stream.start()
            setRecording(true)
          } catch {}
        }
      },
      onLevel: (lvl: number) => setMicLevel(lvl),
      onError,
      onOpen,
    },
    upload
  )

  const start = useCallback(async () => {
    if (!canRecord) return
    await stream.start()
    setRecording(true)
  }, [canRecord, stream])

  const stop = useCallback(async () => {
    try {
      await stream.stop()
    } catch {}
    setRecording(false)
  }, [stream])

  const toggleRecording = useCallback(async () => {
    if (recording) await stop()
    else await start()
  }, [recording, start, stop])

  const flush = useCallback(async () => {
    if (!canRecord || isFlushingRef.current) return

    isFlushingRef.current = true
    setIsFlushing(true)

    try {
      if (recording) {
        const maybeFinal = await waitForNextTranscript(1000)

        try {
          await stream.stop()
        } catch {}
        setRecording(false)

        const combined = [bufferRef.current, maybeFinal ?? '']
          .filter(Boolean)
          .join(' ')
          .trim()

        if (combined) {
          bufferRef.current = ''
          setBuffered('')
          await onSend(combined)
        } else {
          const late = await waitForNextTranscript(150)
          const finalTry = [bufferRef.current, late ?? '']
            .filter(Boolean)
            .join(' ')
            .trim()
          if (finalTry) {
            bufferRef.current = ''
            setBuffered('')
            await onSend(finalTry)
          }
        }
        return
      }
      const text = bufferRef.current.trim()
      if (text) {
        bufferRef.current = ''
        setBuffered('')
        await onSend(text)
      }
    } finally {
      isFlushingRef.current = false
      setIsFlushing(false)
    }
  }, [canRecord, recording, stream, onSend, waitForNextTranscript])

  useEffect(() => {
    if (!canRecord || suspend) {
      stop()
      return
    }
    if (!recording) {
      start().catch(() => {})
    }
  }, [canRecord, suspend])

  const sendDisabled = (!bufferRef.current.trim() && !recording) || isFlushing

  return {
    recording,
    micLevel,
    buffered,
    start,
    stop,
    toggleRecording,
    flush,
    sendDisabled,
    upload,
    isFlushing,
  }
}
