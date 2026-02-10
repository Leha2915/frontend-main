export type EventType =
  | "text_focus"
  | "text_change"
  | "text_blur"
  | "text_send"
  | "voice_open"
  | "voice_confirm"
  | "voice_skip"
  | "voice_exit"
  | "send_voice"
  | "start_dictation"
  | "end_dictation"
  | "cancel_dictation"
  | "focus_chat"

export interface LoggingContext {
  sessionId: string
  participantId?: string
  projectSlug?: string
  topicKind?: string
  chatId?: string
}

export interface LogEvent {
  id: string
  type: EventType
  ts: number
  ctx: LoggingContext
  value?: string
  draftId?: string
  messageId?: string
  textLength?: number
  edited?: boolean
  compositionMs?: number
  meta?: Record<string, any>
}
