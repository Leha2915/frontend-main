"use client"

import { useLogging } from "@/context/logging"

type SendVoicePayload = {
  textLength?: number
  value?: string
}

export function useVoiceLogging(params?: { topicKind?: string; chatId?: string }, dummy: boolean = false) {
  const { log, getCtx } = useLogging(dummy)
  const baseCtx = () => ({ ...getCtx(), topicKind: params?.topicKind, chatId: params?.chatId })

  const onVoiceOpen = () => log({ type: "voice_open", ctx: baseCtx() })
  const onVoiceConfirm = () => log({ type: "voice_confirm", ctx: baseCtx() })
  const onVoiceSkip = () => log({ type: "voice_skip", ctx: baseCtx() })
  const onVoiceExit = () => log({ type: "voice_exit", ctx: baseCtx() })

  const onSendVoice = (payload?: SendVoicePayload) =>
    log({ type: "send_voice", ctx: baseCtx(), textLength: payload?.textLength, value: payload?.value })

  return { onVoiceOpen, onVoiceConfirm, onVoiceSkip, onVoiceExit, onSendVoice }
}
