"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, BarChart3, Loader2, Download } from "lucide-react";

type Props = {
  topic: string;
  slug: string;
  totalSessions: number;
  limit: number;
  setLimit: (n: number) => void;
  dictationEnabledOnly: boolean;
  setDictationEnabledOnly: (b: boolean) => void;
  busy: boolean;
  loading: boolean;
  onRefresh: () => void;
  onCompute: () => void;
  progress: number;
  onExport: () => void;
  canExport?: boolean;
};

export function HeaderControls({
  topic,
  slug,
  totalSessions,
  limit,
  setLimit,
  dictationEnabledOnly,
  setDictationEnabledOnly,
  busy,
  loading,
  onRefresh,
  onCompute,
  progress,
  onExport,
  canExport = true,
}: Props) {
  return (
    <div className="border-b border-gray-200 p-6">
      <h1 className="text-xl font-semibold">
        Analytics – Project '{topic}' ({slug})
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Badge variant="outline">Sessions: {totalSessions}</Badge>

        <div className="flex items-center gap-2">
          <Label htmlFor="limit" className="text-xs text-gray-600">
            Max sessions
          </Label>
          <Input
            id="limit"
            type="number"
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Number(e.target.value || 1)))}
            className="h-8 w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="dict-only"
            checked={dictationEnabledOnly}
            onCheckedChange={setDictationEnabledOnly}
          />
          <Label htmlFor="dict-only" className="text-xs text-gray-600">
            Only participants with dictation/voice
          </Label>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={onCompute} disabled={busy || loading}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {busy ? "Computing…" : "Load analytics"}
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={onExport} disabled={!canExport || busy || loading}>
          <Download className="h-4 w-4" />
          Export JSON
        </Button>
      </div>

      {busy && (
        <div className="mt-2 w-full max-w-xl h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
