"use client"

import { useEffect, useState, useContext, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useJWTAuth } from '@/context/jwtAuth'
import { SettingsContext } from "@/context/settings"
import { ChatsContext } from "@/context/chats"
import { ProgressContext } from "@/context/progress"
import { AlertTriangle } from "lucide-react"
import getTranslation from "@/lib/translation"

type ProjectDetails = {
  topic: string
  description: string
  stimuli: any[]
  n_stimuli: number
  advanced_voice_enabled: boolean
  voice_enabled: boolean
  interview_mode: string | number
  tree_enabled: boolean
  auto_send: boolean
  time_limit?: number | null
  language?: string
  grouped?: string[]
}

export default function ProjectLoaderPage() {
  const router = useRouter()
  const { isGuest, enterAsGuest } = useJWTAuth()
  const sc = useContext(SettingsContext)
  const cc = useContext(ChatsContext)
  const pc = useContext(ProgressContext)

  const rawSlug = useParams().slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const api_url = process.env.NEXT_PUBLIC_API_URL

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [halt, setHalt] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  const navigatedRef = useRef(false)
  const navigateOnce = (path: string) => {
    if (navigatedRef.current) return
    navigatedRef.current = true
    router.replace(path)
  }

  useEffect(() => {
    if (halt) return
    try {
      sc.setConsentGiven(false)
      localStorage.removeItem("ladderchat-onboarding-stage")
      localStorage.removeItem("ladderchat-user-id")
    } catch {}
  }, [halt, sc])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (halt) return
      if (!slug || typeof slug !== "string" || slug.length === 0) return
      try {
        if (!isGuest) {
          await enterAsGuest(`${slug}`)
        }
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [halt, isGuest, enterAsGuest, slug])

  const randPick = <T,>(arr: T[]): T => {
    if (arr.length === 1) return arr[0]
    try {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      return arr[buf[0] % arr.length]
    } catch {
      const idx = Math.floor(Math.random() * arr.length)
      return arr[idx]
    }
  }

  const getSessionsTotal = async (projectSlug: string): Promise<number> => {
    const res = await fetch(`${api_url}/projects/${projectSlug}/total`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
    if (!res.ok) throw new Error("Failed to load project total")
    const json = await res.json()
    return typeof json?.sessions_total === "number" ? json.sessions_total : Number.POSITIVE_INFINITY
  }

  const applySettings = (pSlug: string, data: ProjectDetails) => {
    try {
      sc.setProjectSlug(pSlug)
      sc.setTopic(data.topic)
      sc.setDescription(data.description)
      sc.setStimuli(data.stimuli)
      sc.setN_stimuli(data.n_stimuli)
      sc.setVoiceEnabled(data.advanced_voice_enabled)
      sc.setDictationEnabled(data.voice_enabled)
      sc.setInterviewMode(data.interview_mode as any)
      sc.setTreeEnabled(data.tree_enabled)
      sc.setAutoSendAvm(data.auto_send)
      sc.setTimeLimit(data.time_limit ?? null)
      sc.setLanguage(data.language ?? "en")

      localStorage.setItem("project", pSlug);

    } catch {}
  }

  useEffect(() => {
    if (halt) return
    if (!authReady) return
    if (!slug || typeof slug !== "string" || slug.length === 0) return

    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      try {
        const res = await fetch(`${api_url}/projects/${slug}`, {
          credentials: "include",
          signal: controller.signal,
        })
        const isJson = res.headers.get("content-type")?.includes("application/json")
        if (!res.ok) {
          const payload = isJson ? await res.json().catch(() => null) : null
          const detail = payload?.detail ?? payload
          const msg =
            detail?.message ||
            (typeof detail === "string" ? detail : "") ||
            res.statusText ||
            `HTTP ${res.status}`
          const err: any = new Error(msg)
          err.status = res.status
          err.code = detail?.error
          throw err
        }

        const data: ProjectDetails = await res.json()
        if (cancelled) return

        let alias: string | null = null
        try {
          alias = typeof window !== 'undefined'
            ? localStorage.getItem(`balanced_target_${slug}`)
            : null
        } catch {}

        const candidates = Array.from(
          new Set([slug, alias, ...(data.grouped ?? [])].filter(Boolean) as string[])
        )

        try {
          const existingSlug = candidates.find((s) => {
            const val = localStorage.getItem(`interview_session_${s}`)
            return !!(val && val.trim().length > 0)
          })
          if (existingSlug) {
            localStorage.setItem("project", existingSlug)
            setHalt(true)
            localStorage.setItem('instant-resume', '/chat');
            navigateOnce("/pause")
            return
          }
        } catch {}

        let chosen = slug
        if (candidates.length > 1) {
          const totals = await Promise.allSettled(
            candidates.map(async (s) => ({ slug: s, sessions: await getSessionsTotal(s) }))
          )
          const ok = totals
            .filter((t): t is PromiseFulfilledResult<{ slug: string; sessions: number }> => t.status === "fulfilled")
            .map((t) => t.value)

          if (ok.length === 0) {
            chosen = randPick(candidates)
          } else {
            const min = Math.min(...ok.map((d) => d.sessions))
            const withMin = ok.filter((d) => d.sessions === min).map((d) => d.slug)
            chosen = withMin.length === 1 ? withMin[0] : randPick(withMin)
          }
        }

        if (chosen !== slug) {
          try {
            localStorage.setItem(`balanced_target_${slug}`, chosen)
          } catch {}
        }

        if (chosen === slug) {
          applySettings(slug, data)
        } else {
          const resChosen = await fetch(`${api_url}/projects/${chosen}`, {
            credentials: "include",
            signal: controller.signal,
          })
          const isJsonChosen = resChosen.headers.get("content-type")?.includes("application/json")
          if (!resChosen.ok) {
            const payload = isJsonChosen ? await resChosen.json().catch(() => null) : null
            const detail = payload?.detail ?? payload
            const msg =
              detail?.message ||
              (typeof detail === "string" ? detail : "") ||
              resChosen.statusText ||
              `HTTP ${resChosen.status}`
            const err: any = new Error(msg)
            err.status = resChosen.status
            err.code = detail?.error
            throw err
          }
          const chosenData: ProjectDetails = await resChosen.json()
          if (cancelled) return
          applySettings(chosen, chosenData)
        }

        if (!cancelled) {
          navigateOnce(`/project/${chosen}/info`)
        }
      } catch (e: any) {
        if (cancelled) return
        if (e?.status === 404) setError("404")
        else if (e?.status === 403) setError("403")
        else setError(e?.message ?? "Unknown error.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [halt, authReady, slug, api_url, sc])

  const lang = sc.language

  if (error) {
    const isClosed = error === "403"
    const isNotFound = error === "404"
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-gray-50 px-4">
        <div className={`w-full max-w-2xl rounded-xl border p-8 text-center shadow-sm
          ${isClosed ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
          <AlertTriangle className={`mx-auto h-12 w-12 ${isClosed ? "text-yellow-600" : "text-red-600"}`} />
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            {isClosed
              ? getTranslation("app_project_slug.ProjectPage.project_closed_title", lang)
              : isNotFound
                ? getTranslation("app_project_slug.ProjectPage.project_not_found_title", lang)
                : getTranslation("app_project_slug.ProjectPage.project_unavailable_title", lang)}
          </h1>
          <p className="mt-2 text-gray-600">
            {isClosed
              ? getTranslation("app_project_slug.ProjectPage.project_closed", lang)
              : isNotFound
                ? getTranslation("app_project_slug.ProjectPage.project_not_found", lang)
                : error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] text-gray-600 px-4" aria-busy="true" aria-live="polite">
      {getTranslation("app_project_slug.ProjectPage.loading", sc.language)}
    </div>
  )
}
