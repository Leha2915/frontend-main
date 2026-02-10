import { Topic, uid } from "./types"
import getTranslation from "@/lib/translation"

export const createOnboardingTopic = (lang: string, namespace: string): Topic => ({
  chatid: "t1",
  stimulus: getTranslation(`${namespace}.stimulus_onboarding`, lang),
  kind: "onboarding",
  finished: false,
  inProgress: true,
  hasPlayed: false,
  messages: [
    { id: uid(), role: "assistant", text: getTranslation(`${namespace}.onboarding_msg_1`, lang), delayMs: 0 },
    { id: uid(), role: "assistant", text: getTranslation(`${namespace}.onboarding_msg_2`, lang), delayMs: 500 },
    { id: uid(), role: "assistant", text: getTranslation(`${namespace}.onboarding_msg_3`, lang), delayMs: 800 },
  ],
})

export const computeOnboardingFinished = (t: Topic) => t.finished
