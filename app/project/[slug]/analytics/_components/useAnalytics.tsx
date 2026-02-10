"use client";

import { useEffect, useMemo, useState } from "react";
import { SessionsResponse, InterviewSessionSummary, SessionEvent, PStats } from "./types";
import {
  avg,
  eventTimeMs,
  labelKey,
  isTextChange,
  isTextSend,
  isDictStart,
  isDictEnd,
  isCancelDict,
  isVoiceSend,
  getEventValue,
} from "./utils";
import { fetchInterviewHistory } from "@/lib/interviewSessionLoader";

const api_url = process.env.NEXT_PUBLIC_API_URL;

type Args = {
  slug: string;
  fetchWithAuth: (url: string, init?: RequestInit) => Promise<Response>;
};

export function useAnalytics({ slug, fetchWithAuth }: Args) {
  const [loading, setLoading] = useState(true);
  const [sessionsResp, setSessionsResp] = useState<SessionsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [limit, setLimit] = useState(50);
  const [dictationEnabledOnly, setDictationEnabledOnly] = useState(false);
  const [byParticipant, setByParticipant] = useState<Record<string, PStats>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${api_url}/project/${slug}/results`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load interviews (${res.status})`);
        const data: SessionsResponse = await res.json();
        setSessionsResp(data);
      } catch (e) {
        console.error(e);
        alert("Could not load interviews.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, fetchWithAuth]);

  const compute = async () => {
    if (!sessionsResp) return;
    setBusy(true);
    setProgress(0);

    const sessions = sessionsResp.sessions.slice(0, limit);
    const acc: Record<string, PStats> = {};
    const CONC = 3;
    let i = 0;

    function groupTextChanges(sorted: Array<SessionEvent & { __time: number }>) {
      const groups: {
        firstTime: number;
        lastTime: number;
        items: SessionEvent[];
        lastValue: string | null;
      }[] = [];
      let idx = 0;
      while (idx < sorted.length) {
        const cur = sorted[idx];
        if (!isTextChange(cur)) {
          idx += 1;
          continue;
        }
        const items: SessionEvent[] = [cur];
        let j = idx + 1;
        while (j < sorted.length && isTextChange(sorted[j])) {
          items.push(sorted[j]);
          j += 1;
        }
        const firstTime = eventTimeMs(items[0]);
        const lastTime = eventTimeMs(items[items.length - 1]);
        const lastValue = getEventValue(items[items.length - 1]) ?? null;
        groups.push({ firstTime, lastTime, items, lastValue });
        idx = j;
      }
      return groups;
    }

    function buildDictationWindows(sorted: Array<SessionEvent & { __time: number }>) {
      const windows: Array<{ start: number; end: number; endIdx: number }> = [];
      let activeStart: number | null = null;
      sorted.forEach((ev, idx) => {
        const key = labelKey(ev);
        if (key === "start_dictation" || key === "start_dication") {
          if (Number.isFinite(ev.__time)) activeStart = ev.__time;
        } else if (key === "end_dictation" || key === "cancel_dictation") {
          if (activeStart != null && Number.isFinite(ev.__time)) {
            windows.push({ start: activeStart, end: ev.__time, endIdx: idx });
            activeStart = null;
          }
        }
      });
      return windows;
    }

    function isInAnyWindow(t: number, windows: Array<{ start: number; end: number }>) {
      if (!Number.isFinite(t)) return false;
      return windows.some((w) => t >= w.start && t <= w.end);
    }

    function collectPostDictationEdits(
      sorted: Array<SessionEvent & { __time: number }>,
      dictWindows: Array<{ start: number; end: number; endIdx: number }>
    ) {
      const results: Array<{ count: number; durationMs: number; timeToSendMs: number | null }> = [];
      const n = sorted.length;

      for (const w of dictWindows) {
        let idx = Math.min(w.endIdx + 1, n);
        if (idx >= n) {
          results.push({ count: 0, durationMs: 0, timeToSendMs: null });
          continue;
        }

        let boundaryIdx = n;
        let boundaryIsTextSend = false;

        for (let j = idx; j < n; j++) {
          const ev = sorted[j];
          if (isTextSend(ev) || isDictStart(ev) || isVoiceSend(ev)) {
            boundaryIdx = j;
            boundaryIsTextSend = isTextSend(ev);
            break;
          }
        }

        const windowEvents = sorted.slice(idx, boundaryIdx);
        const changes = windowEvents.filter(isTextChange);

        let durationMs = 0;
        if (changes.length >= 2) {
          const firstT = eventTimeMs(changes[0]);
          const lastT = eventTimeMs(changes[changes.length - 1]);
          durationMs = Math.max(
            0,
            Number.isFinite(lastT) && Number.isFinite(firstT) ? lastT - firstT : 0
          );
        }

        let timeToSendMs: number | null = null;
        if (boundaryIsTextSend) {
          const sendT = eventTimeMs(sorted[boundaryIdx]);
          timeToSendMs = Number.isFinite(sendT) ? Math.max(0, sendT - w.end) : null;
        }

        results.push({ count: changes.length, durationMs, timeToSendMs });
      }

      return results;
    }

    function countTextOnlySends(sorted: Array<SessionEvent & { __time: number }>) {
      const groups = groupTextChanges(sorted);
      const textSends = sorted
        .map((e, idx) => ({ e, idx }))
        .filter(({ e }) => isTextSend(e));

      let count = 0;

      for (const { e: send } of textSends) {
        const sendTime = eventTimeMs(send);
        const sendVal = getEventValue(send);

        const precedingGroups = groups.filter((g) => g.lastTime <= sendTime);
        if (!precedingGroups.length) continue;
        const g = precedingGroups[precedingGroups.length - 1];

        if ((g.lastValue ?? "") !== (sendVal ?? "")) continue;

        const hasVoiceOrDictation = sorted.some((ev) => {
          const t = ev.__time;
          if (!Number.isFinite(t)) return false;
          if (t < g.firstTime || t > sendTime) return false;
          const k = labelKey(ev);
          return (
            k === "send_voice" ||
            k === "start_dictation" ||
            k === "start_dication" ||
            k === "end_dictation" ||
            k === "cancel_dictation"
          );
        });

        if (!hasVoiceOrDictation) count += 1;
      }

      return count;
    }

    async function runOne(s: InterviewSessionSummary) {
      try {
        const { content } = await fetchInterviewHistory(s.id, slug, fetchWithAuth);
        const uid = s.user_id || "anonymous";
        acc[uid] ||= {
          participant: uid,
          sessions: 0,
          totalUserMsgs: 0,
          msgLengths: [],
          msgCountsPerSession: [],
          editCounts: [],
          editDurations: [],
          dictationMsgs: 0,
          dictationEditCounts: [],
          postDictationEditCounts: [],
          postDictationEditDurations: [],
          postDictationTimeToSendMs: [],
          endDictationPerSession: [],
          cancelDictationPerSession: [],
          focusChatPerSession: [],
          textOnlySends: 0,
          interviewDurationsMs: [],
        };

        const allMsgs: any[] = [];
        for (let idx = 0; idx < (content?.length || 0); idx++) {
          const msgs = content[idx] ?? [];
          allMsgs.push(...msgs);
          const userMsgsThisChat = (msgs ?? []).filter((m: any) => {
            if (typeof m?.isUserMessage === "boolean") return m.isUserMessage;
            const r = (m?.role || "").toString().toLowerCase();
            return r === "user";
          });
          acc[uid].msgCountsPerSession.push(userMsgsThisChat.length);
        }

        const userMsgs = allMsgs.filter((m) => {
          if (typeof m?.isUserMessage === "boolean") return m.isUserMessage;
          const r = (m?.role || "").toString().toLowerCase();
          return r === "user";
        });
        const lengths = userMsgs.map((m) => String(m?.text ?? m?.content ?? "").trim().length);

        acc[uid].sessions += 1;
        acc[uid].totalUserMsgs += userMsgs.length;
        acc[uid].msgLengths.push(...lengths);

        const evRes = await fetchWithAuth(`${api_url}/logs/${s.id}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (evRes?.ok) {
          const raw: SessionEvent[] = (await evRes.json()) ?? [];
          const enriched = raw
            .map((e) => ({ ...e, __time: eventTimeMs(e) }))
            .filter((e) => Number.isFinite(e.__time))
            .sort((a, b) => a.__time - b.__time);

          let sessionDur = 0;

          // Primär: Meta-Felder verwenden (wie in deinem Beispiel)
          const start = s.created_at ? Date.parse(String(s.created_at)) : Number.NaN;
          const end   = s.updated_at ? Date.parse(String(s.updated_at)) : Number.NaN;

          if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
            sessionDur = end - start;
          } else if (enriched.length >= 2) {
            // Fallback: Event-basierte Spanne nur, wenn Meta-Zeiten fehlen/defekt
            const sessionStart = enriched[0].__time;
            const sessionEnd   = enriched[enriched.length - 1].__time;
            sessionDur = Number.isFinite(sessionStart) && Number.isFinite(sessionEnd)
              ? Math.max(0, sessionEnd - sessionStart)
              : 0;
          } else {
            sessionDur = 0;
          }

          acc[uid].interviewDurationsMs.push(sessionDur);

          const groups = groupTextChanges(enriched);

          for (const g of groups) {
            const dur =
              Number.isFinite(g.lastTime) && Number.isFinite(g.firstTime)
                ? g.lastTime - g.firstTime
                : 0;
            acc[uid].editCounts.push(g.items.length);
            acc[uid].editDurations.push(Math.max(0, dur));
          }

          const dictWindows = buildDictationWindows(enriched);
          const sendVoiceCount = enriched.reduce(
            (n, e) => n + (labelKey(e) === "send_voice" ? 1 : 0),
            0
          );
          acc[uid].dictationMsgs += sendVoiceCount;

          for (const g of groups) {
            if (isInAnyWindow(g.firstTime, dictWindows)) {
              acc[uid].dictationEditCounts.push(g.items.length);
            }
          }

          const postEdits = collectPostDictationEdits(enriched, dictWindows);
          for (const pe of postEdits) {
            acc[uid].postDictationEditCounts.push(pe.count);
            acc[uid].postDictationEditDurations.push(pe.durationMs);
            if (pe.timeToSendMs != null) acc[uid].postDictationTimeToSendMs.push(pe.timeToSendMs);
          }

          const endDictCount = enriched.reduce((n, e) => n + (isDictEnd(e) ? 1 : 0), 0);
          const cancelDictCount = enriched.reduce((n, e) => n + (isCancelDict(e) ? 1 : 0), 0);
          const focusChatCount = enriched.reduce(
            (n, e) => n + (labelKey(e) === "focus_chat" ? 1 : 0),
            0
          );
          acc[uid].endDictationPerSession.push(endDictCount);
          acc[uid].cancelDictationPerSession.push(cancelDictCount);
          acc[uid].focusChatPerSession.push(focusChatCount);

          acc[uid].textOnlySends += countTextOnlySends(enriched);
        } else {
          const uid2 = s.user_id || "anonymous";
          acc[uid2].endDictationPerSession.push(0);
          acc[uid2].cancelDictationPerSession.push(0);
          acc[uid2].focusChatPerSession.push(0);
        }
      } catch (e) {
        console.warn("history/log fetch failed for", s.id, e);
      } finally {
        i += 1;
        setProgress(Math.round((i / sessions.length) * 100));
      }
    }

    const queue = [...sessions];
    const workers = new Array(Math.min(CONC, queue.length)).fill(null).map(async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        await runOne(next);
      }
    });
    await Promise.all(workers);

    setByParticipant(acc);
    setBusy(false);
  };

  const rows = useMemo(() => Object.values(byParticipant), [byParticipant]);

  const avgLenData = rows.map((p) => ({
    participant: p.participant || "anonymous",
    avgLen: Math.round(avg(p.msgLengths)),
  }));

  const avgCountData = rows.map((p) => ({
    participant: p.participant || "anonymous",
    avgCount: Math.round(avg(p.msgCountsPerSession)),
  }));

  const postDictAvgCountData = rows.map((p) => ({
    participant: p.participant || "anonymous",
    avgPostDictEdits: Number(avg(p.postDictationEditCounts).toFixed(2)),
  }));

  const postDictAvgDurationData = rows.map((p) => ({
    participant: p.participant || "anonymous",
    avgPostDictEditMs: Math.round(avg(p.postDictationEditDurations)),
  }));

  const interviewAvgDurationData = rows.map((p) => ({
    participant: p.participant || "anonymous",
    avgInterviewMs: Math.round(avg(p.interviewDurationsMs)),
  }));

  const filteredRows = useMemo(() => {
    if (!dictationEnabledOnly) return rows;
    return rows.filter((p) => p.dictationMsgs > 0 || p.postDictationEditCounts.length > 0);
  }, [rows, dictationEnabledOnly]);

  const topic = sessionsResp?.topic ?? "";

  const totals = useMemo(() => {
    const totalEndDictation = filteredRows.reduce(
      (sum, p) => sum + p.endDictationPerSession.reduce((a, b) => a + b, 0),
      0
    );
    const totalCancelDictation = filteredRows.reduce(
      (sum, p) => sum + p.cancelDictationPerSession.reduce((a, b) => a + b, 0),
      0
    );
    const totalTextOnlySends = filteredRows.reduce((sum, p) => sum + p.textOnlySends, 0);

    return { totalEndDictation, totalCancelDictation, totalTextOnlySends };
  }, [filteredRows]);

   function buildExportPayload() {
    const generatedAt = new Date().toISOString();

    return {
      meta: {
        slug,
        topic,
        generatedAt,
        source: "analytics",
        apiBase: api_url ?? null,
      },
      filters: {
        limit,
        dictationEnabledOnly,
      },
      sessions: {
        totalAvailable: sessionsResp?.total ?? 0,
        usedForComputation: Math.min(limit, sessionsResp?.sessions?.length ?? 0),
      },
      totals,
      participants: byParticipant,
      derived: {
        avgLenPerParticipant: avgLenData,
        avgMsgsPerParticipant: avgCountData,
        postDictAvgEdits: postDictAvgCountData,
        postDictAvgEditDurationMs: postDictAvgDurationData,
        interviewAvgDurationMs: interviewAvgDurationData,
      },
    };
  }

  function exportJson() {
    const payload = buildExportPayload();
    const pretty = JSON.stringify(payload, null, 2);
    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().slice(0, 10);
    const filename = `analytics_${slug}_${date}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  return {
    topic,
    loading,
    busy,
    progress,
    limit,
    setLimit,
    dictationEnabledOnly,
    setDictationEnabledOnly,
    sessionsResp,
    rows,
    filteredRows,
    avgLenData,
    avgCountData,
    postDictAvgCountData,
    postDictAvgDurationData,
    interviewAvgDurationData,
    totals,
    compute,
    exportJson,
  };
}
