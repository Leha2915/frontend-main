'use client'

import { FC, MouseEventHandler, useContext } from 'react'
import { cn } from '@/lib/utils'
import { InterviewHealthContext } from '@/context/health'

export type Severity = 'error' | 'warning' | 'ok' | null

interface StatusDotProps {
  title?: string
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLSpanElement>
  asButton?: boolean
}

export const StatusDot: FC<StatusDotProps> = ({
  title,
  className,
  onClick,
  asButton = false,
}) => {
  const health = useContext(InterviewHealthContext)
  const { severity, status, tooltip } = health

  const color =
    status === 'backend'
      ? 'bg-red-500 ring-red-200'
      : status === 'stt'
      ? 'bg-orange-600 ring-orange-200'
      : status === 'tts'
      ? 'bg-emerald-200 ring-emerald-100'
      : 'bg-emerald-500 ring-emerald-200'

  const shared = cn(
    'inline-flex h-2.5 w-2.5 rounded-full ring-4 transition-transform duration-150',
    'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1',
    color,
    className
  )

  const aria =
    severity === 'error'
      ? 'Error'
      : severity === 'warning'
      ? 'Warning'
      : 'OK'

  const computedTitle = title ?? tooltip

  return asButton ? (
    <button
      type="button"
      title={computedTitle}
      aria-label={aria}
      aria-live="polite"
      onClick={onClick}
      className={shared}
    />
  ) : (
    <span
      title={computedTitle}
      aria-label={aria}
      aria-live="polite"
      role="img"
      onClick={onClick}
      className={shared}
    />
  )
}
