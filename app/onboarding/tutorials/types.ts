export type Role = "user" | "assistant" | "system"

export interface MockMsg {
  id: string
  role: Role
  text: string
  delayMs?: number
}

export type TopicKind = "onboarding" | "basic" | "voice" | "dictate" | "all"

export interface Topic {
  chatid: string
  stimulus: string
  kind: TopicKind
  finished: boolean
  inProgress: boolean
  hasPlayed?: boolean
  messages: MockMsg[]
}

export interface TutorialEnv {
  interviewMode: number
  dictationEnabled: boolean
  voiceEnabled: boolean
}

export const uid = () => Math.random().toString(36).slice(2)
export const countByRole = (arr: MockMsg[], role: Role) => arr.filter((m) => m.role === role).length
