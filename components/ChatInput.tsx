'use client'

import { FC, HTMLAttributes, useContext, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Loader2, AudioLines } from 'lucide-react'
import { ChatsContext } from '@/context/chats'
import { SettingsContext } from '@/context/settings'
import { Chat, ChatPromptAnswer, Message } from '@/lib/types'

import { useChatApi } from '@/components/hooks/useChatApi'
import { speakAnswer, stopTTS } from '@/lib/t2s'

import DictateButton from '@/components/ui/dictateButton'
import AvmOverlay from '@/components/ui/avmOverlay/avmOverlay'
import UploadWav from '@/components/ui/uploadWav'
import DisabledWithTooltip from '@/components/ui/disabledWithTooltip'
import { useServiceHealth } from '@/components/hooks/useHealthChecker'
import { InterviewHealthContext } from '@/context/health'

import { useDictation } from '@/components/hooks/useDictation'
import MicBars from '@/components/ui/micBar'
import { useAvm } from '@/components/hooks/useAvm'

import { useTextLogging } from '@/components/hooks/useTextLogging'
import { useVoiceLogging } from '@/components/hooks/useVoiceLogging'
import { useLogging } from '@/context/logging'

const DEV_ALLOW_WAV_UPLOAD = false
const DEV_ALLOW_BUFFER_BOX = false

interface ChatInputProps extends HTMLAttributes<HTMLDivElement> {
  chat: Chat
  topic: string
  model: string
  waitingForInitialResponse?: boolean
}

const ChatInput: FC<ChatInputProps> = ({ className, chat, topic, model, waitingForInitialResponse = false, ...props }) => {
  const api_url = process.env.NEXT_PUBLIC_API_URL
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [input, setInput] = useState('')
  const [lockedInputHeight, setLockedInputHeight] = useState<number | null>(null)
  const [avmOpen, setAvmOpen] = useState(false)
  const [ttsTalking, setTtsTalking] = useState(false)
  const [agentLevel, setAgentLevel] = useState(0)

  const [awaitingLLM, setAwaitingLLM] = useState(false)

  const fsRef = useRef<HTMLDivElement | null>(null)
  const avmOpenRef = useRef(avmOpen)
  const { projectSlug, voiceEnabled, interviewMode, dictationEnabled, autoSendAvm, language } = useContext(SettingsContext)

  const { addMessageToChat, addMessageToRawChat, setLastLLMTought, setChatfinished } = useContext(ChatsContext)
  const { chatid, messages, rawMessages } = chat
  const health = useContext(InterviewHealthContext)

  useServiceHealth({ apiUrl: api_url, projectSlug, voiceEnabled: voiceEnabled || dictationEnabled, interviewMode })

  const textLog = useTextLogging({ topicKind: topic, chatId: chatid })
  const voiceLog = useVoiceLogging({ topicKind: topic, chatId: chatid })
  const { log, getCtx } = useLogging()

  useEffect(() => {
    log({
      type: 'focus_chat',
      ctx: { ...getCtx(), topicKind: topic, chatId: chatid },
    })
  }, [chatid])

  const {
    recording: dictationRecording,
    bars,
    micLevel: dictationMicLevel,
    start: startDictationRaw,
    stop: stopDictationRaw,
    cancel: cancelDictationRaw,
    setConfirmingPause: setHistoryPaused,
    drainBuffer,
  } = useDictation({
    enabled: dictationEnabled && !avmOpen && !chat.finished,
    onError: () => { health.setSttUnavailable(true) },
    onOpen: () => {
      health.setSttUnavailable(false)
      health.setBackendUnavailable(false)
    },
    upload: true
  })

  const { isLoading, sendMessage } = useChatApi({
    chat, model, topic, projectSlug,
    onAddUser: (msg) => {
      if (interviewMode === 3) {
        addMessageToRawChat(chatid, msg)
      } else {
        addMessageToChat(chatid, msg)
        addMessageToRawChat(chatid, msg)
      }
    },
    onStart: () => { setInput('') },
    onParsedSuccess: async (parsed) => {
      addMessageToRawChat(chatid, parsed)
      const { Next: { NextQuestion, ThoughtProcess, EndOfInterview, CompletionReason, ValuesCount, ValuesMax } } = parsed

      if (EndOfInterview) {
        setChatfinished(chatid, true)
        const msg = CompletionReason === 'VALUES_LIMIT_REACHED'
          ? `You completed the first chat! We have identified ${ValuesCount}${ValuesMax ? ` out of ${ValuesMax}` : ''} core values. This provides comprehensive insights into what matters most to you.\n\n[Enter] will take you to the next page, you can choose the [topic] to continue left or finish the interview when all topics are completed.`
          : 'This chat is now finished.\n\n[Enter] will take you to the next page, you can choose the [topic] to continue left or finish the interview when all topics are completed.'
        addMessageToChat(chatid, { id: nanoid(), isUserMessage: false, text: msg })
      } else {
        if (interviewMode !== 3) {
          addMessageToChat(chatid, { id: nanoid(), isUserMessage: false, text: NextQuestion })
        }
        setLastLLMTought(chatid, ThoughtProcess)
      }

      if (avmOpenRef.current) {
        setTtsTalking(true)
        await speakAnswer({
          api_url: api_url || '',
          projectSlug,
          text: parsed?.Next?.NextQuestion || '',
          avmOpen: avmOpenRef.current,
          chatFinished: !!chat.finished,
          onLevel: (rms) => setAgentLevel(rms),
          onAfterAudio: async () => {
            setTtsTalking(false)
            setAgentLevel(0)
          },
          language: language
        })
      }

      setAwaitingLLM(false)
    },
    onErrorMsg: (err) => {
      addMessageToChat(chatid, { id: nanoid(), isUserMessage: false, text: `Error sending message: ${err}` })
      health.setBackendUnavailable(true)
      setAwaitingLLM(false)
    }
  })

  const sendUserMessage = (text: string) => {
    const id = nanoid()
    setAwaitingLLM(true)
    const msg: Message = { id, isUserMessage: true, text }
    sendMessage(msg)
    textLog.onSend(text, id)
  }

  const isAwaitingReply =
    awaitingLLM ||
    waitingForInitialResponse ||
    isLoading

  const avm = useAvm({
    autoSend: autoSendAvm,
    canRecord: avmOpen && !chat.finished,
    suspend: isAwaitingReply || ttsTalking || isLoading,
    onSend: async (text) => {
      voiceLog.onSendVoice({ textLength: (text || '').length, value: text })
      sendUserMessage(text)
    },
    onError: () => { health.setSttUnavailable(true) },
    onOpen: () => {
      health.setSttUnavailable(false)
      health.setBackendUnavailable(false)
    },
    upload: true
  })
  const avmRecording = avm.recording
  const avmMicLevel = avm.micLevel
  const avmBuffered = avm.buffered
  const avmIsFlushing = avm.isFlushing

  const handleSendMessage = async () => {
    if (!input.trim() || chat.finished || waitingForInitialResponse) return
    if (dictationRecording) await stopDictation()
    if (avmRecording) await avm.toggleRecording()
    setAvmOpen(false)
    sendUserMessage(input.trim())
    if (textareaRef.current) textareaRef.current.style.height = '52px'
  }

  const startDictation = async () => {
    if (chat.finished || avmOpen) return
    log({
      type: 'start_dictation',
      ctx: { ...getCtx(), topicKind: topic, chatId: chatid },
    })
    await startDictationRaw()
  }

  const stopDictation = async () => {
    await stopDictationRaw()
    const text = (drainBuffer() || '').trim()

    log({
      type: 'end_dictation',
      ctx: { ...getCtx(), topicKind: topic, chatId: chatid },
      textLength: (text || '').length,
      value: text,
    })

    if (text) setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)
  }

  const cancelDictationAndClear = async () => {
    await cancelDictationRaw()
    log({
      type: 'cancel_dictation',
      ctx: { ...getCtx(), topicKind: topic, chatId: chatid },
    })
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px'
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }

  const isMessage = (x: Message | ChatPromptAnswer): x is Message => {
    return typeof (x as any)?.isUserMessage === 'boolean' && typeof (x as any)?.text === 'string'
  }

  const isChatAnswer = (x: Message | ChatPromptAnswer): x is ChatPromptAnswer => {
    return typeof (x as any)?.Next === 'object'
  }

  const getBotText = (x: Message | ChatPromptAnswer): string | undefined => {
    if (isMessage(x)) {
      return !x.isUserMessage ? (x.text ?? '').trim() : undefined
    }
    if (isChatAnswer(x)) {
      const t = x.Next?.NextQuestion
      return typeof t === 'string' ? t.trim() : undefined
    }
    return undefined
  }

  const getLastBotMessageText = (): string | undefined => {
    for (let i = rawMessages.length - 1; i >= 0; i--) {
      const txt = getBotText(rawMessages[i])
      if (txt) return txt
    }
    return undefined
  }

  const openAvm = async () => {
    if (chat.finished) return
    setAvmOpen(true)
    voiceLog.onVoiceOpen()
  }

  const closeAvm = async () => {
    voiceLog.onVoiceExit()
    stopTTS()
    setTtsTalking(false)
    setAvmOpen(false)
    setAgentLevel(0)
    try { await avm.stop() } catch {}
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleSkip = async () => {
    voiceLog.onVoiceSkip()
    setTtsTalking(false)
    try { stopTTS() } catch {}
    setAgentLevel(0)
  }

  const handleToggleRecording = async () => {
    voiceLog.onVoiceConfirm()
    await avm.toggleRecording()
  }

  type AgentState = 'awaiting' | 'speaking' | 'recording' | 'idle'

  const agentState: AgentState =
    isAwaitingReply ? 'awaiting'
    : ttsTalking    ? 'speaking'
    : avmRecording  ? 'recording'
                    : 'idle'

  useEffect(() => { avmOpenRef.current = avmOpen }, [avmOpen])

  useEffect(() => {
    if (!chat.finished) return
    try { stopTTS() } catch {}
    avm.stop().catch(() => {})
    if (avmOpen) setAvmOpen(false)
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [chat.finished, avm, avmOpen])

  useEffect(() => {
    if (!avmOpen || chat.finished) return
    const lastBot = getLastBotMessageText()
    ;(async () => {
      if (lastBot) {
        setTtsTalking(true)
        await speakAnswer({
          api_url: api_url || '',
          projectSlug,
          text: lastBot,
          avmOpen: true,
          chatFinished: !!chat.finished,
          onLevel: (rms) => setAgentLevel(rms),
          onAfterAudio: async () => {
            setTtsTalking(false)
            setAgentLevel(0)
          },
          language: language
        })
      }
    })()
  }, [avmOpen])

  useEffect(() => {
    if (!avmOpen) return
    const el = fsRef.current
    if (!el) return
    const req = (el as any).requestFullscreen?.bind(el) || (el as any).webkitRequestFullscreen?.bind(el)
    try { req?.({ navigationUI: 'hide' }) } catch {}
  }, [avmOpen])

  useEffect(() => {
    const onFsChange = () => { if (avmOpen && !document.fullscreenElement) closeAvm() }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange as any)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as any)
    }
  }, [avmOpen])

  useEffect(() => () => { try { stopTTS() } catch {} }, [])

  useEffect(() => {
    stopTTS()
    cancelDictationRaw().catch(() => {})
    setLockedInputHeight(null)
    if (avmOpen) { closeAvm().catch(() => {}) }
    else { avm.stop().catch(() => {}) }
    setInput('')
    setAwaitingLLM(false)
  }, [chatid])

  useEffect(() => {
    if (!health.sttUnavailable) return
    ;(async () => {
      try { await stopDictationRaw() } catch {}
      setLockedInputHeight(null)
    })();
    (async () => { try { await avm.stop() } catch {} })()
    try { textareaRef.current?.focus() } catch {}
  }, [health])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { if (!lockedInputHeight) setLockedInputHeight(null) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [lockedInputHeight])

  const reasonBackend = health.backendUnavailable ? 'backend temporarily unavailable.' : ''
  const reasonTTS = health.ttsUnavailable
    ? (health.backendUnavailable
        ? 'backend unavailable – TTS unavailable.'
        : 'ElevenLabs configuration unavailable – using browser tts.')
    : ''
  const reasonSTT = health.sttUnavailable ? 'The speech to text service is temporarily unavailable.' : ''

  const sendDisabled =
    !input.trim() || chat.finished || waitingForInitialResponse || dictationRecording || health.backendUnavailable

    if (interviewMode === 3) {
      return (
        <div {...props} className={cn('bg-white', className)}>
          <div className="p-6 flex items-center justify-center min-h-[200px]">
            <DisabledWithTooltip
              disabled={chat.finished || health.backendUnavailable || health.sttUnavailable}
              reason={
                chat.finished
                  ? 'Chat is finished.'
                  : health.backendUnavailable
                    ? reasonBackend
                    : health.sttUnavailable
                      ? reasonSTT
                      : null
              }
            >
              <Button
                onClick={openAvm}
                disabled={chat.finished || health.backendUnavailable || health.sttUnavailable}
                size="lg"
                className={cn(
                  "h-14 px-6 rounded-2xl transition-all duration-200",
                  "bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300",
                  "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  "flex items-center justify-center"
                )}
                title={chat.finished ? 'Chat is finished' : 'Start voice chat'}
              >
                <AudioLines className="mr-2 h-5 w-5" />
                {chat.rawMessages.length < 3 ? "Start voice chat" : "Resume voice chat"}
              </Button>
            </DisabledWithTooltip>
          </div>

          {avmOpen && (
            <AvmOverlay
              ref={fsRef}
              state={agentState}
              micLevel={avmMicLevel}
              agentLevel={agentLevel}
              onClose={closeAvm}
              onSkip={handleSkip}
              onToggleRecord={handleToggleRecording}
              autoSend={autoSendAvm}
              onSendBuffered={avm.flush}
              sendDisabled={avm.sendDisabled || avmIsFlushing}
            >
              <div
                className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
                aria-hidden
              />
            </AvmOverlay>
          )}
        </div>
      )
    }

  return (
    <div {...props} className={cn('bg-white', className)}>
      <div className="p-4">

        <div className={cn("flex items-center gap-2 rounded-2xl border bg-gray-50 px-3 py-2 border-gray-200")}>
          <div className="relative flex-1" style={lockedInputHeight ? { height: lockedInputHeight } : undefined}>

            {( interviewMode != 3 &&
              <Textarea
                ref={textareaRef}
                rows={1}
                value={input}
                autoFocus
                disabled={
                  (dictationRecording && !avmOpen) ||
                  chat.finished ||
                  isLoading ||
                  waitingForInitialResponse ||
                  awaitingLLM
                }
                placeholder={
                  dictationRecording && !avmOpen ? 'Listening…' :
                  chat.finished ? 'Chat is finished' :
                  isLoading || awaitingLLM ? 'Waiting for answer...' :
                  waitingForInitialResponse ? 'Waiting for the AI to start the conversation...' :
                  'Type your message here...'
                }
                className={cn(
                  "min-h-[56px] max-h-40 resize-none w-full bg-transparent border-0 px-2 py-3 text-sm focus:outline-none focus:ring-0",
                  chat.finished && "cursor-not-allowed",
                  ((isLoading || awaitingLLM || (dictationRecording && !avmOpen))) && "opacity-90",
                  waitingForInitialResponse && "placeholder:text-blue-700"
                )}
                onPaste={(e) => e.preventDefault()}
                onFocus={(e) => textLog.onFocus(e.currentTarget.value)}
                onBlur={(e) => textLog.onBlur(e.currentTarget.value)}
                onChange={(e) => { setInput(e.target.value); textLog.onChange(e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                onInput={(e) => {
                  const target = (e.target as HTMLTextAreaElement)
                  target.style.height = '56px'
                  target.style.height = Math.min(target.scrollHeight, 160) + 'px'
                  if (!dictationRecording) setLockedInputHeight(null)
                }}
              />
            )}

            {dictationRecording && !avmOpen && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-xl bg-white/85 backdrop-blur-sm",
                  "flex flex-col items-center justify-center gap-2"
                )}
                aria-live="polite"
              >
                <div className="w-[96%]">
                  <MicBars bars={bars} />
                </div>
              </div>
            )}

          </div>

          <div className="flex items-center gap-2 shrink-0">
            {dictationEnabled && (
              <DisabledWithTooltip
                disabled={
                  chat.finished ||
                  isLoading ||
                  awaitingLLM ||
                  health.backendUnavailable ||
                  health.sttUnavailable
                }
                reason={
                  chat.finished
                    ? 'Chat is finished.'
                    : health.backendUnavailable
                      ? reasonBackend
                      : health.sttUnavailable
                        ? reasonSTT
                        : (isLoading || awaitingLLM)
                          ? 'wait for response'
                          : null
                }
              >
                {interviewMode != 3 &&
                  <div>
                    <DictateButton
                      isDisabled={
                        chat.finished ||
                        isLoading ||
                        awaitingLLM ||
                        health.backendUnavailable ||
                        health.sttUnavailable
                      }
                      isRecording={dictationRecording}
                      micLevel={dictationMicLevel}
                      onStart={startDictation}
                      onStop={stopDictation}
                      onCancel={cancelDictationAndClear}
                      onConfirmingChange={setHistoryPaused}
                    />
                  </div>
                }
              </DisabledWithTooltip>
            )}

            {voiceEnabled && (
              <DisabledWithTooltip
                disabled={chat.finished || health.backendUnavailable || health.ttsUnavailable}
                reason={
                  chat.finished
                    ? 'Chat is finished.'
                    : health.backendUnavailable
                      ? reasonBackend
                      : health.ttsUnavailable
                        ? reasonTTS
                        : null
                }
              >
                <Button
                  onClick={openAvm}
                  disabled={chat.finished || health.backendUnavailable || health.sttUnavailable}
                  size="default"
                  className={cn(
                    "h-12 w-12 p-0 rounded-xl transition-all duration-200 bg-grey hover:bg-grey",
                    "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    "flex items-center justify-center shrink-0",
                    chat.finished ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"
                  )}
                  title={chat.finished ? 'Chat is finished' : 'Start voice chat (Advanced)'}
                >
                  <AudioLines className="h-5 w-5 text-black" />
                </Button>
              </DisabledWithTooltip>
            )}

            {DEV_ALLOW_WAV_UPLOAD && (
              <UploadWav
                disabled={chat.finished}
                api_url={api_url || ''}
                onTranscript={(text) => {
                  if (!text || chat.finished) return
                  setInput(prev => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${text}` : text))
                  stopDictation().catch(() => {})
                }}
                onError={(msg) => addMessageToChat(chatid, { id: nanoid(), isUserMessage: false, text: msg })}
              />
            )}

            <DisabledWithTooltip
              disabled={sendDisabled}
              reason={
                chat.finished ? 'Chat is finished.' :
                waitingForInitialResponse ? 'Waiting for initial response…' :
                !input.trim() ? 'Please provide a message first.' :
                dictationRecording ? 'Dictating...' :
                health.backendUnavailable ? reasonBackend :
                null
              }
            >
              {interviewMode != 3 &&
                <Button
                  onClick={handleSendMessage}
                  disabled={sendDisabled}
                  size="default"
                  className={cn(
                    "h-12 w-12 p-0 rounded-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300",
                    "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    "flex items-center justify-center shrink-0",
                    (!input.trim() || chat.finished || waitingForInitialResponse) ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"
                  )}
                  title={
                    chat.finished ? 'Chat is finished' :
                    waitingForInitialResponse ? 'Waiting for AI to respond' :
                    (!input.trim() ? 'Type a message to send' : 'Send message (Enter)')
                  }
                >
                  {isLoading || awaitingLLM
                    ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                    : <Send className="h-5 w-5 text-white" />
                  }
                </Button>
              }

            </DisabledWithTooltip>
          </div>
        </div>
      </div>

      {avmOpen && (
        <AvmOverlay
          ref={fsRef}
          state={agentState}
          micLevel={avmMicLevel}
          agentLevel={agentLevel}
          onClose={closeAvm}
          onSkip={handleSkip}
          onToggleRecord={handleToggleRecording}
          autoSend={autoSendAvm}
          onSendBuffered={avm.flush}
          sendDisabled={avm.sendDisabled}
        >
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[min(800px,92vw)] space-y-3 pointer-events-auto">

            {DEV_ALLOW_BUFFER_BOX &&
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium px-3 py-2 rounded-lg bg-white/70 backdrop-blur">
                  Auto-Send: <span className="font-semibold">{autoSendAvm ? 'AN' : 'AUS'}</span>
                </div>
              </div>
            }

            {(!autoSendAvm && DEV_ALLOW_BUFFER_BOX) && (
              <div className="rounded-xl bg-white/80 backdrop-blur p-3 border border-gray-200">
                <div className="text-xs text-gray-600 mb-2">buffered msgs</div>
                <div className="max-h-40 overflow-auto whitespace-pre-wrap text-sm">
                  {avmBuffered || <span className="italic text-gray-400">— leer —</span>}
                </div>

                {avmRecording && (
                  <div className="mt-2 text-xs text-gray-500">
                    active
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
            aria-hidden
          />
        </AvmOverlay>
      )}
    </div>
  )
}

export default ChatInput
