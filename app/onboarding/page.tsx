"use client"

import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, AudioLines, Send, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import DictateButton from "@/components/ui/dictateButton"
import { SettingsContext } from "@/context/settings"
import { useJWTAuth } from "@/context/jwtAuth"
import AvmOverlay from "@/components/ui/avmOverlay/avmOverlay"
import { speakAnswer, stopTTS, initTtsAvailability } from "@/lib/t2s"

import { useDictation } from "@/components/hooks/useDictation"
import MicBars from "@/components/ui/micBar"
import { useAvm } from "@/components/hooks/useAvm"

import { onboardingChat } from "@/lib/onboardingChat"
import { buildTopics, recomputeFinished } from "@/app/onboarding/tutorials"
import { Topic, MockMsg, countByRole, uid } from "@/app/onboarding/tutorials/types"

import { useTextLogging } from "@/components/hooks/useTextLogging"
import { useVoiceLogging } from "@/components/hooks/useVoiceLogging"
import { useLogging } from "@/context/logging"

import WelcomePopup from "@/components/ui/onboardingPopup/OnboardingPopup"
import getTranslation from "@/lib/translation"

const DEFAULT_BOT_DELAY = 900

export default function OnboardingPage() {
  const router = useRouter()
  const sc = useContext(SettingsContext)

  const lang = sc.language;
  const { isGuest, enterAsGuest } = useJWTAuth()

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || ""
    const slug = sc.projectSlug || localStorage.getItem("project") || ""
    if (!slug) return
    let cancelled = false
    const needsHydration = !sc.projectSlug
    if (needsHydration) {
      ;(async () => {
        try {
          const res = await fetch(`${api}/projects/${slug}`, { credentials: "include" })
          if (!res.ok) return
          const data = await res.json()
          if (cancelled) return
          sc.setProjectSlug(slug)
          sc.setTopic(data.topic)
          sc.setDescription(data.description)
          sc.setStimuli(data.stimuli)
          sc.setN_stimuli(data.n_stimuli)
          sc.setVoiceEnabled(data.advanced_voice_enabled)
          sc.setDictationEnabled(data.voice_enabled)
          sc.setInterviewMode(data.interview_mode)
          sc.setTreeEnabled(data.tree_enabled)
          sc.setAutoSendAvm(data.auto_send)
          sc.setTimeLimit(data.time_limit)
          sc.setLanguage(data.language)
        } catch {}
      })()
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const project_slug = localStorage.getItem("project") ?? ""
    if (!project_slug) return
    if (!isGuest) { enterAsGuest(project_slug) }
  }, [isGuest, enterAsGuest])

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || ""
    const slug = sc.projectSlug || localStorage.getItem("project") || ""
    initTtsAvailability(api, slug).catch(() => {})
  }, [sc.projectSlug])

  const ENABLES = useMemo(
    () => ({
      dictation: sc.dictationEnabled && sc.interviewMode !== 3,
      voice: sc.voiceEnabled,
      text: sc.interviewMode !== 3,
    }),
    [sc.dictationEnabled, sc.voiceEnabled, sc.interviewMode]
  )

  const built = useMemo(
    () =>
      buildTopics({
        interviewMode: sc.interviewMode,
        dictationEnabled: sc.dictationEnabled,
        voiceEnabled: sc.voiceEnabled,
      }),
    [sc.interviewMode, sc.dictationEnabled, sc.voiceEnabled]
  )

  const [topics, setTopics] = useState<Topic[]>(built)
  useEffect(() => {
    setTopics(built)

    try {
      const stageStr = localStorage.getItem("ladderchat-onboarding-stage")
      if (stageStr !== null) {
        const parsed = parseInt(stageStr, 10)
        const s = Number.isFinite(parsed)
          ? Math.max(0, Math.min(parsed, topics.length - 1))
          : 0

        setTopics((prev) =>
          prev.map((t, i) => ({
            ...t,
            finished: i < s,
            inProgress: i === s,
          }))
        )

        setActiveIdx(s)
      }
    } catch {}

  }, [built])

  const [activeIdx, setActiveIdx] = useState(0)
  const activeTopic = topics[activeIdx]

  const textLog = useTextLogging({ topicKind: activeTopic.kind, chatId: activeTopic.chatid }, true) //dummy
  const voiceLog = useVoiceLogging({ topicKind: activeTopic.kind, chatId: activeTopic.chatid }, true) //dummy
  const { log, getCtx } = useLogging(true) //dummy

  const [messages, setMessages] = useState<MockMsg[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [enterHint, setEnterHint] = useState(false)
  const allFinished = useMemo(() => topics.every((t) => t.finished), [topics])

  const [avmSpeakAccumMs, setAvmSpeakAccumMs] = useState(0)
  const [avmSendHighlight, setAvmSendHighlight] = useState(false)
  const AVM_HIGHLIGHT_AFTER_MS = 10_000
  const AVM_SAMPLE_INTERVAL_MS = 100

  
  const lastMsgRef = useRef<HTMLDivElement | null>(null)
  const timersRef = useRef<number[]>([])
  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }

  const messagesRef = useRef<MockMsg[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
    enabled:
      ENABLES.dictation &&
      (activeTopic.kind === "dictate" || activeTopic.kind === "all") &&
      !activeTopic.finished,
    onError: () => {
      enqueueMessages([
        {
          id: uid(),
          role: "system",
          text: getTranslation("app_onboarding.Onboarding.msg_transcribe_unavailable", lang),
          delayMs: 0,
        },
      ])
    },
    onOpen: () => {
      enqueueMessages([{ id: uid(), role: "system", text: getTranslation("app_onboarding.Onboarding.msg_connected", lang), delayMs: 0 }])
    },
    upload: false
  })

  const [avmOpen, setAvmOpen] = useState(false)
  const avmOpenRef = useRef(avmOpen)
  useEffect(() => {
    avmOpenRef.current = avmOpen
  }, [avmOpen])

  const fsRef = useRef<HTMLDivElement | null>(null)
  const [ttsTalking, setTtsTalking] = useState(false)
  const [agentLevel, setAgentLevel] = useState(0)

  const isAwaitingReply =
    isSending || (messages.length > 0 && messages[messages.length - 1].role === "user")

  const avm = useAvm({
    autoSend: sc.autoSendAvm,
    canRecord:
      avmOpen &&
      !activeTopic.finished &&
      (activeTopic.kind === "voice" || activeTopic.kind === "all"),
    suspend: isAwaitingReply || ttsTalking,
    onSend: async (text) => {
      voiceLog.onSendVoice({ textLength: (text || "").length, value: text })

      setIsSending(true)
      const userMsg: MockMsg = { id: uid(), role: "user", text }
      setMessages((prev) => [...prev, userMsg])

      try {
        const assistantReplies = countByRole(messagesRef.current, "assistant")
        const path = messagesRef.current.map((m) => m.text).join("\n")
        let ans
        if (activeTopic.kind === "voice") {
          ans = await onboardingChat({
            message: text,
            finish: assistantReplies >= 3,
            path,
            template: "avmOnboarding",
          })
        } else {
          ans = await onboardingChat({
            message: text,
            finish: assistantReplies >= 4,
            path,
            template: "onboardingAll",
          })
        }

        const reply: MockMsg = {
          id: uid(),
          role: "assistant",
          text: ans.message,
          delayMs: DEFAULT_BOT_DELAY,
        }
        enqueueMessages([reply])
        await ttsIfAvmOpen(reply.text)
      } catch (e: any) {
        enqueueMessages([
          { id: uid(), role: "assistant", text: getTranslation("app_onboarding.Onboarding.error_prefix", lang).replace("{msg}", String(e?.message ?? e)), delayMs: 300 },
        ])
      } finally {
        setIsSending(false)
      }
    },
    onError: () => {
      enqueueMessages([
        { id: uid(), role: "system", text: getTranslation("app_onboarding.Onboarding.msg_voice_unavailable", lang), delayMs: 0 },
      ])
    },
    upload: false
  })
  const avmRecording = avm.recording
  const avmMicLevel = avm.micLevel
  const avmIsFlushing = avm.isFlushing

  type AgentState = "awaiting" | "speaking" | "recording" | "idle"
  const agentState: AgentState =
    ttsTalking ? "speaking" : isAwaitingReply ? "awaiting" : avmRecording ? "recording" : "idle"

  const ttsIfAvmOpen = async (text?: string) => {
    if (!avmOpenRef.current || !text) return
    setTtsTalking(true)

    let afterCalled = false
    let audioDetected = false
    const SAFETY_MS = 6000

    const safety = setTimeout(async () => {
      if (afterCalled || !avmOpenRef.current || audioDetected) return
      setTtsTalking(false)
      setAgentLevel(0)
    }, SAFETY_MS)

    try {
      await speakAnswer({
        api_url: process.env.NEXT_PUBLIC_API_URL || "",
        projectSlug: sc.projectSlug || localStorage.getItem("project") || "",
        text,
        avmOpen: true,
        chatFinished: false,
        onLevel: (rms) => {
          setAgentLevel(rms)
          if (!audioDetected && rms > 0.02) audioDetected = true
        },
        onAfterAudio: async () => {
          afterCalled = true
          clearTimeout(safety)
          setTtsTalking(false)
          setAgentLevel(0)
        },
        language: sc.language
      })
    } catch (e) {
      console.error("[onboarding TTS] speakAnswer failed:", e)
      clearTimeout(safety)
      setTtsTalking(false)
      setAgentLevel(0)
    }
  }

  const getLastAssistantMessage = (): string | undefined => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === "assistant" && (m.text ?? "").trim()) return m.text
    }
    return undefined
  }

  const openAvm = async (opts?: { readText?: string }) => {
    if (!((activeTopic.kind === "voice" || activeTopic.kind === "all") && !activeTopic.finished))
      return
    if (dictationRecording) stopDictation()

    setAvmOpen(true)
    voiceLog.onVoiceOpen()

    const el = fsRef.current as any
    try {
      const req = el?.requestFullscreen?.bind(el) || el?.webkitRequestFullscreen?.bind(el)
      req?.({ navigationUI: "hide" })
    } catch {}
    setTtsTalking(false)

    const api = process.env.NEXT_PUBLIC_API_URL || ""
    const slug = sc.projectSlug || localStorage.getItem("project") || ""
    await initTtsAvailability(api, slug).catch(() => {})

    const lastBot = opts?.readText ?? getLastAssistantMessage()
    if (lastBot && lastBot.trim()) {
      await ttsIfAvmOpen(lastBot)
    }
  }

  const closeAvm = async () => {
    voiceLog.onVoiceExit()
    try { stopTTS() } catch {}
    setTtsTalking(false)
    setAgentLevel(0)
    setAvmOpen(false)
    try { await avm.stop() } catch {}
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch {}

    if ((activeTopic.kind === "voice" || activeTopic.kind === "all") && !activeTopic.finished) {
      enqueueMessages([{ id: uid(), role: "assistant", text: getTranslation("app_onboarding.Onboarding.msg_voice_demo_done", lang), delayMs: 0 }])
      window.setTimeout(() => markFinished(), 400)
    }
  }

  const handleSkip = async () => {
    voiceLog.onVoiceSkip()
    setTtsTalking(false)
    setAgentLevel(0)
    try { stopTTS() } catch {}
  }

  const toggleAvmRecording = async () => {
    if (!avmOpen || ttsTalking || activeTopic.finished || !(activeTopic.kind === "voice" || activeTopic.kind === "all")) return
    voiceLog.onVoiceConfirm()
    await avm.toggleRecording()
  }

  useEffect(() => {
    const onFsChange = () => {
      if (avmOpen && !document.fullscreenElement) closeAvm().catch(() => {})
    }
    document.addEventListener("fullscreenchange", onFsChange)
    document.addEventListener("webkitfullscreenchange", onFsChange as any)
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange)
      document.removeEventListener("webkitfullscreenchange", onFsChange as any)
    }
  }, [avmOpen])

  useEffect(() => {
    lastMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const enqueueMessages = (seq: MockMsg[], options?: { reset?: boolean }) => {
    if (!seq || seq.length === 0) return
    if (options?.reset) {
      clearAllTimers()
      setMessages([])
    }
    let cumulative = 0
    seq.forEach((m, i) => {
      const isBot = m.role === "assistant" || m.role === "system"
      const baseDelay = m.delayMs ?? (i === 0 ? 0 : DEFAULT_BOT_DELAY)
      const addAfter = isBot ? cumulative + baseDelay : 0
      const tid = window.setTimeout(() => {
        setMessages((prev) => [...prev, { ...m }])
      }, addAfter)
      timersRef.current.push(tid)
      cumulative = isBot ? cumulative + baseDelay : cumulative
    })
  }

  useEffect(() => {
    clearAllTimers()
    setEnterHint(false)
    setInput("")

    ;(async () => {
      try { await cancelDictationRaw() } catch {}
    })()

    if (avmOpen) {
      closeAvm().catch(() => {})
    } else {
      avm.stop().catch(() => {})
      try { stopTTS() } catch {}
      setTtsTalking(false)
      setAgentLevel(0)
    }

    const topic = topics[activeIdx]
    if (!topic.hasPlayed) {
      enqueueMessages(topic.messages, { reset: true })
      setTopics((prev) => prev.map((t, i) => (i === activeIdx ? { ...t, hasPlayed: true } : t)))
    } else {
      setMessages(topic.messages)
    }

    return () => clearAllTimers()
  }, [activeIdx])

  useEffect(() => {
    setEnterHint(input.length > 0)
  }, [input])

  const updateActiveTopic = (updater: (t: Topic) => Topic) => {
    setTopics((prev) => prev.map((t, i) => (i === activeIdx ? updater(t) : t)))
  }

  useEffect(() => {
    updateActiveTopic((t) => ({ ...t, messages }))
  }, [messages])

  const markFinished = () => {
    setTopics((prev) => prev.map((t, i) => (i === activeIdx ? { ...t, finished: true } : t)))
  }

  const handleSelectTopic = (index: number) => {
    const from = topics[activeIdx]
    const to = topics[index]
    
    if (!activeTopic.finished && activeTopic.kind !== "onboarding") {
      return
    }

    log({
      type: "focus_chat",
      ctx: { ...getCtx(), topicKind: to.kind, chatId: to.chatid },
      meta: {
        from: { chatId: from.chatid, kind: from.kind, stimulus: from.stimulus },
        to: { chatId: to.chatid, kind: to.kind, stimulus: to.stimulus },
      },
    })

    localStorage.setItem("ladderchat-onboarding-stage", index + "")
    setTopics((prev) => {
      const current = prev[activeIdx]
      const updated = prev.map((t, i) => (i === index ? { ...t, inProgress: true } : t))
      if (current.kind === "onboarding" && !current.finished && index !== activeIdx) {
        const oi = prev.findIndex((t) => t.kind === "onboarding")
        if (oi >= 0) updated[oi] = { ...updated[oi], finished: true }
      }
      return updated
    })
    setActiveIdx(index)
  }

  const handleSend = async () => {
    const isTextAllowed = (activeTopic.kind === "basic" || activeTopic.kind === "all") && !activeTopic.finished
    if (!isTextAllowed) return
    if (dictationRecording) stopDictation()

    const text = input.trim()
    if (!text || isSending) return

    setInput("")

    setIsSending(true)
    const user: MockMsg = { id: uid(), role: "user", text }

    setMessages((m) => [...m, user])

    try {
      const assistantReplies = countByRole(messagesRef.current, "assistant")
      const path = messagesRef.current.map((m) => m.text).join("\n")

      let answer
      if (activeTopic.kind === "basic") {
        answer = await onboardingChat({
          message: text,
          finish: assistantReplies >= 4,
          path,
          template: "onboardingBasic",
        })
      } else {
        answer = await onboardingChat({
          message: text,
          finish: assistantReplies >= 4,
          path,
          template: "onboardingAll",
        })
      }

      const reply: MockMsg = {
        id: uid(),
        role: "assistant",
        text: answer.message,
        delayMs: DEFAULT_BOT_DELAY,
      }
      enqueueMessages([reply])
      await ttsIfAvmOpen(reply.text)
    } finally {
      setIsSending(false)
      textLog.onSend(user.text)
    }
  }

  const handleAvmButtonPress = async () => {
    const assistantReplies = countByRole(messagesRef.current, "assistant")
    if (assistantReplies > 2) {
      openAvm({ readText: getLastAssistantMessage() })
      return
    }

    const msg: MockMsg = {
      id: uid(),
      role: "assistant",
      text: getTranslation("app_onboarding.Onboarding.avm_intro", lang),
    }
    if (!sc.autoSendAvm) {
      msg.text += " " + getTranslation("app_onboarding.Onboarding.avm_after_speaking", lang)
    }
    if (activeTopic.kind === "voice" || activeTopic.kind === "all") {
      enqueueMessages([msg])
    }

    openAvm({ readText: msg.text })
  }
  

  const startDictation = async () => {
    if (activeTopic.finished || !(activeTopic.kind === "dictate" || activeTopic.kind === "all")) return
    log({
      type: "start_dictation",
      ctx: { ...getCtx(), topicKind: activeTopic.kind, chatId: activeTopic.chatid },
    })
    try {
      await startDictationRaw()
    } catch {
      enqueueMessages([
        {
          id: uid(),
          role: "system",
          text: getTranslation("app_onboarding.Onboarding.msg_mic_not_granted", lang),
          delayMs: 0,
        },
      ])
    }
  }

  const stopDictation = async () => {
    await stopDictationRaw()
    const text = (drainBuffer() || "").trim()

    log({
      type: "end_dictation",
      ctx: { ...getCtx(), topicKind: activeTopic.kind, chatId: activeTopic.chatid },
      textLength: (text || "").length,
      value: text
    })

    if (!text) {
      enqueueMessages([
        { id: uid(), role: "assistant", text: getTranslation("app_onboarding.Onboarding.msg_no_voice", lang), delayMs: 300 },
      ])
      return
    }

    const userMsg: MockMsg = { id: uid(), role: "user", text }
    setMessages((prev) => [...prev, userMsg])

    try {
      const assistantReplies = countByRole(messagesRef.current, "assistant")
      const path = messagesRef.current.map((m) => m.text).join("\n")

      let answer
      if (activeTopic.kind === "dictate") {
        answer = await onboardingChat({
          message: text,
          finish: assistantReplies >= 4,
          path,
          template: "onboardingDictate",
        })
      } else {
        answer = await onboardingChat({
          message: text,
          finish: assistantReplies >= 4,
          path,
          template: "onboardingAll",
        })
      }

      const reply: MockMsg = {
        id: uid(),
        role: "assistant",
        text: answer.message,
        delayMs: DEFAULT_BOT_DELAY,
      }
      enqueueMessages([reply])
      window.setTimeout(() => {
        if (activeTopic.kind === "dictate") markFinished()
      }, (reply.delayMs ?? DEFAULT_BOT_DELAY) + 200)
    } catch (e: any) {
      enqueueMessages([
        { id: uid(), role: "assistant", text: getTranslation("app_onboarding.Onboarding.error_prefix", lang).replace("{msg}", String(e?.message ?? e)), delayMs: 300 },
      ])
    }
  }

  const cancelDictationAndClear = async () => {
    try {
      await cancelDictationRaw()
    } catch {}
    log({
      type: "cancel_dictation",
      ctx: { ...getCtx(), topicKind: activeTopic.kind, chatId: activeTopic.chatid },
    })
    enqueueMessages([{ id: uid(), role: "system", text: getTranslation("app_onboarding.Onboarding.msg_transcription_aborted", lang), delayMs: 0 }])
  }

  useEffect(() => {
    setTopics((prev) => recomputeFinished(prev))
  }, [topics])

  const isAllActive = activeTopic.kind === "all" && !activeTopic.finished
  const isBasicActive = (activeTopic.kind === "basic" || isAllActive) && !activeTopic.finished
  const isVoiceActive = activeTopic.kind === "voice" && !activeTopic.finished
  const isDictateActive = activeTopic.kind === "dictate" && !activeTopic.finished
  const isOnboarding = activeTopic.kind === "onboarding"

  const highlightVoiceBtn = isVoiceActive
  const highlightDictateBtn = isDictateActive
  const highlightSend = isBasicActive && enterHint

  const [showWelcome, setShowWelcome] = useState(false)
  useEffect(() => {
    const seen = localStorage.getItem("ladderchat-onboarding-stage")
    if (seen) {return;}
    setShowWelcome(true)
  }, [])

  const closeWelcome = () => {
    localStorage.setItem("ladderchat-onboarding-stage", "0")
    setShowWelcome(false)
  }

  useEffect(() => {
    const eligible =
      avmOpen &&
      !sc.autoSendAvm &&
      (activeTopic.kind === "voice" || activeTopic.kind === "all") &&
      !activeTopic.finished &&
      !ttsTalking

    if (!eligible) {
      setAvmSpeakAccumMs(0)
      setAvmSendHighlight(false)
      return
    }

    const id = window.setInterval(() => {
      const speaking = agentState === "recording"
      setAvmSpeakAccumMs(prev => {
        if (!speaking) return prev
        const next = Math.min(prev + AVM_SAMPLE_INTERVAL_MS, AVM_HIGHLIGHT_AFTER_MS)
        if (next >= AVM_HIGHLIGHT_AFTER_MS) setAvmSendHighlight(true)
        return next
      })
    }, AVM_SAMPLE_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [
    avmOpen,
    sc.autoSendAvm,
    activeTopic.kind,
    activeTopic.finished,
    ttsTalking,
    agentState,
  ])

  const handleAvmSendBuffered = async () => {
    setAvmSendHighlight(false)
    setAvmSpeakAccumMs(0)
    await avm.flush()
  }

  return (
    <div className="h-full w-full bg-white flex relative">
      <div className="w-64 md:w-72 lg:w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 leading-6">
            {getTranslation("app_onboarding.Onboarding.sidebar_title", lang)}
          </h2>
          <p className="text-sm text-gray-600 mt-1 leading-4">
            {getTranslation("app_onboarding.Onboarding.sidebar_subtitle", lang).replace("{count}", String(topics.length))}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <style jsx global>{`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.4; }
          }
         `}</style>
          {topics.map((chat, index) => {
            const isActive = index === activeIdx;

            const isCompleted = !!chat.finished;
            const isStarted   = !!chat.inProgress && !isCompleted;
            const notStarted  = !isStarted && !isCompleted;

            const prev = index > 0 ? topics[index - 1] : undefined;

            const isUnlocked = 
              chat.kind === "onboarding" ||
              (prev ? (prev.finished || prev.kind === "onboarding") : false);

            const isLocked = notStarted && !isUnlocked;
            const shouldHighlightNotStarted = notStarted && !isLocked;

            return (
              <button
                key={chat.chatid}
                className={cn(
                  "w-full text-left transition-transform",
                  shouldHighlightNotStarted && "relative"
                )}
                onClick={() => handleSelectTopic(index)}
                disabled={isLocked}
                aria-describedby={shouldHighlightNotStarted ? `not-started-highlight-${index}` : undefined}
                data-highlight={shouldHighlightNotStarted ? "true" : "false"}
              >
              <div
                className={cn(
                  "p-4 rounded-lg border transition-colors duration-200 hover:shadow-sm",
                { "ring-2 ring-blue-400": isActive && !isCompleted },
                  {
                    "bg-green-50 border-green-200": isCompleted,
                    "bg-blue-50 border-blue-200": isStarted,
                    "bg-gray-50 border-gray-200 text-gray-600": isLocked,
                    "bg-amber-50/60 border-amber-200": shouldHighlightNotStarted,
                  },
                  shouldHighlightNotStarted && [
                    "ring-4 ring-blue-400 ring-offset-2 ring-offset-white",
                    "hover:bg-amber-50 hover:border-amber-300"
                  ]
                )}
                style={
                  shouldHighlightNotStarted
                    ? { animation: "blink 1.2s ease-in-out infinite" }
                    : undefined
                }

              >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <h3 className="font-medium text-gray-900 truncate leading-6">
                          {chat.stimulus}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs leading-4">
                        {isCompleted ? (
                          <>
                            <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                            <span className="text-green-700 font-medium">
                              {getTranslation("app_onboarding.Onboarding.status_completed", lang)}
                            </span>
                          </>
                        ) : isStarted ? (
                          <>
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                            <span className="text-blue-700 font-medium">
                              {getTranslation("app_onboarding.Onboarding.status_in_progress", lang)}
                            </span>
                          </>
                        ) : isLocked ? (
                          <>
                            <span className="inline-block h-2 w-2 rounded-full bg-gray-600" />
                            <span className="text-gray-700 font-medium">
                              {getTranslation("app_onboarding.Onboarding.status_locked", lang)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="inline-block h-2 w-2 rounded-full bg-orange-600" />
                            <span
                              id={`not-started-highlight-${index}`}
                              className="text-orange-700 font-medium"
                            >
                              {getTranslation("app_onboarding.Onboarding.status_not_started", lang)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

        </div>

        <div className="p-4 border-t border-gray-200">
          <div className={cn("flex gap-2", allFinished && "animate-in fade-in duration-300")}>
            <Button
              variant="default"
              className={cn(
                "w-full rounded-xl transition-transform",
                allFinished &&
                  "scale-105 ring-4 ring-emerald-500 ring-offset-2 ring-offset-white shadow-lg shadow-emerald-200/60 animate-pulse"
              )}
              disabled={!allFinished}
              onClick={() => router.push("/stimuli")}
              aria-describedby={allFinished ? "finish-onboarding-highlight" : undefined}
              data-highlight={allFinished ? "true" : "false"}
            >
              {getTranslation("app_onboarding.Onboarding.finish_onboarding_btn", lang)}
              <ChevronRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>

        </div>

      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="border-b border-gray-200 p-3 bg-white">
          <div className="w-full flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{activeTopic.stimulus}</h1>
              <span className="text-gray-600 font-medium">
                {getTranslation("app_onboarding.Onboarding.discussion_label", lang)}{" "}
                {activeTopic.kind === "onboarding"
                  ? getTranslation("app_onboarding.Onboarding.discussion_onboarding", lang)
                  : activeTopic.kind === "basic"
                  ? getTranslation("app_onboarding.Onboarding.discussion_basic", lang)
                  : activeTopic.kind === "voice"
                  ? getTranslation("app_onboarding.Onboarding.discussion_voice", lang)
                  : activeTopic.kind === "dictate"
                  ? getTranslation("app_onboarding.Onboarding.discussion_dictate", lang)
                  : getTranslation("app_onboarding.Onboarding.discussion_all", lang)}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-semibold text-blue-600">
                {getTranslation("app_onboarding.Onboarding.counter", lang)
                  .replace("{current}", String(activeIdx + 1))
                  .replace("{total}", String(topics.length))}
              </div>
              <div className="text-xs text-gray-500">
                {getTranslation("app_onboarding.Onboarding.topics_label", lang)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="w-full max-w-none px-6 lg:px-8 py-4 flex flex-col justify-end min-h-full space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : m.role === "system"
                        ? "bg-yellow-50 text-yellow-900 border border-yellow-200 rounded-bl-md"
                        : "bg-gray-50 text-gray-900 border border-gray-200 rounded-bl-md"
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={lastMsgRef} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 sticky bottom-0 bg-white">
          <div className="w-full max-w-none px-6 lg:px-8 py-3">
            <div
              className={cn(
                "flex items-end gap-2 rounded-2xl border bg-gray-50 px-3 py-2",
                !activeTopic.finished && activeTopic.kind === "basic" && "ring-2 ring-blue-400"
              )}
            >
              <div className="relative flex-1">
                <Textarea
                  rows={1}
                  value={input}
                  onFocus={(e) => textLog.onFocus(e.currentTarget.value)}
                  onBlur={(e) => textLog.onBlur(e.currentTarget.value)}
                  placeholder={
                    dictationRecording
                      ? getTranslation("app_onboarding.Onboarding.ph_listening", lang)
                      : activeTopic.finished
                      ? getTranslation("app_onboarding.Onboarding.ph_discussion_done", lang)
                      : activeTopic.kind === "onboarding"
                      ? getTranslation("app_onboarding.Onboarding.ph_no_input_needed", lang)
                      : isSending
                      ? getTranslation("app_onboarding.Onboarding.ph_waiting", lang)
                      : getTranslation("app_onboarding.Onboarding.ph_type_here", lang)
                  }
                  onChange={(e) => { setInput(e.target.value); textLog.onChange(e.target.value); }}
                  disabled={
                    isSending ||
                    activeTopic.finished ||
                    dictationRecording ||
                    !(activeTopic.kind === "basic" || activeTopic.kind === "all")
                  }
                  className={cn(
                    "min-h-[56px] max-h-40 resize-none w-full bg-transparent border-0 px-2 py-3 text-sm focus:outline-none focus:ring-0",
                    (activeTopic.kind === "basic" || activeTopic.kind === "all") && !activeTopic.finished && "placeholder:font-medium",
                    dictationRecording && "opacity-90",
                    (activeTopic.kind === "basic" || activeTopic.kind === "all") && !activeTopic.finished && enterHint && [
                      "ring-4 ring-blue-500 ring-offset-2 ring-offset-white",
                      "shadow-lg shadow-blue-200/60",
                      "animate-pulse",
                    ]
                  )}
                  onKeyDown={(e) => {
                    if (!(activeTopic.kind === "basic" || activeTopic.kind === "all") || activeTopic.finished || dictationRecording) return
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  onInput={(e) => {
                    const t = e.target as HTMLTextAreaElement
                    t.style.height = "56px"
                    t.style.height = Math.min(t.scrollHeight, 160) + "px"
                  }}
                  aria-describedby={(activeTopic.kind === "basic" || activeTopic.kind === "all") && !activeTopic.finished && enterHint ? "basic-input-highlight" : undefined}
                />

                {dictationRecording && (
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

              <div className="flex items-center gap-2 pb-1">
                <div className={cn("rounded-2xl", highlightDictateBtn && "ring-4 ring-indigo-500 ring-offset-2 ring-offset-white shadow-lg shadow-indigo-200/60 animate-pulse")}>
                  {ENABLES.dictation && (
                    <DictateButton
                      isDisabled={(!isDictateActive && !isAllActive) || isSending}
                      isRecording={dictationRecording}
                      micLevel={dictationMicLevel}
                      onStart={startDictation}
                      onStop={stopDictation}
                      onCancel={cancelDictationAndClear}
                      onConfirmingChange={setHistoryPaused}
                    />
                  )}
                </div>

                <div className={cn("rounded-2xl", highlightVoiceBtn && "ring-4 ring-purple-500 ring-offset-2 ring-offset-white shadow-lg shadow-purple-200/60 animate-pulse")}>
                  {ENABLES.voice && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className={cn("h-12 w-12 rounded-xl", highlightVoiceBtn && "scale-105")}
                      title={
                        activeTopic.finished
                          ? getTranslation("app_onboarding.Onboarding.ttl_discussion_completed", lang)
                          : (activeTopic.kind === "voice" || activeTopic.kind === "all")
                          ? getTranslation("app_onboarding.Onboarding.ttl_start_voice", lang)
                          : getTranslation("app_onboarding.Onboarding.ttl_voice_disabled", lang)
                      }
                      onClick={handleAvmButtonPress}
                      disabled={!isVoiceActive && !isAllActive}
                      aria-label={(activeTopic.kind === "voice" || activeTopic.kind === "all") ? "Voice mode button (highlighted)" : "Voice button (disabled)"}
                      aria-live="polite"
                    >
                      <AudioLines className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                <div className={cn("rounded-2xl", highlightSend && "ring-4 ring-emerald-500 ring-offset-2 ring-offset-white shadow-lg shadow-emerald-200/60 animate-pulse")}>
                  {ENABLES.text && (
                    <Button
                      onClick={handleSend}
                      size="icon"
                      disabled={!isBasicActive || !input.trim() || isSending || dictationRecording}
                      className={cn("h-12 w-12 rounded-xl", highlightSend && "scale-105")}
                      title={
                        isOnboarding
                          ? getTranslation("app_onboarding.Onboarding.ttl_send_disabled_onboarding", lang)
                          : activeTopic.finished
                          ? getTranslation("app_onboarding.Onboarding.ttl_send_disabled_done", lang)
                          : !(activeTopic.kind === "basic" || activeTopic.kind === "all")
                          ? getTranslation("app_onboarding.Onboarding.ttl_send_disabled_discussion", lang)
                          : dictationRecording
                          ? getTranslation("app_onboarding.Onboarding.ttl_send_finish_dictation", lang)
                          : getTranslation("app_onboarding.Onboarding.ttl_send", lang)
                      }
                    >
                      {isSending ? (
                        <span className="inline-flex items-center">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        </span>
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {(activeTopic.kind === "basic" || activeTopic.kind === "all") && !activeTopic.finished && enterHint && (
              <p id="basic-input-highlight" className="sr-only">
                {getTranslation("app_onboarding.Onboarding.a11y_input_hint", lang)}
              </p>
            )}
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
            onToggleRecord={toggleAvmRecording}
            autoSend={sc.autoSendAvm}
            onSendBuffered={handleAvmSendBuffered}
            sendDisabled={avm.sendDisabled || avmIsFlushing}
            highlightSend={avmSendHighlight}
          >
            <div className="absolute inset-0 bg-black z-0" />
          </AvmOverlay>
        )}
      </div>

      <WelcomePopup
        open={showWelcome}
        onClose={closeWelcome}
        onStart={closeWelcome}
      />

    </div>
  )
}
