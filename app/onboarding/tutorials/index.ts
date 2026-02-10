import { Topic, TutorialEnv } from "./types"
import { createOnboardingTopic, computeOnboardingFinished } from "./onboarding"
import { createBasicTopic, computeBasicFinished } from "./basic"
import { createDictateTopic, computeDictateFinished } from "./dictation"
import { createVoiceTopic, computeVoiceFinished } from "./avmTut"
import { createAllTopic, computeAllFinished } from "./all"
import { SettingsContext } from "@/context/settings"
import { useContext } from "react"

const namespace = "app_onboarding_tutorials"

export function buildTopics(env: TutorialEnv): Topic[] {
  const sc = useContext(SettingsContext)
  const lang = sc.language;
  const topics: (Topic | null)[] = [
    createOnboardingTopic(lang, namespace),
    createBasicTopic(env, lang, namespace),
    createDictateTopic(env, lang, namespace),
    createVoiceTopic(env, lang, namespace),
    createAllTopic(env, lang, namespace),
  ]
  return topics.filter(Boolean) as Topic[]
}

type Finisher = (t: Topic) => boolean
const FINISHERS: Partial<Record<Topic["kind"], Finisher>> = {
  onboarding: computeOnboardingFinished,
  basic: computeBasicFinished,
  dictate: computeDictateFinished,
  voice: computeVoiceFinished,
  all: computeAllFinished,
}

export function recomputeFinished(prev: Topic[]): Topic[] {
  let changed = false
  const next = prev.map((t) => {
    const fn = FINISHERS[t.kind]
    if (!fn) return t
    const should = fn(t)
    if (should !== t.finished) {
      changed = true
      return { ...t, finished: should }
    }
    return t
  })
  return changed ? next : prev
}
