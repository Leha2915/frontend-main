export type InterviewSessionSummary = {
  id: string;
  project_id: number;
  stimuli_order?: string[] | null;
  n_chats: number;
  n_messages: number;
  started: boolean;
  finished: boolean;
  n_finished_chats?: number;
  created_at?: string | null;
  updated_at?: string | null;
  user_id: string | null;
};

export type SessionsResponse = {
  topic: string;
  total: number;
  sessions: InterviewSessionSummary[];
};

export type SessionEvent = {
  ts?: string | number | null;
  time?: string | number | null;
  timestamp?: string | number | null;
  created_at?: string | number | null;

  value?: string | null;
  type?: string | null;
  event?: string | null;
  name?: string | null;
  kind?: string | null;

  ctx?: Record<string, any>;
  [key: string]: any;
};

export type CategoryFilter = "all" | "adv_voice" | "dictation" | "text" | "others";

export type PStats = {
  participant: string;
  sessions: number;
  totalUserMsgs: number;
  msgLengths: number[];
  msgCountsPerSession: number[];
  editCounts: number[];
  editDurations: number[];
  dictationMsgs: number;
  dictationEditCounts: number[];
  postDictationEditCounts: number[];
  postDictationEditDurations: number[];
  postDictationTimeToSendMs: number[];
  endDictationPerSession: number[];
  cancelDictationPerSession: number[];
  focusChatPerSession: number[];
  textOnlySends: number;
  interviewDurationsMs: number[];
};
