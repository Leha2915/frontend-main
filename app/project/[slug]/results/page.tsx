"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useJWTAuth } from "@/context/jwtAuth";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  EyeIcon,
  Copy,
  MessageSquare,
  ListChecks,
  CircleDot,
  Trash2,
  LayoutGrid,
  Table,
  Download,
} from "lucide-react";
import { TreeNode, TreeStructure } from "@/lib/types";
import { ACVChainText, StimulusGroup, extractStimulusACVGroups } from "@/lib/acvExtract";
import { fetchInterviewHistory } from "@/lib/interviewSessionLoader";

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

const api_url = process.env.NEXT_PUBLIC_API_URL;

type InterviewSessionSummary = {
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

type SessionsResponse = {
  topic: string;
  total: number;
  sessions: InterviewSessionSummary[];
};

type PageProps = {
  params: { slug: string };
};

type ExportOptions = {
  requireCompletedFlag: boolean;
  includeEmptyStimuli: boolean;
  includeIncompleteChains: boolean;
  mergeConsequencePath: boolean;
  checkSuperSet: boolean;
};

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  requireCompletedFlag: false,
  includeEmptyStimuli: false,
  includeIncompleteChains: true,
  mergeConsequencePath: true,
  checkSuperSet: true,
};

export default function ResultsPage({ params }: PageProps) {
  const { fetchWithAuth } = useJWTAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resp, setResp] = useState<SessionsResponse | null>(null);

  const [filter, setFilter] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSessionId, setExportSessionId] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetchWithAuth(`${api_url}/project/${params.slug}/results`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load interviews (status: ${res.status})`);
        const data: SessionsResponse = await res.json();
        setResp(data);
      } catch (err) {
        console.error(err);
        alert("Failed to load interviews");
      } finally {
        setLoading(false);
      }
    }
    loadSessions().catch(() => {});
  }, [params.slug, fetchWithAuth]);

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";

  const copyToClipboard = async (session_id: string) => {
    const fullUrl = `${window.location.origin}/project/${params.slug}/${session_id}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(session_id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === session_id ? null : prev));
      }, 800);
    } catch {
      console.error("unable to copy!");
    }
  };

  const handleDelete = async (session_id: string) => {
    const confirmed = confirm("Are you sure you want to delete this session?");
    if (!confirmed) return;

    try {
      setDeletingId(session_id);
      const res = await fetchWithAuth(`${api_url}/session/${session_id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      setResp((prev) =>
        prev
          ? {
              ...prev,
              total: Math.max(0, prev.total - 1),
              sessions: prev.sessions.filter((s) => s.id !== session_id),
            }
          : prev
      );
    } catch (e) {
      console.error(e);
      alert("Error while deleting session.");
    } finally {
      setDeletingId((prev) => (prev === session_id ? null : prev));
    }
  };

  const allSessions = resp?.sessions ?? [];

  const rankedCount = allSessions.length;
  const startedCount = useMemo(
    () => allSessions.filter((s) => s.started).length,
    [allSessions]
  );
  const finishedCount = useMemo(
    () => allSessions.filter((s) => s.finished).length,
    [allSessions]
  );

  const partiallyFinishedCount = useMemo(
    () => allSessions.filter((s) => (s.n_finished_chats ?? 0) > 0 || s.finished).length,
    [allSessions]
  );

  const filteredSessions = useMemo(() => {
    switch (filter) {
      case 1:
        return allSessions.filter((s) => !s.started);
      case 2:
        return allSessions.filter((s) => s.started && (s.n_finished_chats ?? 0) == 0);
      case 3:
        return allSessions.filter((s) => (s.n_finished_chats ?? 0) > 0 && !s.finished);
      case 4:
        return allSessions.filter((s) => s.finished);
      default:
        return allSessions;
    }
  }, [allSessions, filter]);

  const emptyText =
    filter === 1
      ? "No ranking-only interviews"
      : filter === 2
      ? "No started interviews"
      : filter === 3
      ? "No partially finished interviews"
      : filter === 4
      ? "No finished interviews"
      : "No interviews";

  type StageInfo = {
    idx: 1 | 2 | 3 | 4;
    label: string;
    className: string;
    icon: JSX.Element;
  };

  const getStage = (s: InterviewSessionSummary): StageInfo => {
    if (s.finished) {
      return {
        idx: 4,
        label: "Finished",
        className: "bg-emerald-600 text-white hover:bg-emerald-600",
        icon: <CheckCircle2 size={14} />,
      };
    }
    if ((s.n_finished_chats ?? 0) > 0) {
      return {
        idx: 3,
        label: "Partially finished",
        className: "bg-lime-500 text-white hover:bg-lime-500",
        icon: <CircleDot size={14} />,
      };
    }
    if (s.started) {
      return {
        idx: 2,
        label: "Chatted",
        className: "bg-blue-600 text-white hover:bg-blue-600",
        icon: <MessageSquare size={14} />,
      };
    }
    return {
      idx: 1,
      label: "Ranked",
      className: "bg-gray-700 text-white hover:bg-gray-700",
      icon: <ListChecks size={14} />,
    };
  };

  const StageRail = ({ idx }: { idx: number }) => (
    <div className="mt-2 grid grid-cols-4 gap-1 w-44" aria-label="progress stages">
      <span
        className={`h-1.5 rounded-full ${idx >= 1 ? "bg-gray-400" : "bg-gray-200"}`}
        title="ranked"
      />
      <span
        className={`h-1.5 rounded-full ${idx >= 2 ? "bg-blue-500" : "bg-gray-200"}`}
        title="chatted"
      />
      <span
        className={`h-1.5 rounded-full ${idx >= 3 ? "bg-lime-500" : "bg-gray-200"}`}
        title="partially finished"
      />
      <span
        className={`h-1.5 rounded-full ${idx >= 4 ? "bg-emerald-500" : "bg-gray-200"}`}
        title="finished"
      />
    </div>
  );

  const stageDotClass = (idx: number) =>
    idx >= 4
      ? "bg-emerald-500"
      : idx === 3
      ? "bg-lime-500"
      : idx === 2
      ? "bg-blue-500"
      : "bg-gray-400";

  const handleExportACV = async (session_id: string, opts: ExportOptions) => {
    try {
      setExportingId(session_id);

      const resPromise = fetchInterviewHistory(session_id, params.slug, fetchWithAuth);
      const groups: StimulusGroup[] = extractStimulusACVGroups((await resPromise).tree, {
        requireCompletedFlag: opts.requireCompletedFlag,
        includeEmptyStimuli: opts.includeEmptyStimuli,
        includeIncompleteChains: opts.includeIncompleteChains,
        mergeConsequencePath: opts.mergeConsequencePath,
        checkSuperSet: opts.checkSuperSet,
      });

      const payload = {
        project: resp?.topic ?? "",
        project_slug: params.slug,
        session_id,
        exported_at: new Date().toISOString(),
        stimuli: groups,
        options: opts,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acv_${params.slug}_${session_id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export ACV for this session.");
    } finally {
      setExportingId((prev) => (prev === session_id ? null : prev));
    }
  };

  const openExportDialog = (session_id: string) => {
    setExportSessionId(session_id);
    setExportOptions(DEFAULT_EXPORT_OPTIONS);
    setExportDialogOpen(true);
  };

  const confirmExport = async () => {
    if (!exportSessionId) return;
    await handleExportACV(exportSessionId, exportOptions);
    setExportDialogOpen(false);
    setExportSessionId(null);
  };

  if (loading) {
    return (
      <RequireAuthLevel>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-40 rounded-xl bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </RequireAuthLevel>
    );
  }

  return (
    <RequireAuthLevel>
      <div className="flex flex-col h-full bg-white">
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-xl font-semibold">
            Interviews for project '{resp?.topic ?? ""}' ({params.slug})
          </h1>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-72">
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={filter}
                  onChange={(e) => setFilter(Number(e.target.value))}
                  aria-label="Filter"
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="mt-1 grid grid-cols-5 text-xs text-gray-600">
                  <span className={filter === 0 ? "font-medium text-gray-900" : ""}>all</span>
                  <span className={filter === 1 ? "font-medium text-gray-900 text-center" : "text-center"}>
                    ranked
                  </span>
                  <span className={filter === 2 ? "font-medium text-gray-900 text-center" : "text-center"}>
                    chatted
                  </span>
                  <span className={filter === 3 ? "font-medium text-gray-900 text-center" : "text-center"}>
                    partially
                  </span>
                  <span className={filter === 4 ? "font-medium text-gray-900 text-right" : "text-right"}>
                    finished
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" title="(ranked the stimuli)">
                  {rankedCount}/{allSessions.length} ranked the stimuli
                </Badge>
                <Badge variant="outline" title="(typed at least once in any chat)">
                  {startedCount}/{allSessions.length} chatted at least once
                </Badge>
                <Badge variant="outline" title="(finished at least one stimulus chat)">
                  {partiallyFinishedCount}/{allSessions.length} finished at least one chat
                </Badge>
                <Badge variant="outline" title="(finished all stimulus chats)">
                  {finishedCount}/{allSessions.length} finished the interview
                </Badge>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div
                role="tablist"
                aria-label="View mode"
                className="flex items-center gap-1 rounded-lg border bg-white p-1"
              >
                <button
                  role="tab"
                  aria-selected={viewMode === "cards"}
                  onClick={() => setViewMode("cards")}
                  className={`rounded-md px-2 py-1 text-xs flex items-center gap-1
                    ${viewMode === "cards" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                  title="Card view"
                >
                  <LayoutGrid size={14} />
                  Cards
                </button>
                <button
                  role="tab"
                  aria-selected={viewMode === "table"}
                  onClick={() => setViewMode("table")}
                  className={`rounded-md px-2 py-1 text-xs flex items-center gap-1
                    ${viewMode === "table" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                  title="Table view"
                >
                  <Table size={14} />
                  Table
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!resp || resp.total === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <p className="text-gray-600">No interviews found</p>
              <Button variant="secondary" onClick={() => router.refresh()}>
                Retry
              </Button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <p className="text-gray-600">{emptyText}</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">USER ID</th>
                    <th className="px-3 py-2 font-medium">Progress Stage</th>
                    <th className="px-3 py-2 font-medium">#Messages</th>
                    <th className="px-3 py-2 font-medium">#Finished chats</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Modified</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s, idx) => {
                    const stage = getStage(s);
                    return (
                      <tr
                        key={s.id}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap">{idx + 1}</td>
                        <td className="px-3 py-1.5 break-all font-mono">{s.id}</td>
                        <td className="px-3 py-1.5 break-all font-mono">{s.user_id ?? "—"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${stageDotClass(stage.idx)}`} />
                            {stage.label}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{s.n_messages}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{s.n_finished_chats ?? 0}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(s.created_at)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(s.updated_at)}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => copyToClipboard(s.id)}
                              title="copy session link"
                            >
                              {copiedId === s.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => router.push(`/project/${params.slug}/${s.id}`)}
                              title="view details"
                            >
                              <EyeIcon size={14} />
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => openExportDialog(s.id)}
                              title="export ACV chains"
                              disabled={exportingId === s.id}
                            >
                              <Download size={14} />
                            </Button>

                            <Button
                              size="sm"
                              className="h-7 px-2 text-red-600 hover:text-red-700 font-medium hover:bg-red-50"
                              onClick={() => handleDelete(s.id)}
                              title="delete"
                              disabled={deletingId === s.id}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSessions.map((s, idx) => {
                const stage = getStage(s);
                return (
                  <Card
                    key={s.id}
                    className="rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">Interview #{idx + 1}</CardTitle>
                      <div className="font-mono text-xs">
                        <div className="flex">
                          <span className="w-16">ID:</span>
                          <span className="break-all">{s.id}</span>
                        </div>
                        <div className="flex">
                          <span className="w-16">USER&nbsp;ID:</span>
                          <span className="break-all">{s.user_id ?? "—"}</span>
                        </div>
                      </div>
                        </div>

                        <Badge
                          variant="secondary"
                          className={`flex items-center gap-1 ${stage.className}`}
                          title={stage.label}
                        >
                          {stage.icon}
                          {stage.label}
                        </Badge>
                      </div>

                      <StageRail idx={stage.idx} />
                    </CardHeader>

                    <CardContent className="text-sm space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                        <div>
                          <div className="uppercase tracking-wide">Created</div>
                          <div className="font-medium text-gray-900">
                            {formatDate(s.created_at)}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wide">Modified</div>
                          <div className="font-medium text-gray-900">
                            {formatDate(s.updated_at)}
                          </div>
                        </div>
                      </div>
                    </CardContent>

                    <div className="border-t border-gray-200 mx-5" />

                    <CardFooter className="flex items-center justify-end gap-2 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => copyToClipboard(s.id)}
                        title="copy session link"
                      >
                        {copiedId === s.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        Copy
                      </Button>

                      <Button
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => router.push(`/project/${params.slug}/${s.id}`)}
                        title="view details"
                      >
                        <EyeIcon size={16} />
                        Details
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-2"
                        onClick={() => openExportDialog(s.id)}
                        title="export ACV chains"
                        disabled={exportingId === s.id}
                      >
                        <Download size={16} />
                        {exportingId === s.id ? "ACV" : "ACV"}
                      </Button>

                      <Button
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium px-3 py-1 rounded hover:bg-red-50"
                        onClick={() => handleDelete(s.id)}
                        title="delete"
                        disabled={deletingId === s.id}
                      >
                        <Trash2 size={16} />
                        Delete
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Export ACV options
            </DialogTitle>
            <DialogDescription>
              Choose options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="requireCompletedFlag" className="font-medium">
                  requireCompletedFlag
                </Label>
                <p className="text-xs text-gray-500">Only export nodes marked as completed</p>
              </div>
              <Switch
                id="requireCompletedFlag"
                checked={exportOptions.requireCompletedFlag}
                onCheckedChange={(val) => setExportOptions((o) => ({ ...o, requireCompletedFlag: val }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="includeEmptyStimuli" className="font-medium">
                  includeEmptyStimuli
                </Label>
                <p className="text-xs text-gray-500">Export empty/unselected stimuli aswell</p>
              </div>
              <Switch
                id="includeEmptyStimuli"
                checked={exportOptions.includeEmptyStimuli}
                onCheckedChange={(val) => setExportOptions((o) => ({ ...o, includeEmptyStimuli: val }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="includeIncompleteChains" className="font-medium">
                  includeIncompleteChains
                </Label>
                <p className="text-xs text-gray-500">Export incomplete Chains (e.g. A-C)</p>
              </div>
              <Switch
                id="includeIncompleteChains"
                checked={exportOptions.includeIncompleteChains}
                onCheckedChange={(val) => setExportOptions((o) => ({ ...o, includeIncompleteChains: val }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="mergeConsequencePath" className="font-medium">
                  mergeConsequencePath
                </Label>
                <p className="text-xs text-gray-500">Show each relevant consequence (A-C1-C2-C3-V)</p>
              </div>
              <Switch
                id="mergeConsequencePath"
                checked={exportOptions.mergeConsequencePath}
                onCheckedChange={(val) => setExportOptions((o) => ({ ...o, mergeConsequencePath: val }))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="checkSuperSet" className="font-medium">
                  checkSuperSet
                </Label>
                <p className="text-xs text-gray-500">Remove sub duplicates</p>
              </div>
              <Switch
                id="checkSuperSet"
                checked={exportOptions.checkSuperSet}
                onCheckedChange={(val) => setExportOptions((o) => ({ ...o, checkSuperSet: val }))}
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmExport}
              disabled={!exportSessionId || exportingId === exportSessionId}
            >
              {exportingId === exportSessionId ? "Exporting…" : "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireAuthLevel>
  );
}
