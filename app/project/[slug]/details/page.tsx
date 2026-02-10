"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { useJWTAuth } from "@/context/jwtAuth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, CheckCircle2, Copy, Download, LibraryBig, BarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryResponse } from "@/lib/interviewSessionLoader"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StimulusGroup, extractStimulusACVGroups } from "@/lib/acvExtract";
import { fetchInterviewHistory } from "@/lib/interviewSessionLoader";

const api_url = process.env.NEXT_PUBLIC_API_URL;

type ProjectDetailsOut = {
  id: number;
  slug: string;
  topic: string;
  description: string;
  stimuli: string[];
  n_stimuli: number;
  model: string;
  base_url: string;
  created_at?: string | null;
  is_active?: boolean | null;
  n_values_max?: number | null;
  min_nodes?: number | null;

  voice_enabled: boolean;
  advanced_voice_enabled: boolean;
  interview_mode: number;
  tree_enabled: boolean;

  sessions_total: number;
  last_activity?: string | null;
  max_retries: number;
  auto_send: boolean;
  time_limit: number;
  r2_bucket: string;

  language: string;
};

type PageProps = { params: { slug: string } };

type ExportOptions = {
  requireCompletedFlag: boolean;
  includeEmptyStimuli: boolean;
  includeIncompleteChains: boolean;
  mergeConsequencePath: boolean;
  checkSuperSet: boolean;
  excludeEmptyInterviews: boolean;
};

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  requireCompletedFlag: false,
  includeEmptyStimuli: false,
  includeIncompleteChains: true,
  mergeConsequencePath: true,
  checkSuperSet: true,
  excludeEmptyInterviews: true,
};

type InterviewSessionSummary = {
  id: string;
  project_id: number;
  n_messages: number;
  started: boolean;
  finished: boolean;
  n_finished_chats?: number;
  created_at?: string | null;
  updated_at?: string | null;
  user_id: string;
};
type SessionsResponse = {
  topic: string;
  total: number;
  sessions: InterviewSessionSummary[];
};

type TranscriptFormat = "text" | "json";

export default function ProjectDetailsPage({ params }: PageProps) {
  const router = useRouter();
  const { fetchWithAuth } = useJWTAuth();
  const [data, setData] = useState<ProjectDetailsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadedSlug, setDownloadedSlug] = useState<string | null>(null);

  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [transcriptFormat, setTranscriptFormat] = useState<TranscriptFormat>("json");
  const [transcriptExporting, setTranscriptExporting] = useState(false);
  const [transcriptProgress, setTranscriptProgress] = useState<{ done: number; total: number } | null>(null);

  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
  const [bulkExportOptions, setBulkExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  const fetchDetails = async () => {
    const res = await fetchWithAuth?.(`${api_url}/projects/${params.slug}/details`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res || !res.ok) throw new Error("Failed to load project details");
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchDetails();
      } catch (e) {
        console.error(e);
        alert("Failed to load project details.");
        router.push("/project");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.slug]);

  const copyToClipboard = async (slug: string) => {
    if (!data) return;
    const fullUrl = `${window.location.origin}/project/${data.slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(slug);
      setTimeout(() => {
        setCopiedId((prev) => (prev === slug ? null : prev));
      }, 800);
    } catch {
      console.error("unable to copy!");
    }
  };

  function getFilenameFromContentDisposition(cd: string | null): string | null {
    if (!cd) return null;
    const star = cd.match(/filename\*\s*=\s*([^;]+)/i);
    if (star) {
      const v = star[1].trim().replace(/^UTF-8''/i, "");
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
    const plain = cd.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
    if (plain) return (plain[1] || plain[2]).trim();
    return null;
  }

  const downloadReadableTranscripts = async (slug: string) => {
    const res = await fetchWithAuth?.(`${api_url}/projects/${slug}/downloadChats`, {
      credentials: "include",
    });
    if (!res?.ok) {
      console.error("Download failed:", res?.status, await res?.text());
      return;
    }

    const cd = res.headers.get("content-disposition");
    const serverFile = getFilenameFromContentDisposition(cd);
    const fallback = `interviews_${slug}_${new Date().toISOString().slice(0, 10)}.txt`;
    const filename = serverFile || fallback;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 500);

    setDownloadedSlug(slug);
    setTimeout(() => {
      setDownloadedSlug((prev) => (prev === slug ? null : prev));
    }, 2000);
  };

  const exportAllTranscriptsAsJSON = async () => {
    if (!data) return;
    try {
      setTranscriptExporting(true);

      const res = await fetchWithAuth?.(`${api_url}/project/${data.slug}/results`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res || !res.ok) throw new Error("Failed to load sessions for transcript export");
      const { sessions }: SessionsResponse = await res.json();

      setTranscriptProgress({ done: 0, total: sessions.length });

      let failedCount = 0;

      const results = await Promise.all(
        sessions.map(async (s) => {
          try {
            const hr: HistoryResponse = await fetchInterviewHistory(s.id, data.slug, fetchWithAuth);

            const stimuli_order = Array.isArray(hr.order) ? hr.order : [];

            const blocks = Array.isArray(hr.content) ? hr.content : [];
            const history = blocks
              .flatMap((block) => (Array.isArray(block) ? block : []))
              .map(({ role, content }) => ({ role, content }))
              .filter((m) => typeof m.content === "string" && m.content.trim().length > 0);

            return {
              session_id: s.id,
              user_id: s.user_id,
              n_messages: s.n_messages,
              created_at: s.created_at ?? null,
              updated_at: s.updated_at ?? null,
              stimuli_order,
              history,
            };
          } catch {
            failedCount += 1;
            return {
              session_id: s.id,
              n_messages: s.n_messages,
              created_at: s.created_at ?? null,
              updated_at: s.updated_at ?? null,
              stimuli_order: [],
              history: [],
            };
          } finally {
            setTranscriptProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
          }
        })
      );

      const payload = {
        project: data.topic,
        project_slug: data.slug,
        exported_at: new Date().toISOString(),
        total_sessions: sessions.length,
        sessions_exported: sessions.length - failedCount,
        sessions_export_failed: failedCount,
        sessions: results,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcripts_${data.slug}_ALL_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed for transcripts (JSON)!");
    } finally {
      setTranscriptExporting(false);
      setTranscriptProgress(null);
    }
  };



  const handleToggle = async () => {
    if (!data) return;
    setToggling(true);
    try {
      const res = await fetchWithAuth?.(`${api_url}/projects/${data.id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res || !res.ok) throw new Error("Toggle failed");
      const updated = await res.json();
      setData((prev) => (prev ? { ...prev, is_active: updated.is_active } : prev));
    } catch (e) {
      console.error(e);
      alert("Error while toggling project state.");
    } finally {
      setToggling(false);
    }
  };

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  const openBulkExportDialog = () => {
    setBulkExportOptions(DEFAULT_EXPORT_OPTIONS);
    setBulkExportDialogOpen(true);
  };

  const groupHasContent = (g: StimulusGroup) => {
    const anyLen = (x: unknown) => (Array.isArray(x) ? x.length > 0 : !!x);
    const chains = (g as any)?.chains;
    const acv = (g as any)?.acv;
    const values = (g as any)?.values;
    const entries = (g as any)?.entries;
    const nodes = (g as any)?.nodes;
    return [chains, acv, values, entries, nodes].some(anyLen);
  };

  const sessionHasContent = (groups: StimulusGroup[] | null | undefined) =>
    !!groups && groups.some(groupHasContent);

  const handleExportAllACV = async (opts: ExportOptions) => {
    if (!data) return;
    try {
      setBulkExporting(true);

      const res = await fetchWithAuth?.(`${api_url}/project/${data.slug}/results`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res || !res.ok) throw new Error("Failed to load sessions for export");
      const { sessions }: SessionsResponse = await res.json();

      setExportProgress({ done: 0, total: sessions.length });

      const tasks = sessions.map((s) =>
        (async () => {
          try {
            const history = await fetchInterviewHistory(s.id, data.slug, fetchWithAuth);
            const groups: StimulusGroup[] = extractStimulusACVGroups(history.tree, {
              requireCompletedFlag: opts.requireCompletedFlag,
              includeEmptyStimuli: opts.includeEmptyStimuli,
              includeIncompleteChains: opts.includeIncompleteChains,
              mergeConsequencePath: opts.mergeConsequencePath,
              checkSuperSet: opts.checkSuperSet,
            });

            if (opts.excludeEmptyInterviews) {
              const isEmpty = !groups || groups.length === 0 || !sessionHasContent(groups);
              if (isEmpty) return null;
            }
            return { session_id: s.id, stimuli: groups };
          } catch (_err) {
            if (opts.excludeEmptyInterviews) return null;
            return { session_id: s.id, stimuli: [] };
          }
        })().finally(() =>
          setExportProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
        )
      );

      const results = await Promise.allSettled(tasks);

      const succeeded = results
        .filter(
          (r): r is PromiseFulfilledResult<{ session_id: string; stimuli: StimulusGroup[] } | null> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value)
        .filter((v): v is { session_id: string; stimuli: StimulusGroup[] } => v !== null);

      const failed = results
        .map((r, i) => ({ r, session: sessions[i] }))
        .filter(
          (x): x is {
            r: PromiseRejectedResult & {
              reason: { error: unknown; session_id: string; groups: null };
            };
            session: (typeof sessions)[number];
          } => x.r.status === "rejected"
        );

      const excludedCount = sessions.length - (succeeded.length + failed.length);

      const payload = {
        project: data.topic,
        project_slug: data.slug,
        exported_at: new Date().toISOString(),
        total_sessions: sessions.length,
        sessions_exported: succeeded.length,
        sessions_excluded_empty: excludedCount,
        sessions_export_failed: failed.length,
        sessions: succeeded,
        options: opts,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acv_${data.slug}_ALL_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed for all interviews!");
    } finally {
      setBulkExporting(false);
      setExportProgress(null);
    }
  };

  const confirmBulkExport = async () => {
    await handleExportAllACV(bulkExportOptions);
    setBulkExportDialogOpen(false);
  };

  if (loading) {
    return (
      <RequireAuthLevel>
        <div className="p-6">Loading…</div>
      </RequireAuthLevel>
    );
  }

  if (!data) {
    return (
      <RequireAuthLevel>
        <div className="p-6">Project not found.</div>
      </RequireAuthLevel>
    );
  }

  function ProgressSlot({
    done,
    total,
  }: { done?: number; total?: number }) {
    const t = total ?? data?.sessions_total ?? 0;
    const digits = String(Math.max(1, t)).length;

    const slotWidthCh = digits+1+digits;

    return (
      <span
        className="inline-block tabular-nums font-mono text-right"
        style={{ width: `${slotWidthCh}ch` }}
      >
        {typeof done === "number" && typeof total === "number"
          ? `${done}/${total}`
          : "…"}
      </span>
    );
  }

  const openTranscriptDialog = () => {
    setTranscriptFormat("json");
    setTranscriptDialogOpen(true);
  };

  const confirmTranscriptDownload = async () => {
    if (!data) return;
    try {
      if (transcriptFormat === "text") {
        await downloadReadableTranscripts(data.slug);
      } else {
        await exportAllTranscriptsAsJSON();
      }
    } finally {
      setTranscriptDialogOpen(false);
    }
  };

  return (
    <RequireAuthLevel>
      <div className="flex flex-col h-full bg-white">
        <div className="border-b border-gray-200 p-6 bg-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{data.topic}</h1>
                <div className="text-gray-600 text-sm">
                  <span className="font-mono">{data.slug}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "px-2.5 py-1 text-xs",
                  data.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}
                title={data.is_active ? "Active" : "Inactive"}
              >
                {data.is_active ? <Unlock className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                {data.is_active ? "Active" : "Inactive"}
              </Badge>

              <Button variant={"outline"} onClick={handleToggle} disabled={toggling} className="text-600 hover:text-blue-700 font-medium text-xs truncate max-w-xs">
                {toggling ? "" : data.is_active ? "Close Project" : "Open Project"}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant={"outline"}
                  onClick={() => {
                    copyToClipboard(data.slug);
                  }}
                  className="text-600 hover:text-blue-700 font-medium text-xs truncate max-w-xs"
                  title={`Copy link: ${data.slug}`}
                >
                  <div className="flex items-center gap-1">
                    <span>{copiedId === data.slug ? <CheckCircle2 size={16} /> : <Copy size={16} />}</span>
                    <span>{`Copy link (${data.slug})`}</span>
                  </div>
                </Button>

                <Button
                  variant={"outline"}
                  onClick={openTranscriptDialog}
                  className="text-600 hover:text-blue-700 font-medium text-xs truncate max-w-xs"
                  title={`Download Transcripts (all)`}
                  disabled={(data.sessions_total ?? 0) === 0}
                >
                  <div className="flex items-center gap-1">
                    <span>
                      {downloadedSlug === data.slug ? <CheckCircle2 size={16} /> : <Download size={16} />}
                    </span>
                    <span>{`Download Transcripts (all)`}</span>
                  </div>
                </Button>
              </div>

              <Button
                variant={"outline"}
                className="text-600 hover:text-blue-700 font-medium text-xs truncate max-w-xs"
                onClick={openBulkExportDialog}
                title="Export ACV chains of all interviews"
                disabled={bulkExporting || (data.sessions_total ?? 0) === 0}
              >
                <div className="flex items-center gap-1">
                  <span>
                  <Download className="h-4 w-4" />
                  </span>
                  <span>{bulkExporting ? "Exporting…" : "Export ACV (all)"}</span>
                </div>
              </Button>

              <Button
                onClick={() => router.push(`/project/${data.slug}/results`)}
                variant="outline"
                className="text-600 hover:text-blue-700 font-medium text-xs truncate max-w-xs"
              >
                <LibraryBig className="h-4 w-4" />
                View Interviews
              </Button>

              <Button
                onClick={() => router.push(`/project/${data.slug}/analytics`)}
                variant="outline"
                className="text-600 hover:text-blue-700 font-medium text-xs truncate max-w-xs"
                title="Show analytics"
              >
                <BarChart className="h-4 w-4" />
                Analytics
              </Button>

            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium">{fmt(data.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium">{data.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Model</span>
                  <span className="font-medium">{data.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Base URL</span>
                  <span className="font-medium">{data.base_url}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max values/chat</span>
                  <span className="font-medium">
                    {(data.n_values_max ?? -1) < 0 ? "No limit" : data.n_values_max}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Min Nodes/chat</span>
                  <span className="font-medium">
                    {(data.min_nodes ?? -1) < 0 ? "0" : data.min_nodes}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time limit</span>
                  <span className="font-medium">
                    {(data.time_limit ?? -1) < 0 ? "No limit" : data.time_limit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max retries</span>
                  <span className="font-medium">
                    {(data.max_retries ?? -1) < 0 ? "No limit" : data.max_retries}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interview Mode</span>
                  <span className="font-medium">{data.interview_mode == 1 ? "Hybrid" : data.interview_mode == 2 ? "Text Only" : "Voice Only"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transcription enabled</span>
                  <span className="font-medium">{data.voice_enabled ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Advanced voice mode enabled</span>
                  <span className="font-medium">{data.advanced_voice_enabled ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interviewee can see acv tree</span>
                  <span className="font-medium">{data.tree_enabled ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Auto send voice message</span>
                  <span className="font-medium">{data.auto_send ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">r2 bucket</span>
                  <span className="font-medium">{data.r2_bucket ? data.r2_bucket : "No voice recorded"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">language</span>
                  <span className="font-medium">{data.language}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-800 whitespace-pre-wrap">
                {data.description || "—"}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Session Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sessions total</span>
                  <span className="font-medium">{data.sessions_total} </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Last activity</span>
                  <span className="font-medium">{fmt(data.last_activity)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Stimuli (select {data.n_stimuli} of {data.stimuli?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {!data.stimuli || data.stimuli.length === 0 ? (
                  <div className="text-gray-600">No stimuli configured.</div>
                ) : (
                  <ul className="list-disc pl-6 space-y-1">
                    {data.stimuli.map((s, i) => (
                      <li key={i} className="text-gray-800">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Transcripts (all)
            </DialogTitle>
            <DialogDescription>
              Choose the export format for all interviews of this project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-gray-900">Format</legend>

              <div className="flex items-center justify-between gap-4 border rounded-lg p-3">
                <div>
                  <Label htmlFor="fmt-json" className="font-medium">
                    JSON
                  </Label>
                  <p className="text-xs text-gray-500">
                    Structured .json with all messages
                  </p>
                </div>
                <input
                  id="fmt-json"
                  type="radio"
                  name="transcript-format"
                  className="h-4 w-4"
                  checked={transcriptFormat === "json"}
                  onChange={() => setTranscriptFormat("json")}
                />
              </div>

              <div className="flex items-center justify-between gap-4 border rounded-lg p-3">
                <div>
                  <Label htmlFor="fmt-text" className="font-medium">
                    TXT
                  </Label>
                  <p className="text-xs text-gray-500">
                    Single .txt file with all messages
                  </p>
                </div>
                <input
                  id="fmt-text"
                  type="radio"
                  name="transcript-format"
                  className="h-4 w-4"
                  checked={transcriptFormat === "text"}
                  onChange={() => setTranscriptFormat("text")}
                />
              </div>



            </fieldset>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setTranscriptDialogOpen(false)}
              disabled={transcriptExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmTranscriptDownload}
              disabled={transcriptExporting || !data || (data.sessions_total ?? 0) === 0}
            >
              {transcriptExporting ? (
                <span className="inline-flex items-center gap-2">
                  <span>Exporting</span>
                  <ProgressSlot
                    done={transcriptProgress?.done}
                    total={transcriptProgress?.total ?? data?.sessions_total}
                  />
                </span>
              ) : (
                "Export (all)"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkExportDialogOpen} onOpenChange={setBulkExportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Export ACV options (all interviews)
            </DialogTitle>
            <DialogDescription>
              Creates a unified json including all interview acv chains of this interview and downloads it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bulk-requireCompletedFlag" className="font-medium">
                  requireCompletedFlag
                </Label>
                <p className="text-xs text-gray-500">Only export nodes marked as completed</p>
              </div>
              <Switch
                id="bulk-requireCompletedFlag"
                checked={bulkExportOptions.requireCompletedFlag}
                onCheckedChange={(val) =>
                  setBulkExportOptions((o) => ({ ...o, requireCompletedFlag: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bulk-includeEmptyStimuli" className="font-medium">
                  includeEmptyStimuli
                </Label>
                <p className="text-xs text-gray-500">Export empty/unselected stimuli aswell</p>
              </div>
              <Switch
                id="bulk-includeEmptyStimuli"
                checked={bulkExportOptions.includeEmptyStimuli}
                onCheckedChange={(val) =>
                  setBulkExportOptions((o) => ({ ...o, includeEmptyStimuli: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bulk-includeIncompleteChains" className="font-medium">
                  includeIncompleteChains
                </Label>
                <p className="text-xs text-gray-500">Export incomplete Chains (e.g. A-C)</p>
              </div>
              <Switch
                id="bulk-includeIncompleteChains"
                checked={bulkExportOptions.includeIncompleteChains}
                onCheckedChange={(val) =>
                  setBulkExportOptions((o) => ({ ...o, includeIncompleteChains: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bulk-mergeConsequencePath" className="font-medium">
                  mergeConsequencePath
                </Label>
                <p className="text-xs text-gray-500">
                  Show each relevant consequence (A-C1-C2-C3-V)
                </p>
              </div>
              <Switch
                id="bulk-mergeConsequencePath"
                checked={bulkExportOptions.mergeConsequencePath}
                onCheckedChange={(val) =>
                  setBulkExportOptions((o) => ({ ...o, mergeConsequencePath: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bulk-checkSuperSet" className="font-medium">
                  checkSuperSet
                </Label>
                <p className="text-xs text-gray-500">Remove sub duplicates</p>
              </div>
              <Switch
                id="bulk-checkSuperSet"
                checked={bulkExportOptions.checkSuperSet}
                onCheckedChange={(val) =>
                  setBulkExportOptions((o) => ({ ...o, checkSuperSet: val }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="bulk-excludeEmptyInterviews" className="font-medium">
                  excludeEmptyInterviews
                </Label>
                <p className="text-xs text-gray-500">
                  Exclude interviews with no chains
                </p>
              </div>
              <Switch
                id="bulk-excludeEmptyInterviews"
                checked={bulkExportOptions.excludeEmptyInterviews}
                onCheckedChange={(val) =>
                  setBulkExportOptions((o) => ({ ...o, excludeEmptyInterviews: val }))
                }
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkExportDialogOpen(false)}
              disabled={bulkExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBulkExport}
              disabled={bulkExporting || !data || (data.sessions_total ?? 0) === 0}
            >
              {bulkExporting ? (
                <span className="inline-flex items-center gap-2">
                  <span>Exporting</span>
                  <ProgressSlot
                    done={exportProgress?.done}
                    total={exportProgress?.total ?? data?.sessions_total}
                  />
                </span>
              ) : (
                "Export (all)"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireAuthLevel>
  );
}
