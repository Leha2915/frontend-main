import { Topic, uid, TutorialEnv } from "./types"
import getTranslation from "@/lib/translation"


export const createVoiceTopic = (env: TutorialEnv, lang: string, namespace: string): Topic | null => {
  if (!env.voiceEnabled) return null
  return {
    chatid: "t3",
    stimulus: getTranslation(`${namespace}.stimulus_voice`, lang),
    kind: "voice",
    finished: false,
    inProgress: false,
    hasPlayed: false,
    messages: [
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.voice_msg_1`, lang), delayMs: 0 },
      { id: uid(), role: "assistant", text: getTranslation(`${namespace}.voice_msg_2`, lang), delayMs: 1100 },
    ],
  }
}

export const computeVoiceFinished = (t: Topic) => t.finished
