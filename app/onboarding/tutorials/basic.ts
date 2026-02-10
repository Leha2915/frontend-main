import { Topic, uid, TutorialEnv, countByRole } from "./types"
import getTranslation from "@/lib/translation"

export const createBasicTopic = (env: TutorialEnv, lang: string, namespace: string): Topic | null => {
  if (env.interviewMode === 3) return null
  return {
    chatid: "t2",
    stimulus: getTranslation(`${namespace}.stimulus_basic`, lang),
    kind: "basic",
    finished: false,
    inProgress: false,
    hasPlayed: false,
    messages: [
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.basic_msg_1`, lang), delayMs: 0 },
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.basic_msg_2`, lang), delayMs: 500 },
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.basic_msg_3`, lang), delayMs: 800 },
    ],
  }
}

export const computeBasicFinished = (t: Topic) => {
  const assistantReplies = countByRole(t.messages, "assistant")
  return assistantReplies >= 5 || t.finished
}
