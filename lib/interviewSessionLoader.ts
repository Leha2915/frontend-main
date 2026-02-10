"use client";

import { useCallback, useContext, useMemo, useState } from "react";
import { ChatsContext } from "@/context/chats";
import { SettingsContext } from "@/context/settings";
import { ProgressContext } from "@/context/progress";
import { useJWTAuth } from "@/context/jwtAuth";
import type { ChatPromptAnswer, TreeStructure } from "@/lib/types";

type HistoryMessage = {
  role: string;
  content: string;
  node_ids?: number[];
};

export type HistoryResponse = {
  content: HistoryMessage[][];
  order: string[];
  finished: string[];
  tree?: TreeStructure | null;
};

type Message = {
  id: string;
  text: string;
  isUserMessage: boolean;
};

export type LoadOptions = {
  bootstrapSettings?: boolean;
  writeLocalStorage?: boolean;
  resetChats?: boolean;
  onEmptyOrder?: () => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchInterviewHistory(
  sessionId: string,
  projectSlug?: string,
  fetchImpl?: typeof fetch
): Promise<HistoryResponse> {
  const doFetch = fetchImpl ?? fetch;
  const res = await doFetch(`${API_URL}/interview/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, projectSlug }),
    credentials: "include",
  });

  if (!res.ok) return { content: [], order: [], finished: [], tree: null };

  const json = await res.json()
  return (json) as HistoryResponse;
}


export function useInterviewSessionLoader() {
  const cc = useContext(ChatsContext);
  const sc = useContext(SettingsContext);
  const pc = useContext(ProgressContext);
  const { fetchWithAuth, logout } = useJWTAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mapMessages = useCallback(
    (sessionId: string, idx: number, list: HistoryMessage[]): Message[] =>
      (list ?? []).map((msg, i) => ({
        id: `${sessionId}-${idx}-${i}`,
        text: msg.content,
        isUserMessage: msg.role === "user",
      })),
    []
  );

  const addTreeToAllChats = useCallback(
    (tree: TreeStructure, order: string[], sessionId: string) => {
      const treeEnvelope: ChatPromptAnswer = {
        Next: {
          NextQuestion: "",
          AskingIntervieweeFor: "",
          ThoughtProcess: "",
          EndOfInterview: false,
          session_id: sessionId,
        },
        Tree: tree,
      };
      order.forEach((_, idx) => {
        const pageId = String(idx + 1);
        cc.addMessageToRawChat(pageId, treeEnvelope);
      });
    },
    [cc]
  );

  const load = useCallback(
    async (
      sessionId: string,
      projectSlug: string,
      opts: LoadOptions = {}
    ): Promise<{ order: string[]; finished: string[]; tree: TreeStructure | null }> => {
      const {
        bootstrapSettings = true,
        writeLocalStorage = true,
        resetChats = true,
        onEmptyOrder,
      } = opts;

      setIsLoading(true);
      setError(null);

      try {
        if (bootstrapSettings) {
          sc.setProjectSlug(projectSlug);
          sc.setConsentGiven(true);
        }
        if (writeLocalStorage) {
          localStorage.setItem("project", projectSlug);
          localStorage.setItem(`interview_session_${projectSlug}`, sessionId);
        }


        const history = await fetchInterviewHistory(sessionId, projectSlug, fetchWithAuth);

        const { content, order, finished, tree } = history;
        if (!order || order.length === 0) {
          onEmptyOrder?.();
          return { order: [], finished: [], tree: null };
        }

        if (resetChats) cc.resetChats();

        const finishedSet = new Set((finished ?? []).map(String));

        order.forEach((stimulus, idx) => {
          const pageId = String(idx + 1);
          const mapped = mapMessages(sessionId, idx, content[idx] ?? []);
          const isFinished = finishedSet.has(String(stimulus));

          let filtered = mapped

          const firstUserIndex = mapped.findIndex(m => m?.isUserMessage === true);
          let started = false
          if (firstUserIndex !== -1) {
            filtered = filtered.filter((_, i) => i !== firstUserIndex);
            started = true
          }

          if (sc.interviewMode === 3) {
            filtered = []
          }
          
          cc.initChat(
            pageId,
            stimulus,
            filtered,
            isFinished,
            mapped,
            "LOADED!",
            started
          );

          console.log(sc.interviewMode)
          if (isFinished) cc.setChatfinished(pageId, true);



          if (started) cc.markAutoHelloSent(pageId)

          if (sc.interviewMode === 3 && started) {
            const msg : Message =  {
              id: "",
              text: "",
              isUserMessage: false
            };
            cc.addMessageToChat(pageId, msg)
          }

        });

        if (tree && order.length > 0) {
          addTreeToAllChats(tree, order, sessionId);
        }

        pc.setSubmittedRanking(true);

        return { order, finished, tree: tree ?? null };
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [cc, sc, pc, fetchWithAuth, mapMessages, addTreeToAllChats]
  );

  const loadSettings = useCallback(
    async (slug: string) => {

      try {
        const res = await fetch(`${API_URL}/projects/${slug}`, { credentials: "include" });
        const isJson = res.headers.get("content-type")?.includes("application/json");

        if (!res.ok) {
          const payload = isJson ? await res.json().catch(() => null) : null;
          const detail = payload?.detail ?? payload;
          const message =
            detail?.message ||
            (typeof detail === "string" ? detail : "") ||
            res.statusText ||
            `HTTP ${res.status}`;

          const err: any = new Error(message);
          err.status = res.status;
          err.code = detail?.error;
          throw err;
        }

        const data = await res.json();

          sc.setProjectSlug(slug);
          sc.setTopic(data.topic);
          sc.setDescription(data.description);
          sc.setStimuli(data.stimuli);
          sc.setN_stimuli(data.n_stimuli);
          sc.setDictationEnabled(data.voice_enabled || true)
          sc.setVoiceEnabled(data.advanced_voice_enabled || false);
          sc.setInterviewMode(data.interview_mode || 1);
          sc.setTreeEnabled(data.tree_enabled);
          sc.setAutoSendAvm(data.auto_send);
          sc.setTimeLimit(data.time_limit);
          sc.setLanguage(data.language);

      } catch (e: any) {
        if (e.status === 404) {
          setError("Project not found");
        } else if (e.status === 403) {
          setError("Project is closed");
        } else {
          setError(e?.message ?? "Unknown error.");
        }

        console.log("fetch error", { status: e?.status, code: e?.code, message: e?.message });
      }

    },
  []
);

  const loadFromLocalStorage = useCallback(
    async (opts?: LoadOptions) => {
      const projectSlug = localStorage.getItem("project") ?? "";
      const sessionId = localStorage.getItem(`interview_session_${projectSlug}`);

      console.log(projectSlug)
      console.log(sessionId)
      if (!projectSlug || !sessionId) {
        console.log("FUCK")
        return { order: [], finished: [], tree: null as TreeStructure | null };
      }
      await loadSettings(projectSlug);
      console.log("okay: ", sc)
      return await load(sessionId, projectSlug, opts);
    },
    [load]
  );

  const clearSession = useCallback((projectSlug?: string) => {
    const slug = projectSlug ?? localStorage.getItem("project") ?? "";
    if (!slug) return;

    const cookieName = `interview_session_${slug}`;
    localStorage.removeItem(cookieName);
    document.cookie = `${cookieName}=; max-age=0; path=/`;
  }, []);

  return {
    isLoading,
    error,
    load,
    loadFromLocalStorage,
    clearSession,
    logout,
  };
}
