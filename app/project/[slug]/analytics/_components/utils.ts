import { SessionEvent } from "./types";

export const ADV_VOICE_SET = new Set([
  "voice_exit",
  "voice_skip",
  "voice_open",
  "voice_confirm",
  "send_voice",
]);
export const DICTATION_SET = new Set([
  "start_dictation",
  "end_dictation",
  "cancel_dictation",
  "start_dication",
]);
export const TEXT_SET = new Set(["text_focus", "text_send", "text_blur", "text_change"]);
export const OTHERS_SET = new Set(["focus_chat"]);

export function avg(nums: number[]) {
  const v = nums.filter((n) => Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export function median(nums: number[]) {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
}

export function msFmt(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;

  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${r}s`);
  return parts.join(" ");
}


export function eventTimeMs(e: SessionEvent): number {
  const cand =
    e.ts ?? e.time ?? e.timestamp ?? e.created_at ?? e?.ctx?.ts ?? e?.ctx?.time;
  if (cand == null) return Number.NaN;
  if (typeof cand === "number") return cand > 10_000_000_000 ? cand : cand * 1000;
  const ms = Date.parse(String(cand));
  return Number.isFinite(ms) ? ms : Number.NaN;
}

export function getEventLabel(e: SessionEvent): string {
  return e.name ?? e.type ?? e.event ?? e.kind ?? (e?.ctx?.event ?? "event");
}

export function labelKey(e: SessionEvent | { label?: string }): string {
  const raw =
    "label" in e && (e as any).label
      ? (e as any).label
      : "name" in e && (e as any).name
      ? (e as any).name
      : getEventLabel(e as SessionEvent);
  return String(raw).toLowerCase().replace(/\s+/g, "_");
}

export function isTextChange(e: SessionEvent): boolean {
  const label = getEventLabel(e).toLowerCase();
  return label === "text_change" || label === "text-change" || label === "textchange";
}

export function isTextSend(e: SessionEvent): boolean {
  return labelKey(e) === "text_send";
}
export function isDictStart(e: SessionEvent): boolean {
  const k = labelKey(e);
  return k === "start_dictation" || k === "start_dication";
}
export function isDictEnd(e: SessionEvent): boolean {
  return labelKey(e) === "end_dictation";
}
export function isCancelDict(e: SessionEvent): boolean {
  return labelKey(e) === "cancel_dictation";
}
export function isVoiceSend(e: SessionEvent): boolean {
  return labelKey(e) === "send_voice";
}

export function getEventValue(e: SessionEvent): string | null {
  const v = e.value ?? e?.ctx?.value ?? e?.data?.value ?? e?.payload?.value ?? null;
  return v == null ? null : String(v);
}
