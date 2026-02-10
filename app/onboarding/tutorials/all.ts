import { useContext } from "react"
import { Topic, TutorialEnv, uid, countByRole } from "./types"
import getTranslation from "@/lib/translation"

export const createAllTopic = (_env: TutorialEnv, lang: string, namespace: string): Topic => ({
  chatid: "t5",
  stimulus: getTranslation(`${namespace}.stimulus_all`, lang),
  kind: "all",
  finished: false,
  inProgress: false,
  hasPlayed: false,
  messages: [
    { id: uid(), role: "assistant", text: getTranslation(`${namespace}.all_msg_1`, lang), delayMs: 0 },
    { id: uid(), role: "assistant", text: getTranslation(`${namespace}.all_msg_2`, lang), delayMs: 500 },
  ],
})

export const computeAllFinished = (t: Topic) => {
  const assistantReplies = countByRole(t.messages, "assistant")
  return assistantReplies >= 5 || t.finished
}