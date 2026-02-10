"use client"

import { useEffect, useState, useContext, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { SettingsContext } from "@/context/settings"
import { useJWTAuth } from "@/context/jwtAuth"
import { ChatsContext } from "@/context/chats"
import { ProgressContext } from "@/context/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, AlertTriangle, Fingerprint, UserRound, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import getTranslation from "@/lib/translation"

const DEV_ALLOW_CUSTOM_ID = false;

type Section = { title: string; body: string }
type QuestionOption = { id: string; label: string }
type QuestionBlock = {
  type: "question"
  id: string
  prompt: string
  options: [QuestionOption, QuestionOption]
  required?: boolean
}
type SectionBlock = { type: "section"; title: string; body: string }
type InfoBlocksResponse = { blocks: Array<SectionBlock | QuestionBlock> } | { info: string }

function parseInfoStringToSections(src: string, fallbackTitle: string): Section[] {
  if (!src || !src.trim()) return []
  const text = src.replace(/\r\n/g, "\n").trim()
  const mdHeadingRegex = /^(#{1,6})\s+(.+)\s*$/gm
  const mdMatches: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = mdHeadingRegex.exec(text)) !== null) mdMatches.push(match)
  if (mdMatches.length > 0) {
    const sections: Section[] = []
    for (let i = 0; i < mdMatches.length; i++) {
      const m = mdMatches[i]
      const start = m.index ?? 0
      const end = i + 1 < mdMatches.length ? (mdMatches[i + 1].index ?? text.length) : text.length
      sections.push({ title: m[2].trim(), body: text.slice(start + m[0].length, end).trim() })
    }
    return sections
  }
  return [{ title: fallbackTitle, body: text }]
}

async function fetchInfoBlocks(url: string): Promise<InfoBlocksResponse> {
  const res = await fetch(url, { headers: { accept: "application/json" }, credentials: "include" })
  const ctype = res.headers.get("content-type") || ""
  if (!res.ok) {
    let detail = res.statusText
    if (ctype.includes("application/json")) {
      const j = await res.json().catch(() => null)
      detail = (j?.detail?.message ?? j?.detail ?? j?.message ?? detail) || `HTTP ${res.status}`
    }
    const err: any = new Error(detail)
    ;(err as any).status = res.status
    throw err
  }
  if (!ctype.includes("application/json")) throw new Error("Unexpected content-type (expected application/json)")
  return res.json()
}

export default function ProjectPage() {
  const sc = useContext(SettingsContext)
  const cc = useContext(ChatsContext)
  const pc = useContext(ProgressContext)
  const { isGuest } = useJWTAuth()
  const router = useRouter()

  const rawSlug = useParams().slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug
  const lang = sc.language

  useEffect(() => {
    if (!sc.projectSlug || sc.projectSlug !== slug || !sc.topic) {
      router.replace(`/project/${slug}`)
    }
  }, [sc.projectSlug, sc.topic, slug, router])

  const [localConsentChecked, setLocalConsentChecked] = useState(false)
  const [participantId, setParticipantId] = useState("")
  const [customId, setCustomId] = useState("")
  const [touched, setTouched] = useState(false)
  const [customTouched, setCustomTouched] = useState(false)
  const [consentNudge, setConsentNudge] = useState(false)
  const [idNudge, setIdNudge] = useState(false)
  const consentRef = useRef<HTMLDivElement | null>(null)
  const consentCheckboxRef = useRef<HTMLInputElement | null>(null)
  const idBlockRef = useRef<HTMLDivElement | null>(null)

  const prolificIdRegex = /^[a-z0-9]{24}$/
  const isValidId = prolificIdRegex.test(participantId)
  const customIdValid = customId.trim().length > 0
  const anyIdChosen = isValidId || customIdValid
  const enrollComplete = localConsentChecked && anyIdChosen

  const [blocks, setBlocks] = useState<Array<SectionBlock | QuestionBlock>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const api_url = process.env.NEXT_PUBLIC_API_URL

  const questionRefs = useRef({} as Record<string, HTMLElement | null>)
  const requiredQuestionIds = useMemo(
    () => blocks.filter(b => b.type === "question" && (b as QuestionBlock).required !== false).map(b => (b as QuestionBlock).id),
    [blocks]
  )
  const hasMissingRequired = useMemo(
    () => requiredQuestionIds.some(qid => !answers[qid]),
    [requiredQuestionIds, answers]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const url = new URL(`${api_url}/projects/${sc.projectSlug}/info`)
        if (lang) url.searchParams.set("lang", lang)
        const data = await fetchInfoBlocks(url.toString())
        if (cancelled) return
        const fallbackTitle = getTranslation("app_info.ProjectInfoPage.section_overview", lang)
        if ("blocks" in data && Array.isArray(data.blocks)) {
          setBlocks(data.blocks)
        } else if ("info" in data && typeof data.info === "string") {
          const sections = parseInfoStringToSections(data.info, fallbackTitle)
          setBlocks(sections.map(s => ({ type: "section", title: s.title, body: s.body })))
        } else {
          throw new Error("Malformed payload")
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Unknown error.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sc, api_url, lang])

  const canProceed = enrollComplete && !hasMissingRequired

  const handleContinue = () => {
    if (hasMissingRequired) {
      const firstMissing = requiredQuestionIds.find(qid => !answers[qid])
      const node = firstMissing ? questionRefs.current[firstMissing] : null
      node?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setTouched(true)
    setCustomTouched(true)
    if (!localConsentChecked) {
      setConsentNudge(true)
      window.setTimeout(() => setConsentNudge(false), 800)
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      consentCheckboxRef.current?.focus({ preventScroll: true })
      return
    }
    if (!anyIdChosen) {
      setIdNudge(true)
      window.setTimeout(() => setIdNudge(false), 800)
      idBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    sc.setConsentGiven(true)
    const chosenUserId = isValidId ? participantId : customId.trim()
    pc.setUserId(chosenUserId)
    localStorage.setItem("ladderchat-user-id", chosenUserId)
    localStorage.setItem("project_info_answers", JSON.stringify(answers))
    router.push("/onboarding")
  }

  const buttonLabel = !anyIdChosen
    ? getTranslation("app_info.ProjectInfoPage.enter_id_to_view_overview", lang)
    : canProceed
      ? getTranslation("app_project_slug.ProjectPage.button_continue", lang)
      : getTranslation("app_info.ProjectInfoPage.complete_required", lang)

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-700" />
          <h2 className="text-lg font-semibold text-gray-900">
            {getTranslation("app_info.ProjectInfoPage.section_disclaimer", lang)}
          </h2>
        </div>
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6 text-orange-700" />
              <h2 className="text-xl font-semibold text-orange-700">
                {getTranslation("app_project_slug.ProjectPage.dp_title", lang)}
              </h2>
            </div>
            <div className="space-y-4 text-base text-orange-700 leading-relaxed">
              <p>{getTranslation("app_project_slug.ProjectPage.dp_p1", lang)}</p>
              <p>{getTranslation("app_project_slug.ProjectPage.dp_p3", lang)}</p>
              <p>{getTranslation("app_project_slug.ProjectPage.dp_p5", lang)}</p>
            </div>
          </div>
          <div
            ref={consentRef}
            className={cn(
              "flex items-start space-x-3 p-4 bg-gray-50 rounded-lg transition-all",
              consentNudge ? "ring-2 ring-red-500/70 animate-pulse" : "ring-0"
            )}
          >
            <input
              ref={consentCheckboxRef}
              type="checkbox"
              id="consent"
              checked={localConsentChecked}
              onChange={(e) => setLocalConsentChecked(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="consent" className="text-base text-gray-700 leading-relaxed">
              {getTranslation("app_project_slug.ProjectPage.consent_label", lang)}
            </label>
          </div>
          {localConsentChecked && (
            <div
              ref={idBlockRef}
              className={cn(
                "space-y-2 rounded-lg p-4 bg-gray-50 border border-gray-200 transition-all",
                idNudge ? "ring-2 ring-red-500/70 animate-pulse" : "ring-0"
              )}
            >
              <Label className="text-sm font-medium text-gray-900">
                {getTranslation("app_project_slug.ProjectPage.identify_yourself", lang)}
              </Label>
              <div className="flex flex-wrap items-start gap-6">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-gray-600">
                    {getTranslation("app_project_slug.ProjectPage.prolific_id_label", lang)}
                  </Label>
                  <div
                    className={cn(
                      "group relative flex items-center rounded-lg border bg-white transition overflow-hidden shadow-sm w-[30ch] max-w-full",
                      isValidId ? "border-green-300" : touched && participantId ? "border-red-300" : "border-gray-300"
                    )}
                  >
                    <div className="pl-3">
                      <Fingerprint className={cn("h-5 w-5", isValidId ? "text-green-600" : "text-gray-400")} />
                    </div>
                    <Input
                      value={participantId}
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="none"
                      maxLength={24}
                      className="h-10 border-0 focus-visible:ring-0 px-3 text-base bg-transparent w-full font-mono"
                      onChange={(e) => {
                        const v = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)
                        setParticipantId(v)
                        setCustomId("")
                      }}
                      onBlur={() => setTouched(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && canProceed) handleContinue()
                      }}
                    />
                    <div className="pr-3">
                      {participantId ? (
                        isValidId ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                        touched ? <XCircle className="h-5 w-5 text-red-600" /> : null
                      ) : null}
                    </div>
                  </div>
                </div>
                {DEV_ALLOW_CUSTOM_ID && (
                  <>
                    <div className="self-end pb-1 text-base uppercase tracking-wider text-gray-500 select-none">
                      {getTranslation("app_project_slug.ProjectPage.or_label", lang)}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-gray-600">
                        {getTranslation("app_project_slug.ProjectPage.custom_id_label", lang)}
                      </Label>
                      <div
                        className={cn(
                          "group relative flex items-center rounded-lg border bg-white transition overflow-hidden shadow-sm w-[53ch] max-w-full",
                          customIdValid ? "border-green-300" : customTouched && customId ? "border-red-300" : "border-gray-300"
                        )}
                      >
                        <div className="pl-3">
                          <UserRound className={cn("h-5 w-5", customIdValid ? "text-green-600" : "text-gray-400")} />
                        </div>
                        <Input
                          value={customId}
                          spellCheck={false}
                          autoComplete="off"
                          autoCapitalize="none"
                          maxLength={50}
                          className="h-10 border-0 focus-visible:ring-0 px-3 text-base bg-transparent w-full font-mono"
                          onChange={(e) => {
                            setCustomId(e.target.value)
                            if (e.target.value) setParticipantId("")
                          }}
                          onBlur={() => setCustomTouched(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && canProceed) handleContinue()
                          }}
                        />
                        <div className="pr-3">
                          {customId ? (
                            customIdValid ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                            customTouched ? <XCircle className="h-5 w-5 text-red-600" /> : null
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {anyIdChosen && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-gray-900">
                {getTranslation("app_info.ProjectInfoPage.section_overview", lang)}
              </h2>
            </div>
            {error && (
              <div className="rounded-xl border p-6 text-center shadow-sm bg-red-50 border-red-200">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
                <p className="mt-2 text-gray-700">{error}</p>
              </div>
            )}
            {loading && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
                <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
                <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                <div className="h-4 w-5/6 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
              </div>
            )}
            {!loading && blocks.length === 0 && !error && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {getTranslation("app_info.ProjectInfoPage.no_description", lang)}
                </h3>
                <p className="text-gray-700">
                  {getTranslation("app_info.ProjectInfoPage.no_description_long", lang)}
                </p>
              </div>
            )}
            {!loading && !error && blocks.map((b, idx) => {
              if (b.type === "section") {
                const s = b as SectionBlock
                return (
                  <section
                    key={`sec-${idx}-${s.title}`}
                    className="w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">{s.title}</h3>
                    <div className="text-gray-800 leading-relaxed whitespace-pre-line">
                      {s.body}
                    </div>
                  </section>
                )
              }
              const q = b as QuestionBlock
              const selected = answers[q.id] || ""
              return (
                <section
                  key={`q-${q.id}`}
                  ref={(el) => { questionRefs.current[q.id] = el }}
                  className={cn(
                    "w-full rounded-lg border bg-white p-6 shadow-sm",
                    (q.required ?? true) && !selected ? "border-yellow-300" : "border-gray-200"
                  )}
                >
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">{q.prompt}</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {q.options.map(opt => {
                      const checked = selected === opt.id
                      return (
                        <label
                          key={opt.id}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer select-none",
                            checked ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-300 hover:border-gray-400"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() =>
                              setAnswers(prev => ({
                                ...prev,
                                [q.id]: checked ? "" : opt.id,
                              }))
                            }
                          />
                          <span className="text-gray-900">{opt.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  {(q.required ?? true) && !selected && (
                    <p className="mt-2 text-sm text-amber-700">
                      {getTranslation("app_info.ProjectInfoPage.question_required", lang)}
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 p-6">
        <Button
          className={cn(
            "w-full text-white text-base font-semibold bg-blue-600 hover:bg-blue-700 h-12 transition-all",
            !canProceed && "opacity-60 cursor-not-allowed"
          )}
          aria-disabled={!canProceed}
          disabled={!canProceed}
          onClick={handleContinue}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
