'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useContext } from "react"
import { InterviewHealthContext } from "@/context/health"

export interface UseLevelHistoryOpts {
  historySeconds?: number
  sampleMs?: number
  barMax?: number
  barMin?: number
  autoResetOnStart?: boolean
}

export type LevelHistoryControls = {
  recording: boolean
  paused: boolean
  history: number[]
  bars: number[]
  currentLevel: number
  start: () => Promise<void> | void
  stop: () => Promise<void> | void
  pause: () => void
  resume: () => void
  togglePause: (p?: boolean) => void
  reset: () => void
  setCurrentLevel: (lvl: number) => void
}

export function useLevelHistory(opts: UseLevelHistoryOpts = {}): LevelHistoryControls {
  const {
    historySeconds = 12,
    sampleMs = 50,
    barMax = 24,
    barMin = 1,
    autoResetOnStart = true,
  } = opts

  const HISTORY_LEN = Math.ceil((historySeconds * 1000) / sampleMs)

  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [history, setHistory] = useState<number[]>(() => Array(HISTORY_LEN).fill(0))
  const [currentLevel, _setCurrentLevel] = useState(0)

  const health = useContext(InterviewHealthContext)

  const levelRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lenRef = useRef(HISTORY_LEN)
  lenRef.current = HISTORY_LEN

  const recordingRef = useRef(false)
  const pausedRef   = useRef(false)
  useEffect(() => { recordingRef.current = recording }, [recording])
  useEffect(() => { pausedRef.current    = paused    }, [paused])

  const setCurrentLevel = useCallback((lvl: number) => {
    levelRef.current = lvl
    _setCurrentLevel(lvl)
  }, [])

  const tick = useCallback(() => {
    if (!recordingRef.current || pausedRef.current) return
    const lvl = levelRef.current
    setHistory(prev => {
      const next = [...prev, lvl]
      if (next.length > lenRef.current) next.shift()
      return next
    })
  }, [])

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (recordingRef.current) return
    if (autoResetOnStart) setHistory(Array(lenRef.current).fill(0))
    setPaused(false)
    recordingRef.current = true
    setRecording(true)
    clearTimer()
    intervalRef.current = setInterval(tick, sampleMs)
  }, [autoResetOnStart, clearTimer, sampleMs, tick])

  const stop = useCallback(() => {
    if (!recordingRef.current) return
    clearTimer()
    recordingRef.current = false
    setRecording(false)
    setPaused(false)
  }, [clearTimer])

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])
  const togglePause = useCallback((p?: boolean) => {
    if (typeof p === "boolean") setPaused(p)
    else setPaused(prev => !prev)
  }, [])

  const reset = useCallback(() => {
    setHistory(Array(lenRef.current).fill(0))
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  useEffect(() => {
    if (health.status === 'stt' && recordingRef.current) {
      stop()
    }
  }, [health?.status, stop])

  const bars = useMemo(
    () => history.map(v => Math.round(barMin + v * barMax)),
    [history, barMax, barMin]
  )

  return {
    recording,
    paused,
    history,
    bars,
    currentLevel,
    start,
    stop,
    pause,
    resume,
    togglePause,
    reset,
    setCurrentLevel,
  }
}
