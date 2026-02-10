'use client'

import { useMutation } from '@tanstack/react-query'
import { getCookieName, getCookieValue, setCookie, getSessionId } from '@/lib/session'
import { Chat, ChatPromptAnswer, Message } from '@/lib/types'

type Opts = {
  chat: Chat
  model: string
  topic: string
  projectSlug: string
  onAddUser: (msg: Message) => void
  onStart?: () => void
  onParsedSuccess: (parsed: ChatPromptAnswer) => void | Promise<void>
  onErrorMsg?: (err: string) => void
}

export function useChatApi({ chat, model, topic, projectSlug, onAddUser, onStart, onParsedSuccess, onErrorMsg }: Opts) {
  const { chatid, messages, stimulus } = chat

  const { mutate, isPending } = useMutation<ChatPromptAnswer, Error, Message>({
    mutationKey: ['sendMessage', chatid, messages.length],
    mutationFn: async (userMsg) => {
      const cookieName = getCookieName(projectSlug)
      let sessionId = getCookieValue(cookieName)
      if (!sessionId) { sessionId = getSessionId(projectSlug); setCookie(cookieName, sessionId) }
      const payload = { topic, stimulus, messages: [...messages, userMsg], model, projectSlug, session_id: sessionId, chat_id: chatid }
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' })
      if (!res.ok) throw new Error((await res.json()).detail ?? 'unknown')
      return res.json() as Promise<ChatPromptAnswer>
    },
    onMutate(userMsg) {
      onAddUser(userMsg)
      onStart?.()
    },
    async onSuccess(parsed) {
      if (parsed.Next?.session_id) {
        const cookieName = getCookieName(projectSlug)
        setCookie(cookieName, parsed.Next.session_id)
        try { localStorage.setItem(`interview_session_${projectSlug}`, parsed.Next.session_id) } catch {}
      }
      await onParsedSuccess(parsed)
    },
    onError(err) {
      onErrorMsg?.(err.message || 'Unknown Error')
    }
  })

  return {
    isLoading: isPending,
    sendMessage: mutate
  }
}
