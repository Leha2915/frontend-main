"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectInfo = {
  slug: string;
  topic: string;
  description?: string;
  baseURL?: string;
  model?: string;
  created_at?: string | null;
  updated_at?: string | null;
  owner?: string | null;
};

type SessionMeta = {
  id: string;
  finished: boolean;
  n_messages: number;
  stimuli_order?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ACVStats = {
  attributes: number;
  consequences: number;
  values: number;
  total: number;
};

type Props = {
  slug: string;
  sessionId: string;
  project: ProjectInfo | null;
  sessionMeta: SessionMeta | null;
  finishedCount: number;
  totalCount: number;
  progressPct: number;
  acv: ACVStats | null;
};

function humanizeDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

export default function SessionInfoTab({
  slug,
  sessionId,
  project,
  sessionMeta,
  finishedCount,
  totalCount,
  progressPct,
  acv,
}: Props) {
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  const durationStr = React.useMemo(() => {
    const created = sessionMeta?.created_at;
    const updated = sessionMeta?.updated_at;
    if (!created || !updated) return null;
    const start = new Date(created).getTime();
    const end = new Date(updated).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const diffMs = end - start;
    return humanizeDuration(diffMs);
  }, [sessionMeta?.created_at, sessionMeta?.updated_at]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Project</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Slug</span>
            <span className="font-mono">{slug}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Topic</span>
            <span className="font-medium">{project?.topic ?? "—"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Created</span>
            <span className="font-medium text-gray-900">{fmt(project?.created_at)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Stimuli</span>
            <span className="font-medium">
              {sessionMeta?.stimuli_order?.length ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">ID</span>
            <span className="font-mono break-all">{sessionId}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Created</span>
            <span className="font-medium">{fmt(sessionMeta?.created_at)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Updated</span>
            <span className="font-medium">{fmt(sessionMeta?.updated_at)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium">{durationStr ?? "—"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Messages</span>
            <span className="font-medium">{sessionMeta?.n_messages ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={finishedCount === totalCount && totalCount > 0 ? "default" : "secondary"}
              className={cn(
                "px-3 py-1 text-sm",
                finishedCount === totalCount && totalCount > 0
                  ? "bg-emerald-600 hover:bg-emerald-600"
                  : "bg-amber-500 text-white"
              )}
              title={finishedCount === totalCount ? "Completed" : "In Progress"}
            >
              {finishedCount === totalCount && totalCount > 0 ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span className="ml-1">
                {finishedCount === totalCount && totalCount > 0 ? "Completed" : "In Progress"}
              </span>
            </Badge>

            <span className="text-sm text-gray-600">
              {progressPct}% ({finishedCount}/{totalCount})
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                finishedCount === totalCount && totalCount > 0 ? "bg-emerald-500" : "bg-amber-500"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Tree Stats</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {acv ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Nodes (total)</div>
                <div className="text-base font-semibold">{acv.total}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Attributes</div>
                <div className="text-base font-semibold">{acv.attributes}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Consequences</div>
                <div className="text-base font-semibold">{acv.consequences}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Values</div>
                <div className="text-base font-semibold">{acv.values}</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">No tree data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
