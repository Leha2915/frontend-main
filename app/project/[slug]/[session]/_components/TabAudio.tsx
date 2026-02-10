"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Info, Layers, Play, LucideRefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const api_url = process.env.NEXT_PUBLIC_API_URL;
const NOT_CONFIGURED_MSG = "not configured for this project";

type R2Item = {
  key: string;
  size_bytes_on_r2?: number | null;
  etag?: string | null;
  last_modified?: string | null;
  storage_class?: string | null;
  metadata?: {
    ["project-slug"]?: string | null;
    ["interview-session-id"]?: string | null;
    ["duration-sec"]?: string | null;
    ["size-bytes"]?: string | null;
    ["original-filename"]?: string | null;
    ["uploaded-at"]?: string | null;
    ["hash-sha256"]?: string | null;
    content_type?: string | null;
  } | null;
};

type ListResponse = {
  ok: boolean;
  count: number;
  prefix: string;
  items: R2Item[];
  is_truncated: boolean;
  next_continuation_token?: string | null;
};

async function mapApiError(res: Response) {
  if (res.status === 500) return NOT_CONFIGURED_MSG;
  try {
    const data = await res.clone().json().catch(async () => {
      const t = await res.text().catch(() => "");
      return t ? { detail: t } : null;
    });
    const detail =
      (data as any)?.detail ??
      (data as any)?.error ??
      (data as any)?.message ??
      (typeof data === "string" ? data : null);
    return detail ? String(detail) : `API error ${res.status}`;
  } catch {
    return `API error ${res.status}`;
  }
}

export default function SessionAudiosTab({
  projectSlug,
  sessionId,
  fetchWithAuth,
}: {
  projectSlug: string;
  sessionId: string;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}) {
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [items, setItems] = useState<R2Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [signing, setSigning] = useState<Record<string, boolean>>({});

  const parseMaybeISO = (s?: string | null): Date | null => {
    if (!s) return null;
    let d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
    if (/T\d{2}-\d{2}-\d{2}/.test(s)) {
      const fixed = s.replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
      d = new Date(fixed);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  };

  const fmtBytes = (n?: number | string | null) => {
    if (n == null) return "—";
    const val = typeof n === "string" ? parseInt(n, 10) : n;
    if (!Number.isFinite(val)) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = val as number;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const fmtDate = (raw?: string | null) => {
    const d = parseMaybeISO(raw);
    return d ? d.toLocaleString() : "—";
  };

  const fmtDuration = (s?: string | null) => {
    if (!s) return "—";
    const sec = Number(s);
    if (!Number.isFinite(sec)) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const r = Math.floor(sec % 60);
    const pad = (x: number) => x.toString().padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
  };

  const loadPage = async (token?: string | null, reset = false) => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        project_slug: projectSlug,
        interview_session_id: sessionId,
        include_metadata: String(includeMetadata),
        max_keys: "100",
      });
      if (token) qs.set("continuation_token", token);

      const res = await fetchWithAuth(`${api_url}/uploads/audio?${qs.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await mapApiError(res);
        throw new Error(msg);
      }

      const data: ListResponse = await res.json();
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setNextToken(data.next_continuation_token ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load audios");
    } finally {
      setLoading(false);
    }
  };

  const initialLoad = async () => {
    setItems([]);
    setNextToken(null);
    setSigned({});
    setSigning({});
    await loadPage(null, true);
  };

  useEffect(() => {
    initialLoad();
  }, [projectSlug, sessionId, includeMetadata]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ra = a.last_modified ?? a.metadata?.["uploaded-at"] ?? "";
      const rb = b.last_modified ?? b.metadata?.["uploaded-at"] ?? "";
      const ta = parseMaybeISO(ra)?.getTime() ?? 0;
      const tb = parseMaybeISO(rb)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [items]);

  const handleRefresh = async () => {
    setReloading(true);
    await initialLoad();
    setReloading(false);
  };

  const signUrl = async (key: string, force = false) => {
    if (!force && signed[key]) return signed[key];
    const qs = new URLSearchParams({
      project_slug: projectSlug,
      interview_session_id: sessionId,
      key,
      expires_sec: "300",
    });

    setSigning((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetchWithAuth(`${api_url}/uploads/audio/signed-url?${qs.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await mapApiError(res);
        throw new Error(msg);
      }
      const { url } = await res.json();
      setSigned((p) => ({ ...p, [key]: url }));
      return url as string;
    } finally {
      setSigning((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {sorted.length} recording{sorted.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading || reloading}
            className="flex items-center gap-2"
            title="Reload list"
          >
            <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} />
            Reload
          </Button>

          {nextToken && (
            <Button
              size="sm"
              onClick={() => loadPage(nextToken)}
              disabled={loading}
              className="flex items-center gap-2"
            >
              Load more
            </Button>
          )}
        </div>
      </div>

      {err && (
        err === NOT_CONFIGURED_MSG ? (
          <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-800">
            {NOT_CONFIGURED_MSG}
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )
      )}

      {!err && !loading && sorted.length === 0 && (
        <div className="text-gray-600">No audio uploads found</div>
      )}

      {loading && sorted.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse h-40 rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((it) => {
            const name = it.metadata?.["original-filename"] ?? it.key.split("/").pop() ?? it.key;
            const uploadedAtRaw = it.last_modified ?? it.metadata?.["uploaded-at"];
            const duration = it.metadata?.["duration-sec"] ?? null;
            const contentType = it.metadata?.content_type ?? "audio/mpeg";
            const url = signed[it.key];
            const isSigning = !!signing[it.key];

            return (
              <Card key={it.key} className="rounded-2xl border shadow-sm hover:shadow-md transition">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold line-clamp-2">
                      {name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {fmtBytes(it.metadata?.["size-bytes"] ?? it.size_bytes_on_r2)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Uploaded</span>
                    <span className="text-gray-900">{fmtDate(uploadedAtRaw ?? null)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Duration</span>
                    <span className="text-gray-900">{fmtDuration(duration)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>ETag</span>
                    <span className="font-mono text-[11px] break-all">
                      {it.etag ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>SHA-256</span>
                    <span className="font-mono text-[11px] break-all">
                      {it.metadata?.["hash-sha256"] ?? "—"}
                    </span>
                  </div>

                  <div className="pt-2">
                    <div className="h-12 w-full flex items-center">
                      {url ? (
                        <audio
                          key={url}
                          src={url}
                          controls
                          preload="metadata"
                          className="w-full h-10"
                          onError={async () => {
                            try {
                              const fresh = await signUrl(it.key, true);
                              setSigned((p) => ({ ...p, [it.key]: fresh }));
                            } catch (e: any) {
                              setErr(e?.message ?? `audio url invalid or expired (${it.key})`);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-10 rounded-md border border-dashed flex items-center justify-center">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Info className="h-3.5 w-3.5" />
                            Press play to create signed url
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={isSigning}
                      onClick={async () => {
                        try {
                          await signUrl(it.key, !!url);
                        } catch (e: any) {
                          setErr(e?.message ?? "signing failed");
                        }
                      }}
                      title={url ? "Refresh signed url" : "Create signed url"}
                    >
                      {url ? (
                        <LucideRefreshCw className={cn("h-4 w-4", isSigning && "animate-spin")} />
                      ) : (
                        <Play className={cn("h-4 w-4", isSigning && "animate-pulse")} />
                      )}
                      {isSigning ? (url ? "Refreshing…" : "Signing…") : url ? "Refresh URL" : "Create signed URL"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
