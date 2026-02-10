'use client'

import { cn } from '@/lib/utils'

export default function MicBars({
  bars,
  className,
  barClassName = 'bg-blue-600',
}: {
  bars: number[]
  className?: string
  barClassName?: string
}) {
  return (
    <div className={cn("h-9 rounded-md border border-blue-200 bg-white/70 flex items-center px-3 overflow-hidden", className)}>
      <div className="flex-1 h-full flex items-end justify-between">
        {bars.map((h, idx) => (
          <span
            key={idx}
            className={cn("w-[3px] rounded-sm transition-[height] duration-75", barClassName)}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
    </div>
  )
}
