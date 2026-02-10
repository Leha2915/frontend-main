import { Topic, uid, TutorialEnv } from "./types"
import getTranslation from "@/lib/translation"


export const createDictateTopic = (env: TutorialEnv, lang: string, namespace: string): Topic | null => {
  if (!env.dictationEnabled || env.interviewMode === 3) return null
  return {
    chatid: "t4",
    stimulus: getTranslation(`${namespace}.stimulus_dictate`, lang),
    kind: "dictate",
    finished: false,
    inProgress: false,
    hasPlayed: false,
    messages: [
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.dictate_msg_1`, lang), delayMs: 0 },
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.dictate_msg_2`, lang), delayMs: 500 },
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.dictate_msg_3`, lang), delayMs: 800 },
    ],
  }
}

export const computeDictateFinished = (t: Topic) => t.finished
