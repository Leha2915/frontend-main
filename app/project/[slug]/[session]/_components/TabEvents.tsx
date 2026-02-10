"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const api_url = process.env.NEXT_PUBLIC_API_URL;

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

type Props = {
  sessionId: string;
  fetchWithAuth: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  className?: string;
};

function eventTimeMs(e: SessionEvent): number {
  const cand = e.ts ?? e.time ?? e.timestamp ?? e.created_at ?? e?.ctx?.ts ?? e?.ctx?.time;
  if (cand == null) return Number.NaN;
  if (typeof cand === "number") return cand > 10_000_000_000 ? cand : cand * 1000;
  const ms = Date.parse(String(cand));
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function getEventLabel(e: SessionEvent): string {
  return e.name ?? e.type ?? e.event ?? e.kind ?? (e?.ctx?.event ?? "event");
}

function labelKey(e: SessionEvent | { label?: string }): string {
  const raw =
    "label" in e && e.label
      ? e.label
      : "name" in e && (e as any).name
      ? (e as any).name
      : getEventLabel(e as SessionEvent);
  return String(raw).toLowerCase().replace(/\s+/g, "_");
}

function isTextChange(e: SessionEvent): boolean {
  const label = getEventLabel(e).toLowerCase();
  return label === "text_change" || label === "text-change" || label === "textchange";
}

function isFocusChat(e: SessionEvent): boolean {
  const lk = labelKey(e);
  return lk === "focus_chat" || lk === "chat_focus";
}

function getFocusChatId(e: SessionEvent): string | null {
  return e?.ctx?.chatId ?? null;
}

function getEventValue(e: SessionEvent): string | null {
  if (isFocusChat(e)) {
    const chatId = getFocusChatId(e);
    if (chatId != null) return String(chatId);
  }
  const v = e.value ?? e?.ctx?.value ?? e?.data?.value ?? e?.payload?.value ?? null;
  return v == null ? null : String(v);
}

type CategoryFilter = "all" | "adv_voice" | "dictation" | "text" | "others";

const ADV_VOICE_SET = new Set([
  "voice_exit",
  "voice_skip",
  "voice_open",
  "voice_confirm",
  "send_voice",
]);
const DICTATION_SET = new Set(["start_dictation", "end_dictation", "cancel_dictation", "start_dictation", "start_dication"]);
const TEXT_SET = new Set(["text_focus", "text_send", "text_blur", "text_change"]);
const OTHERS_SET = new Set(["focus_chat"]);

function getCategory(e: SessionEvent): CategoryFilter | "text_change_group" | "uncategorized" {
  if (isTextChange(e)) return "text_change_group";
  const key = labelKey(e);
  if (ADV_VOICE_SET.has(key)) return "adv_voice";
  if (DICTATION_SET.has(key)) return "dictation";
  if (TEXT_SET.has(key)) return "text";
  if (OTHERS_SET.has(key)) return "others";
  return "uncategorized";
}

export type GroupedEvent = {
  __group: true;
  label: string;
  items: Array<SessionEvent & { __idx: number; __time: number }>;
  firstTime: number;
  lastTime: number;
  lastValue: string | null;
};

type DisplayEvent = (SessionEvent & { __idx: number; __time: number }) | GroupedEvent;

export default function SessionEventsTab({ sessionId, fetchWithAuth, className }: Props) {
  const [events, setEvents] = React.useState<SessionEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [eventsError, setEventsError] = React.useState<string | null>(null);

  const [newestFirst, setNewestFirst] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all");
  const [sortKey, setSortKey] = React.useState<"time" | "label">("time");
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    (async () => {
      try {
        setEventsLoading(true);
        setEventsError(null);

        const res = await fetchWithAuth(`${api_url}/logs/${sessionId}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!res || !res.ok) {
          throw new Error(`Failed to fetch session logs (${res?.status})`);
        }

        const data: SessionEvent[] = (await res.json()) ?? [];
        setEvents(data);
      } catch (err: any) {
        console.error(err);
        setEventsError(err?.message ?? "Failed to load events");
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    })();
  }, [sessionId, fetchWithAuth]);

  const enriched = React.useMemo(() => {
    if (!events) return [] as Array<SessionEvent & { __idx: number; __time: number }>;
    return events.map((e, i) => ({ ...e, __idx: i, __time: eventTimeMs(e) }));
  }, [events]);

  const chronoAsc = React.useMemo(() => {
    const arr = [...enriched].sort((a, b) => {
      const ta = a.__time,
        tb = b.__time;
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return 1;
      if (!Number.isFinite(tb)) return -1;
      return ta - tb;
    });
    return arr;
  }, [enriched]);

  const mergedChrono = React.useMemo<DisplayEvent[]>(() => {
    const out: DisplayEvent[] = [];
    let i = 0;
    while (i < chronoAsc.length) {
      const cur = chronoAsc[i];
      if (!isTextChange(cur)) {
        out.push(cur);
        i += 1;
        continue;
      }
      const items: Array<SessionEvent & { __idx: number; __time: number }> = [cur];
      let j = i + 1;
      while (j < chronoAsc.length && isTextChange(chronoAsc[j])) {
        items.push(chronoAsc[j]);
        j += 1;
      }
      const firstTime = items[0].__time;
      const lastTime = items[items.length - 1].__time;
      const lastVal = getEventValue(items[items.length - 1]) ?? null;
      const group: GroupedEvent = {
        __group: true,
        label: `text_change (x${items.length})`,
        items,
        firstTime,
        lastTime,
        lastValue: lastVal,
      };
      out.push(group);
      i = j;
    }
    return out;
  }, [chronoAsc]);

  const sortedForDisplay = React.useMemo(() => {
    const arr = [...mergedChrono];
    arr.sort((a, b) => {
      if (sortKey === "label") {
        const la = ("__group" in a ? a.label : getEventLabel(a)).toLowerCase();
        const lb = ("__group" in b ? b.label : getEventLabel(b)).toLowerCase();
        if (la < lb) return -1;
        if (la > lb) return 1;
        const ta = "__group" in a ? a.lastTime : a.__time;
        const tb = "__group" in b ? b.lastTime : b.__time;
        return (ta ?? 0) - (tb ?? 0);
      }
      const ta = "__group" in a ? a.lastTime : a.__time;
      const tb = "__group" in b ? b.lastTime : b.__time;
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return 1;
      if (!Number.isFinite(tb)) return -1;
      return newestFirst ? tb - ta : ta - tb;
    });
    return arr;
  }, [mergedChrono, newestFirst, sortKey]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedForDisplay.filter((e) => {
      if (categoryFilter !== "all") {
        if ("__group" in e) {
          const groupCat: CategoryFilter = "text";
          if (categoryFilter !== groupCat) return false;
        } else {
          const cat = getCategory(e);
          if (cat !== categoryFilter) return false;
        }
      }

      if (!q) return true;
      if ("__group" in e) {
        if (e.label.toLowerCase().includes(q)) return true;
        if (e.lastValue && e.lastValue.toLowerCase().includes(q)) return true;
        return e.items.some((it) => {
          const label = getEventLabel(it).toLowerCase();
          const val = getEventValue(it)?.toLowerCase() ?? "";
          return (
            label.includes(q) ||
            val.includes(q) ||
            JSON.stringify(it).toLowerCase().includes(q)
          );
        });
      } else {
        const label = getEventLabel(e).toLowerCase();
        const val = getEventValue(e)?.toLowerCase() ?? "";
        return (
          label.includes(q) ||
          val.includes(q) ||
          JSON.stringify(e).toLowerCase().includes(q)
        );
      }
    });
  }, [sortedForDisplay, search, categoryFilter]);

  const toggleExpanded = React.useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => {
    const allKeys = new Set<string>();
    filtered.forEach((e, idx) => allKeys.add(displayKey(e, idx)));
    setExpandedKeys(allKeys);
  }, [filtered]);

  const collapseAll = React.useCallback(() => setExpandedKeys(new Set()), []);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Session Events</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setNewestFirst((p) => !p)}
          >
            {newestFirst ? "Show oldest first" : "Show newest first"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={expandAll}>
            Expand all
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search (label, value, JSON)…"
          className="w-full h-9 rounded-md border px-3 text-sm bg-white"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="w-full h-9 rounded-md border px-3 text-sm bg-white"
        >
          <option value="all">All events</option>
          <option value="adv_voice">Only advanced voice mode</option>
          <option value="dictation">Only dictation</option>
          <option value="text">Only Text</option>
          <option value="others">Others</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Sort by:</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="h-9 rounded-md border px-3 text-sm bg-white"
          >
            <option value="time">Time</option>
            <option value="label">Per Event</option>
          </select>
        </div>
      </div>

      {eventsLoading ? (
        <div className="animate-pulse text-gray-600">Loading events…</div>
      ) : eventsError ? (
        <div className="text-red-600 text-sm">{eventsError}</div>
      ) : !events || events.length === 0 ? (
        <div className="text-gray-600">No events</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev, idx) => {
            const key = displayKey(ev, idx);
            const expanded = expandedKeys.has(key);

            if ("__group" in ev) {
              const firstD = Number.isFinite(ev.firstTime) ? new Date(ev.firstTime) : null;
              const lastD = Number.isFinite(ev.lastTime) ? new Date(ev.lastTime) : null;
              const when =
                firstD && lastD
                  ? `${firstD.toLocaleString()} — ${lastD.toLocaleString()}`
                  : "—";

              return (
                <Card
                  key={`${sessionId}-${key}`}
                  className="rounded-2xl border shadow-sm hover:shadow-md transition"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">{ev.label}</CardTitle>
                        {ev.lastValue != null && ev.lastValue !== "" && (
                          <div className="mt-1 text-xs text-gray-600 truncate">
                            <span className="font-medium text-gray-700">last value: </span>
                            <code className="font-mono break-all">{String(ev.lastValue)}</code>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          title={lastD ? lastD.toISOString() : undefined}
                        >
                          {when}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => toggleExpanded(key)}
                        >
                          {expanded ? "Collapse" : "Expand"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {expanded && (
                    <CardContent className="text-xs">
                      <div className="text-gray-700 font-medium mb-2">
                        Grouped events ({ev.items.length}):
                      </div>
                      <div className="space-y-2">
                        {ev.items.map((it, subIdx) => {
                          const t = Number.isFinite(it.__time) ? new Date(it.__time) : null;
                          const whenItem = t ? t.toLocaleString() : "—";
                          const label = getEventLabel(it);
                          const value = getEventValue(it);
                          return (
                            <div
                              key={`${sessionId}-${key}-sub-${subIdx}`}
                              className="rounded-md border p-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-semibold">{label}</div>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  title={t ? t.toISOString() : undefined}
                                >
                                  {whenItem}
                                </Badge>
                              </div>
                              {value != null && value !== "" && (
                                <div className="mt-1 text-[11px] text-gray-700 break-words">
                                  <span className="font-medium text-gray-700">value: </span>
                                  <code className="font-mono break-all">{String(value)}</code>
                                </div>
                              )}
                              <pre className="whitespace-pre-wrap break-words text-gray-800 mt-2 bg-gray-50 p-2 rounded">
                                {JSON.stringify(stripInternal(it), null, 2)}
                              </pre>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            }

            const t = ev.__time;
            const d = Number.isFinite(t) ? new Date(t) : null;
            const when = d ? d.toLocaleString() : "—";
            const label = getEventLabel(ev);
            const value = getEventValue(ev);

            return (
              <Card
                key={`${sessionId}-${key}`}
                className="rounded-2xl border shadow-sm hover:shadow-md transition"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                      {value != null && value !== "" && (
                        <div className="mt-1 text-xs text-gray-600 truncate">
                          <span className="font-medium text-gray-700">value: </span>
                          <code className="font-mono break-all">{String(value)}</code>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        title={d ? d.toISOString() : undefined}
                      >
                        {when}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => toggleExpanded(key)}
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="text-xs">
                    <pre className="whitespace-pre-wrap break-words text-gray-800">
                      {JSON.stringify(stripInternal(ev), null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function displayKey(ev: DisplayEvent, idx: number): string {
  if ("__group" in ev) {
    const firstIdx = ev.items[0]?.__idx ?? idx;
    const lastIdx = ev.items[ev.items.length - 1]?.__idx ?? idx;
    return `group-${firstIdx}-${lastIdx}`;
  }
  return `event-${ev.__idx}`;
}

function stripInternal<T extends object>(obj: T): T {
  const { __idx, __time, __group, ...rest } = obj as any;
  return rest as T;
}
