'use client'

import * as React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type DisabledWithTooltipProps = {
  disabled?: boolean
  reason?: string | null
  children: React.ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const DisabledWithTooltip: React.FC<DisabledWithTooltipProps> = ({ disabled, reason, children, side = 'top' }) => {
  if (!disabled || !reason) return children

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>
          <span className="text-sm">{reason}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default DisabledWithTooltip
