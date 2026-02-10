"use client"

import { useContext, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import getTranslation from "@/lib/translation"
import { SettingsContext } from "@/context/settings"

const NS = "components_ui_onboardingPopup.OnboardingPopup"

export default function WelcomePopup({
  open,
  onClose,
  onStart,
  className,
}: {
  open: boolean
  onClose: () => void
  onStart?: () => void
  className?: string
}) {

  const sc = useContext(SettingsContext);
  const lang = sc.language;
  
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center",
        "bg-black/40 backdrop-blur-sm",
        className
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          "relative max-w-lg w-[92%] sm:w-full",
          "rounded-3xl border border-gray-100 bg-gradient-to-b from-white to-gray-50 shadow-2xl",
          "p-8 sm:p-10"
        )}
      >
        <button
          type="button"
          aria-label={getTranslation(`${NS}.close_aria`, lang)}
          className={cn(
            "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center",
            "rounded-full border border-gray-200 bg-white/80 hover:bg-white",
            "shadow-sm transition-all hover:scale-105"
          )}
          onClick={onClose}
          title={getTranslation(`${NS}.close_title`, lang)}
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <div className="text-center space-y-4">
          <h2
            id="welcome-title"
            className="text-3xl font-bold tracking-tight text-gray-900"
          >
            {getTranslation(`${NS}.title`, lang)}
          </h2>
          <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
            {getTranslation(`${NS}.description`, lang)}
          </p>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button
            className="rounded-xl px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium shadow-md hover:shadow-lg hover:scale-[1.02] transition"
            onClick={() => {
              onStart?.()
              onClose()
            }}
          >
            {getTranslation(`${NS}.start_btn`, lang)}
          </Button>
        </div>
      </div>
    </div>
  )
}
