'use client'

import { forwardRef, useRef, useState, useEffect, memo, useContext } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X, Send } from 'lucide-react'
import Clouds from '@/components/ui/clouds'
import getTranslation from '@/lib/translation'
import { SettingsContext } from '@/context/settings'

export type AgentState = 'awaiting' | 'speaking' | 'recording' | 'idle'

export type Props = {
  state: AgentState
  micLevel: number
  agentLevel?: number
  onToggleRecord: () => void | Promise<void>
  onClose: () => void | Promise<void>
  onSkip: () => void | Promise<void>
  autoSend?: boolean
  onSendBuffered?: () => void | Promise<void>
  sendDisabled?: boolean
  children?: React.ReactNode
  highlightSend?: boolean
}

const namespace = 'components_ui_avmOverlay.AvmOverlay'

function useFps(intervalMs: number = 500) {

  const [fps, setFps] = useState<number>(0)
  const frameCount = useRef(0)
  const lastMark = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    let running = true
    const loop = (t: number) => {
      if (!running) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        lastMark.current = t
        rafId.current = requestAnimationFrame(loop)
        return
      }
      frameCount.current += 1
      const elapsed = t - lastMark.current
      if (elapsed >= intervalMs) {
        const next = (frameCount.current * 1000) / Math.max(1, elapsed)
        setFps(next)
        frameCount.current = 0
        lastMark.current = t
      }
      rafId.current = requestAnimationFrame(loop)
    }
    rafId.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [intervalMs])

  return fps
}

function useSteppedLevel(
  level: number,
  opts?: { steps?: number; hysteresis?: number; throttleMs?: number }
) {

  const steps = opts?.steps ?? 24
  const hysteresis = opts?.hysteresis ?? 0.02
  const throttleMs = opts?.throttleMs ?? 80

  const quantize = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    return Math.round(clamped * steps) / steps
  }

  const [stepLevel, setStepLevel] = useState(() => quantize(level))
  const lastTick = useRef(0)

  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now - lastTick.current < throttleMs) return
    const q = quantize(level)
    if (Math.abs(q - stepLevel) > hysteresis) {
      setStepLevel(q)
      lastTick.current = now
    }
  }, [level, stepLevel, throttleMs, hysteresis])

  return stepLevel
}

function FpsBadge({ fps }: { fps: number }) {

  const sc = useContext(SettingsContext);
  const lang = sc.language;
  const display = Math.round(fps)
  const label = getTranslation(`${namespace}.fps_label`, lang)
  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-3 right-3 z-[1100]',
        'rounded-xl px-2.5 py-1 text-sm font-mono',
        'bg-black/60 text-white/90 backdrop-blur-sm',
        'border border-white/10 shadow-[0_0_14px_rgba(0,0,0,0.35)]'
      )}
      aria-label={label}
      title={label}
    >
      {display} fps
    </div>
  )
}

function PulseWaves({
  active,
  color = 'rgba(99,102,241,0.35)',
}: {
  active: boolean
  color?: string
}) {
  if (!active) return null
  const waves = [0, 600, 1200]
  return (
    <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden>
      {waves.map((delay, i) => (
        <span
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 40px ${color}`,
            border: '2px solid rgba(165,180,252,0.5)',
            animation: `avmPulse 2400ms ease-out ${delay}ms infinite`,
            transformOrigin: 'center',
          }}
        />
      ))}
    </div>
  )
}

const AvmOverlay = forwardRef<HTMLDivElement, Props>(function AvmOverlay(
  {
    state,
    micLevel,
    agentLevel = 0,
    onToggleRecord,
    onClose,
    onSkip,
    autoSend = true,
    onSendBuffered,
    sendDisabled = false,
    children,
    highlightSend,
  },
  ref
) {

  const sc = useContext(SettingsContext);
  const lang = sc.language;

  const isAwaiting = state === 'awaiting'
  const isMicLocked = isAwaiting || state === 'speaking'
  const isRecording = state === 'recording'
  const isAgentSpeaking = state === 'speaking'

  const handleToggleClick = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isMicLocked) return
    try { await onToggleRecord() } catch {}
  }

  const label =
    state === 'awaiting'
      ? getTranslation(`${namespace}.label_thinking`, lang)
      : state === 'speaking'
      ? getTranslation(`${namespace}.label_listen`, lang)
      : state === 'recording'
      ? getTranslation(`${namespace}.label_speak_now`, lang)
      : getTranslation(`${namespace}.label_idle`, lang)

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  const BASELINE_AWAITING = 0.12
  const cloudLevel = isAgentSpeaking ? (agentLevel ?? 0) : (isAwaiting ? BASELINE_AWAITING : 0)
  const dynLevel = clamp01(cloudLevel)

  const micRaw = Math.max(0, Math.min(1, micLevel / 3))
  const agentRaw = Math.max(0, Math.min(1, agentLevel ?? 0))

  const micStepped = useSteppedLevel(micRaw, { steps: 24, hysteresis: 0.02, throttleMs: 80 })
  const agentStepped = useSteppedLevel(agentRaw, { steps: 20, hysteresis: 0.02, throttleMs: 80 })

  const BASE_SIZE = 320

  const MIC_RING_MIN = 1.06
  const MIC_RING_MAX = 1.65
  const AGENT_RING_MIN = 1.04
  const AGENT_RING_MAX = 1.55

  const BUTTON_MIN = 0.95
  const BUTTON_MAX = 1.22
  
  const scaleInput = isAgentSpeaking ? agentStepped : (isAwaiting ? 0.08 : 0)
  const rawScale = BUTTON_MIN + scaleInput * (BUTTON_MAX - BUTTON_MIN)
  const buttonScale = rawScale

  const fps = useFps(500)

  return (
    <div ref={ref} className="fixed inset-0 z-[999] flex pointer-events-auto" style={{ height: '100svh' }}>

      <div className="pointer-events-none absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        className="pointer-events-none absolute inset-0 z-[850]"
        style={{
          background: 'radial-gradient(1200px 600px at 50% 60%, rgba(51,93,255,0.22), transparent 60%)',
        }}
      />

      {isAgentSpeaking && (
        <div
          className="pointer-events-none absolute inset-0 z-[855]"
          style={{ opacity: Math.max(0.15, Math.min(0.45, dynLevel * 0.6)) }}
          aria-hidden
        />
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="fixed top-4 right-4 z-[1101] text-white text-2xl hover:text-gray-300"
        aria-label={getTranslation(`${namespace}.close_aria`, lang)}
        title={getTranslation(`${namespace}.close_title`, lang)}
      >
        <X className="h-7 w-7 text-white" />
      </button>

      {isAgentSpeaking && sc.interviewMode !== 3 && (
        <Button
          onClick={(e) => { e.stopPropagation(); onSkip() }}
          className="fixed top-4 left-4 z-[1101] rounded-xl bg-white/10 hover:bg-white/20 text-white"
          title={getTranslation(`${namespace}.skip_title`, lang)}
        >
          {getTranslation(`${namespace}.skip_btn`, lang)}
        </Button>
      )}

      <div className="relative z-[900] flex flex-1 isolate">
        <div className="relative w-full h-full">
          {children}

          <div className="absolute inset-0 z-[900] flex flex-col items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-4 w-full h-full pointer-events-auto">
              <div
                className="will-change-transform transition-transform duration-150 ease-out"
                style={{
                  transformOrigin: 'center',
                  transform: `translateZ(0) scale(${buttonScale})`,
                }}
              >
                <div className="relative inline-block" style={{ width: BASE_SIZE, height: BASE_SIZE }}>
                  <PulseWaves active={isAwaiting} />
                  {isAwaiting && (
                    <div
                      className={cn('pointer-events-none absolute inset-0 z-[8]')}
                      style={{
                        transformOrigin: 'center',
                        transform: `translateZ(0) scale(${AGENT_RING_MIN})`,
                        opacity: 1,
                      }}
                      aria-hidden
                    >
                      <div
                        className={cn(
                          'absolute inset-0 rounded-full',
                          'border-[6px] border-transparent border-t-cyan-300/80',
                          'shadow-[0_0_40px_rgba(34,211,238,0.35)]'
                        )}
                        style={{ animation: 'spin 2000ms linear infinite' }}
                      />
                    </div>
                  )}

                  {isAwaiting && (
                    <div
                      className="pointer-events-none absolute inset-0 z-[8]"
                      style={{
                        transformOrigin: 'center',
                        transform: `translateZ(0) scale(${AGENT_RING_MIN * 0.94})`,
                        opacity: 0.95,
                      }}
                      aria-hidden
                    >
                      <div
                        className={cn(
                          'absolute inset-0 rounded-full',
                          'border-[6px] border-transparent border-b-indigo-300/80',
                          'shadow-[0_0_36px_rgba(99,102,241,0.35)]'
                        )}
                        style={{ animation: 'spin 2200ms linear infinite reverse' }}
                      />
                    </div>
                  )}

                  <div
                    className={cn(
                      'pointer-events-none absolute inset-0 rounded-full z-[9]',
                      'border border-indigo-300/70 shadow-[0_0_40px_rgba(99,102,241,0.35)]',
                      'transition-transform duration-150 ease-out will-change-transform',
                    )}
                    style={{
                      transformOrigin: 'center',
                      transform: `translateZ(0) scale(${MIC_RING_MIN + micStepped * (MIC_RING_MAX - MIC_RING_MIN)})`,
                      opacity: isRecording ? 1 : 0.35,
                    }}
                    aria-hidden
                  />

                  <Button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleToggleClick(e)}
                    data-locked={isMicLocked ? 'true' : 'false'}
                    className={cn(
                      'relative z-10 rounded-full overflow-hidden p-0',
                      'flex items-center justify-center shadow-2xl',
                      'bg-blue-800',
                      isMicLocked && 'cursor-not-allowed opacity-60 hover:bg-inherit'
                    )}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <Clouds
                      micLevel={dynLevel}
                      size={BASE_SIZE}
                      paused={false}
                    />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 text-white text-lg select-none">
                <span>{label}</span>
              </div>

              {!autoSend && !isAgentSpeaking && (
                <div className="mt-1 z-[1101]">
                  <Button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try { await onSendBuffered?.(); } catch {}
                    }}
                    disabled={sendDisabled}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-6 py-3 text-lg',
                      'bg-white/15 hover:bg-white/25 text-white transition',
                      sendDisabled && 'opacity-60 cursor-not-allowed',
                      highlightSend && [
                        "ring-4 ring-emerald-500 ring-offset-2 ring-offset-black",
                        "shadow-lg shadow-emerald-400/30",
                        "animate-pulse scale-105"
                      ]
                    )}
                    title={
                      sendDisabled
                        ? getTranslation(`${namespace}.send_buffer_title_empty`, lang)
                        : getTranslation(`${namespace}.send_buffer_title_send`, lang)
                    }
                  >
                    <Send className="w-6 h-6" />
                    <span>{getTranslation(`${namespace}.send_button`, lang)}</span>
                  </Button>

                </div>
              )}
            </div>
          </div>

          <FpsBadge fps={fps} />
        </div>
      </div>

      <style>{`
        @keyframes avmPulse {
          0% {
            transform: translateZ(0) scale(1);
            opacity: 0.35;
          }
          70% {
            opacity: 0.12;
          }
          100% {
            transform: translateZ(0) scale(2.25);
            opacity: 0;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})

export default memo(AvmOverlay)
