"use client";

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { avg, median, msFmt } from "./utils";
import { PStats } from "./types";

export function AvgLenPerParticipantChart({ data }: { data: { participant: string; avgLen: number }[] }) {
  return (
    <div className="h-full">
      <h3 className="text-lg font-semibold mb-2">Average message length per participant</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="participant" tick={{ fontSize: 12 }} hide={data.length > 24} />
          <YAxis />
          <Tooltip formatter={(v: any) => [`${v} chars`, "Avg. length"]} />
          <Bar dataKey="avgLen" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AvgMsgsPerParticipantChart({ data }: { data: { participant: string; avgCount: number }[] }) {
  return (
    <div className="h-full">
      <h3 className="text-lg font-semibold mb-2">Average #messages per participant</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="participant" tick={{ fontSize: 12 }} hide={data.length > 24} />
          <YAxis />
          <Tooltip formatter={(v: any) => [`${v}`, "Avg. messages / session"]} />
          <Bar dataKey="avgCount" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EditTimePerParticipantChart({ rows }: { rows: PStats[] }) {
  const data = rows.map((p) => ({
    participant: p.participant || "anonymous",
    avgEditMs: Math.round(avg(p.editDurations)),
    medEditMs: Math.round(median(p.editDurations)),
  }));
  return (
    <div className="h-full">
      <h3 className="text-lg font-semibold mb-2">
        Edit time (avg) per participant
        <span className="block text-sm text-muted-foreground font-normal">
          Computed from durations of contiguous <code>text_change</code> groups
        </span>
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="participant" tick={{ fontSize: 12 }} hide={rows.length > 24} />
          <YAxis />
          <Tooltip formatter={(v: any) => [msFmt(Number(v)), "Avg. edit time"]} />
          <Bar dataKey="avgEditMs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PostDictAvgEditsChart({
  data,
}: {
  data: { participant: string; avgPostDictEdits: number }[];
}) {
  return (
    <div className="h-full">
      <h3 className="text-lg font-semibold mb-2">Avg. edits after dictation (per participant)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="participant" tick={{ fontSize: 12 }} hide={data.length > 24} />
          <YAxis />
          <Tooltip formatter={(v: any) => [`${v}`, "Avg. post-dictation edits"]} />
          <Bar dataKey="avgPostDictEdits" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PostDictAvgEditDurationChart({
  data,
}: {
  data: { participant: string; avgPostDictEditMs: number }[];
}) {
  return (
    <div className="h-full">
      <h3 className="text-lg font-semibold mb-2">Avg. post-dictation edit duration (per participant)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="participant" tick={{ fontSize: 12 }} hide={data.length > 24} />
          <YAxis />
          <Tooltip formatter={(v: any) => [msFmt(Number(v)), "Avg. post-dictation edit time"]} />
          <Bar dataKey="avgPostDictEditMs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InterviewDurationPerParticipantChart({
  data,
}: {
  data: { participant: string; avgInterviewMs: number }[];
}) {
  return (
    <div className="h-full">
      <h3 className="text-lg font-semibold mb-2">Avg. interview duration (per participant)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="participant" tick={{ fontSize: 12 }} hide={data.length > 24} />
          <YAxis />
          <Tooltip formatter={(v: any) => [msFmt(Number(v)), "Avg. interview time"]} />
          <Bar dataKey="avgInterviewMs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
