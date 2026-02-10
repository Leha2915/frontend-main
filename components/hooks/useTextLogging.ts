"use client"

import { useRef } from "react"
import { useLogging } from "@/context/logging"

const uid = () => Math.random().toString(36).slice(2)

export function useTextLogging(params?: { topicKind?: string; chatId?: string }, dummy: boolean = false) {
  const { log, getCtx } = useLogging(dummy)
  const draftIdRef = useRef<string | null>(null)
  const startTsRef = useRef<number | null>(null)
  const initialTextRef = useRef<string>("")
  const lastTextRef = useRef<string>("")

  const ensureDraft = (currentValue: string) => {
    if (!draftIdRef.current) {
      draftIdRef.current = uid()
      startTsRef.current = Date.now()
      initialTextRef.current = currentValue || ""
      lastTextRef.current = currentValue || ""
    }
  }

  const onFocus = (value: string) => {
    ensureDraft(value)
    log({
      type: "text_focus",
      ctx: { ...getCtx(), topicKind: params?.topicKind, chatId: params?.chatId },
      draftId: draftIdRef.current!,
      textLength: (value || "").length,
    })
  }

  const onChange = (nextValue: string) => {
    ensureDraft(nextValue)
    lastTextRef.current = nextValue
    log({
      type: "text_change",
      ctx: { ...getCtx(), topicKind: params?.topicKind, chatId: params?.chatId },
      value: nextValue,
      draftId: draftIdRef.current!,
      textLength: (nextValue || "").length,
    })
  }

  const onBlur = (value: string) => {
    if (!draftIdRef.current) return
    log({
      type: "text_blur",
      ctx: { ...getCtx(), topicKind: params?.topicKind, chatId: params?.chatId },
      draftId: draftIdRef.current!,
      textLength: (value || "").length,
    })
  }

  const onSend = (finalText: string, messageId?: string) => {
    if (!draftIdRef.current) ensureDraft(finalText)
    const edited = initialTextRef.current !== (finalText || "")
    const compositionMs = startTsRef.current ? Date.now() - startTsRef.current : undefined

    log({
      type: "text_send",
      ctx: { ...getCtx(), topicKind: params?.topicKind, chatId: params?.chatId },
      draftId: draftIdRef.current!,
      messageId,
      textLength: (finalText || "").length,
      edited,
      compositionMs,
      value: finalText
    })

    draftIdRef.current = null
    startTsRef.current = null
    initialTextRef.current = ""
    lastTextRef.current = ""
  }

  return { onFocus, onChange, onBlur, onSend }
}
