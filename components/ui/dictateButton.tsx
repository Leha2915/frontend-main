'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  isDisabled?: boolean
  isRecording: boolean
  micLevel: number
  onStart: () => void | Promise<void>
  onStop: () => void | Promise<void>
  onCancel: () => void | Promise<void>
  onConfirmingChange?: (v: boolean) => void
}


export default function DictateButton({ isDisabled, isRecording, micLevel, onStart, onStop, onCancel, onConfirmingChange }: Props) {
  const [stopping, setStopping] = useState(false)

  const toggle = async () => {
    if (isRecording) {
      setStopping(true)
      onConfirmingChange?.(true)
      await new Promise(res => setTimeout(res, 1500))
      await onStop()
      setStopping(false)
      onConfirmingChange?.(false)
    } else {
      await onStart()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={toggle}
        disabled={!!isDisabled}
        size="icon"
        aria-label={isDisabled ? 'Disabled' : (isRecording ? 'Stop recording' : 'Start dictation')}
        title={isDisabled ? 'Disabled' : (isRecording ? 'Stop recording' : 'Start dictation')}
        className={cn(
          "h-12 w-12 p-0 rounded-xl transition-all duration-200",
          isRecording ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700",
          "disabled:bg-gray-300",
          "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "flex items-center justify-center",
          isDisabled ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"
        )}
      >
        {stopping ? (<Loader2 className="h-5 w-5 animate-spin text-white" />) : (isRecording ? <Check className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />)}
      </Button>

      {isRecording && (
        <Button
          onClick={onCancel}
          size="icon"
          aria-label="cancel"
          title="cancel"
          className={cn(
            "h-12 w-12 p-0 rounded-xl transition-all duration-200",
            "bg-red-600 hover:bg-red-700",
            "disabled:bg-gray-300",
            "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "flex items-center justify-center",
            isDisabled ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"
          )}
          //style={ isRecording && micLevel > 0.02 ? { boxShadow: `0 0 0 ${Math.min(12, micLevel*20)}px rgba(37,99,235,0.25)` } : undefined }
        >
          <X className="h-5 w-5 text-white" />
        </Button>
      )}
    </div>
  )
}
