'use client'

import React, { useEffect, useMemo, useRef } from 'react'

export type CloudsProps = {
  micLevel: number
  size?: number
  baseSpeed?: number
  speedBoost?: number
  densityBoost?: number
  blobs?: number
  className?: string
  smoothFactor?: number
  medianWindow?: number
  slewUpPerSec?: number
  slewDownPerSec?: number
  inputGain?: number
  idleSuppression?: number
  inputGamma?: number
  paused?: boolean
}

const rng = (seed: number) => {
  let x = seed | 0
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const a = arr.slice().sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

export default function Clouds({
  micLevel,
  size = 320,
  baseSpeed = 20,
  speedBoost = 1.7,
  densityBoost = 5.8,
  blobs = 4,
  className,
  smoothFactor = 0.12,
  medianWindow = 5,
  slewUpPerSec = 0.9,
  slewDownPerSec = 0.7,
  inputGain = 1.9,
  idleSuppression = 0.85,
  inputGamma = 1.05,
  paused = false,
}: CloudsProps) {
  const rafRef = useRef<number | null>(null)
  const mountedRef = useRef(false)
  const tRef = useRef(0)
  const smoothRef = useRef(0)
  const lastRef = useRef<number | null>(null)
  const micRef = useRef(micLevel)

  useEffect(() => { micRef.current = micLevel }, [micLevel])

  const mw = Math.max(1, Math.abs(medianWindow | 0) || 5)
  const oddMw = mw % 2 === 0 ? mw + 1 : mw
  const medBufRef = useRef<number[]>(Array(oddMw).fill(0))
  const medIdxRef = useRef(0)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const globalMoverRef = useRef<HTMLDivElement | null>(null)
  const colorGradeRef = useRef<HTMLDivElement | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)

  const outerBlobRefs = useRef<HTMLDivElement[]>([])
  const innerBlobRefs = useRef<HTMLDivElement[]>([])
  if (outerBlobRefs.current.length !== blobs) outerBlobRefs.current = Array(blobs).fill(null as any)
  if (innerBlobRefs.current.length !== blobs) innerBlobRefs.current = Array(blobs).fill(null as any)
  const setOuterBlobRef = (i: number) => (el: HTMLDivElement | null) => { outerBlobRefs.current[i] = el! }
  const setInnerBlobRef = (i: number) => (el: HTMLDivElement | null) => { innerBlobRefs.current[i] = el! }

  const seedRef = useRef<number>(Date.now() % 1_000_000)

  const blobSeeds = useMemo(() => {
    const r = rng(seedRef.current)
    return new Array(blobs).fill(0).map(() => ({
      x: r(),
      y: r(),
      s: 0.7 + r() * 1.1,
      rot: Math.floor(r() * 360),
      path: Math.floor(r() * 4),
      delay: r() * 10,
      alpha: 0.5 + r() * 0.2,
      phase1: r() * Math.PI * 2,
      phase2: r() * Math.PI * 2,
    }))
  }, [blobs])

  const radius = (size / 2) * 0.8
  const highlightSize = size * 0.62

  const prevRef = useRef({
    moverT: '',
    grade: '',
    highlightT: '',
    outerDur: [] as string[],
    innerT: [] as string[],
  })

  const accumRef = useRef(0)
  const filterAccumRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true

    const loop = (now: number) => {
      if (!mountedRef.current) return

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        lastRef.current = now
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const last = lastRef.current ?? now
      let dt = (now - last) / 1000
      dt = Math.min(0.05, Math.max(0, dt))
      lastRef.current = now
      tRef.current += dt

      const raw = Math.min(1, Math.max(0, micRef.current ?? 0))

      const medVal = oddMw === 1 ? raw : (() => {
        const buf = medBufRef.current
        buf[medIdxRef.current] = raw
        medIdxRef.current = (medIdxRef.current + 1) % buf.length
        return median(buf)
      })()

      const prevSmooth = smoothRef.current
      const soft = prevSmooth + smoothFactor * (medVal - prevSmooth)

      const delta = soft - prevSmooth
      const maxRise = Math.max(0, slewUpPerSec) * dt
      const maxFall = Math.max(0, slewDownPerSec) * dt
      const limited = delta > 0 ? prevSmooth + Math.min(delta, maxRise) : prevSmooth + Math.max(delta, -maxFall)
      smoothRef.current = limited

      const boosted = Math.min(1, Math.max(0, limited * inputGain))
      const eased = Math.pow(boosted, inputGamma)

      const targetFPS = 30
      const minDt = 1 / targetFPS
      accumRef.current += dt
      if (accumRef.current < minDt) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      accumRef.current = 0

      const idleScale = 1 - idleSuppression * eased
      const speedMul = 1 + speedBoost * (0.35 * eased + 0.65 * eased * eased * 1.4)
      const densityFactor = 1 + densityBoost * Math.pow(eased, 1.4)

      const baseAngular = 1 + 0.1 * idleScale
      const globalAmp = size * 0.03 * (0.35 + 0.65 * idleScale)

      const t = tRef.current
      const dx = globalAmp * Math.cos(t * 0.35 * baseAngular)
      const dy = globalAmp * Math.sin(t * 0.27 * baseAngular)
      const slowRot = 1.5 * Math.sin(t * 0.18) * (0.3 + 0.7 * idleScale)

      if (globalMoverRef.current) {
        const moverT = `translate3d(${dx}px, ${dy}px, 0) rotate(${slowRot}deg)`
        if (prevRef.current.moverT !== moverT) {
          globalMoverRef.current.style.transform = moverT
          prevRef.current.moverT = moverT
        }
      }

      if (highlightRef.current) {
        const period = 6
        const omega = (Math.PI * 2) / period
        const tt = t * omega

        const x = Math.cos(tt)
        const y = Math.sin(tt * 0.77 + 0.6)
        const px = (radius * x)
        const py = (radius * y)

        const el = highlightRef.current
        const highlightT = `translate3d(${px}px, ${py}px, 0)`
        if (prevRef.current.highlightT !== highlightT) {
          el.style.transform = highlightT
          prevRef.current.highlightT = highlightT
        }
      }

      
      filterAccumRef.current += accumRef.current
      if (colorGradeRef.current && filterAccumRef.current > 10) {
        filterAccumRef.current = 0
        const grade = `saturate(${1.02 + 0.10 * (densityFactor - 1)}) contrast(${1.02 + 0.08 * (densityFactor - 1)})`
        if (prevRef.current.grade !== grade) {
          colorGradeRef.current.style.filter = grade
          prevRef.current.grade = grade
        }
      }

      const driftScaleBase = (1 - Math.min(0.12, 0.06 * (densityFactor - 1))) * (0.9 + 0.1 * idleScale)

      const inners = innerBlobRefs.current
      const outers = outerBlobRefs.current

      for (let i = 0; i < inners.length; i++) {
        const inner = inners[i]
        const outer = outers[i]
        const b = blobSeeds[i]
        if (!inner || !b) continue

        const wobbleDeg = (1.5 + 7.5 * eased) * Math.sin(t * (0.5 + 0.4 * b.s) + b.phase1)
        const breath = (0.01 + 0.06 * eased) * Math.sin(t * (0.7 + 0.5 * b.x) + b.phase2)
        const scale = driftScaleBase * (1 + breath)

        const innerT = `rotate(${b.rot + wobbleDeg}deg) scale(${scale})`
        if (prevRef.current.innerT[i] !== innerT) {
          inner.style.transform = innerT
          prevRef.current.innerT[i] = innerT
        }

        if (outer) {
          const layerParallax = i % 2 === 0 ? 0.94 : 1.06
          const variance = 0.8 + ((i * 1.37) % 0.5)
          const baseSeconds = baseSpeed * variance
          const baseMotion = 0.9 * idleScale
          const blobGain = 1.9
          const effectiveSpeed = 1 + baseMotion + blobGain * (speedMul - 1)
          const secs = Math.max(4, baseSeconds / effectiveSpeed) / (layerParallax > 1 ? 1.06 : 1.0)

          const snapped = Math.round(secs * 20) / 20
          const dur = String(snapped)
          if ((outer as any).dataset._dur !== dur) {
            outer.style.animationDuration = `${dur}s`
            ;(outer as any).dataset._dur = dur
            prevRef.current.outerDur[i] = dur
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    const startRAF = () => {
      if (!rafRef.current) {
        lastRef.current = performance.now()
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    const stopRAF = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    let io: IntersectionObserver | null = null
    if (rootRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !paused) startRAF()
        else stopRAF()
      }, { threshold: 0.01 })
      io.observe(rootRef.current)
    }

    if (highlightRef.current) {
      const hue = 210
      const alphaCore = 0.5
      const alphaRing = 0.28
      const gradient = `radial-gradient(60% 60% at 50% 50%, hsla(${hue}, 78%, 60%, ${alphaCore}) 0%, hsla(${hue + 24}, 84%, 46%, ${alphaRing}) 42%, transparent 72%)`
      const el = highlightRef.current
      el.style.background = gradient
      el.style.width = `${highlightSize}px`
      el.style.height = `${highlightSize}px`
    }

    if (paused) {
      stopRAF()
    } else if (!io) {
      startRAF()
    }

    return () => {
      mountedRef.current = false
      if (io) io.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastRef.current = null
    }
  }, [
    paused,
    size,
    baseSpeed,
    speedBoost,
    densityBoost,
    oddMw,
    slewUpPerSec,
    slewDownPerSec,
    smoothFactor,
    inputGain,
    idleSuppression,
    inputGamma,
    radius,
    highlightSize,
    blobSeeds,
  ])

  return (
    <div
      ref={rootRef}
      className={["relative select-none", className ?? ""].join(" ")}
      style={{ width: size, height: size, contain: 'layout paint size', contentVisibility: 'auto' as any }}
      aria-hidden
    >
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: "radial-gradient(120% 120% at 20% 10%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 35%, rgba(0,0,0,0.10) 100%)",
          boxShadow: "inset 0 0 60px rgba(255,255,255,0.12), inset 0 0 180px rgba(0,0,0,0.22)",
          WebkitMaskImage: "-webkit-radial-gradient(white, black)",
          maskImage: "radial-gradient(circle, white 72%, rgba(255,255,255,0.9) 100%)",
        }}
      >
        <div
          ref={globalMoverRef}
          className="absolute inset-0 will-change-transform"
          style={{ transform: 'translate3d(0,0,0) rotate(0deg)' }}
        >
          <div
            ref={highlightRef}
            style={{
              position: 'absolute',
              filter: 'blur(12px)',
              mixBlendMode: 'screen',
              left: '50%',
              top: '50%',
              transform: 'translate3d(0,0,0)',
              width: highlightSize,
              height: highlightSize,
            }}
          />

          <div
            ref={colorGradeRef}
            className="absolute inset-0"
            style={{ mixBlendMode: 'screen', filter: 'saturate(1) contrast(1)' }}
          >
            {blobSeeds.map((b, i) => {
              const layerParallax = i % 2 === 0 ? 0.94 : 1.06
              const sizeBase = size * (0.56 + (b.s - 0.7) * 0.33) * layerParallax
              const sizePx = sizeBase

              const kfName = `drift${(b.path % 8) + 1}`

              const aCore = Math.min(0.9, Math.max(0.26, b.alpha - 0.1))
              const aRing = Math.min(0.7, Math.max(0.16, b.alpha * 0.55))
              const edgeStop = 64
              const gradient = `radial-gradient(60% 60% at 50% 45%, rgba(255,255,255,${aCore}) 0%, rgba(210,225,255,${aRing}) 35%, transparent ${edgeStop}%)`

              return (
                <div
                  key={i}
                  ref={setOuterBlobRef(i)}
                  className="absolute"
                  style={{
                    width: sizePx,
                    height: sizePx,
                    left: `${b.x * 60 - 10}%`,
                    top: `${b.y * 60 - 10}%`,
                    filter: 'blur(18px)',
                    animationName: kfName,
                    animationDuration: '12s',
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                    animationDelay: `${-b.delay}s`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                >
                  <div
                    ref={setInnerBlobRef(i)}
                    className="will-change-transform"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: gradient,
                      transform: `rotate(${b.rot}deg) scale(1)`,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: 'inset 0 0 140px rgba(0,0,0,0.26), inset 0 0 240px rgba(0,0,0,0.18)' }}
        />
      </div>

      <style>{`
        @keyframes drift1 {
          0% { transform: translate(-12%, -10%); }
          25% { transform: translate(24%, -6%); }
          50% { transform: translate(16%, 20%); }
          75% { transform: translate(-20%, 12%); }
          100% { transform: translate(-12%, -10%); }
        }
        @keyframes drift2 {
          0% { transform: translate(10%, -14%); }
          20% { transform: translate(20%, 6%); }
          55% { transform: translate(-18%, 16%); }
          85% { transform: translate(-8%, -20%); }
          100% { transform: translate(10%, -14%); }
        }
        @keyframes drift3 {
          0% { transform: translate(-16%, 8%); }
          30% { transform: translate(12%, 18%); }
          60% { transform: translate(18%, -16%); }
          100% { transform: translate(-16%, 8%); }
        }
        @keyframes drift4 {
          0% { transform: translate(14%, 12%); }
          35% { transform: translate(-18%, -10%); }
          70% { transform: translate(12%, -12%); }
          100% { transform: translate(14%, 12%); }
        }
        @keyframes drift5 {
          0%   { transform: translate(-20%, -12%); }
          25%  { transform: translate(22%,  10%); }
          55%  { transform: translate(18%, -18%); }
          85%  { transform: translate(-14%, 16%); }
          100% { transform: translate(-20%, -12%); }
        }
        @keyframes drift6 {
          0%   { transform: translate(16%, -20%); }
          30%  { transform: translate(-12%, 14%); }
          60%  { transform: translate(20%,  20%); }
          100% { transform: translate(16%, -20%); }
        }
        @keyframes drift7 {
          0%   { transform: translate(-18%,  18%); }
          35%  { transform: translate(14%, -16%); }
          70%  { transform: translate(20%,  12%); }
          100% { transform: translate(-18%, 18%); }
        }
        @keyframes drift8 {
          0%   { transform: translate(12%, 12%); }
          20%  { transform: translate(-20%, -10%); }
          50%  { transform: translate(18%, -18%); }
          80%  { transform: translate(-12%,  20%); }
          100% { transform: translate(12%, 12%); }
        }
      `}</style>
    </div>
  )
}
