'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type WavesProps = {
  running: boolean
  opacity?: number
  background?: string
  className?: string
}

export default function Waves({
  running,
  opacity = 0.9,
  background = 'transparent',
  className,
}: WavesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.max(1, window.devicePixelRatio || 1)

    const resize = () => {
      const { clientWidth, clientHeight } = canvas
      canvas.width = Math.floor(clientWidth * dpr)
      canvas.height = Math.floor(clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let mounted = true

    const draw = (t: number) => {
      if (!mounted) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      if (background !== 'transparent') {
        ctx.globalAlpha = 1
        ctx.fillStyle = background
        ctx.fillRect(0, 0, w, h)
      }

      const time = (t - startRef.current) / 1000
      const mid = h * 0.5
      const baseAmp = Math.max(12, h * 0.065)
      const lineW = 2

      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, 'rgba(255,255,255,0.9)')
      grad.addColorStop(1, 'rgba(180,200,255,0.85)')

      const waves = [
        { speed: 0.9,  freq: 1.5 / 800,  amp: baseAmp * 1.0,  blur: 6,  alpha: 0.9 },
        { speed: 0.6,  freq: 1.0 / 900,  amp: baseAmp * 0.7,  blur: 10, alpha: 0.7 },
        { speed: 0.45, freq: 0.8 / 1000, amp: baseAmp * 0.45, blur: 14, alpha: 0.55 },
      ]

      waves.forEach((wcfg, i) => {
        ctx.save()
        ctx.lineWidth = lineW
        ctx.strokeStyle = grad
        ctx.globalAlpha = wcfg.alpha * opacity
        ;(ctx as any).filter = `blur(${wcfg.blur}px)`
        ctx.beginPath()
        const phase = time * Math.PI * 2 * wcfg.speed + i * Math.PI * 0.33
        const k = wcfg.freq
        for (let x = 0; x <= w; x += 2) {
          const y =
            mid +
            Math.sin(x * k + phase) * wcfg.amp * 0.85 +
            Math.sin(x * k * 0.5 + phase * 0.7) * (wcfg.amp * 0.35)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      })
    }

    const loop = (now: number) => {
      if (!mounted) return
      if (!startRef.current) startRef.current = now
      draw(now)
      rafRef.current = running ? requestAnimationFrame(loop) : null
    }

    if (running) {
      rafRef.current = requestAnimationFrame(loop)
    } else {
      const t = performance.now()
      startRef.current = startRef.current || t
      draw(t)
    }

    return () => {
      mounted = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [running, opacity, background])

  return (
    <div className={cn('absolute inset-0 z-0 pointer-events-none', className)}>
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: 'screen',
          background:
            'radial-gradient(1200px 600px at 50% 60%, rgba(51,93,255,0.25), transparent 60%)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        aria-hidden
      />
    </div>
  )
}
