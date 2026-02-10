"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { avg, msFmt } from "./utils";
import { PStats } from "./types";

type Totals = {
  totalEndDictation: number;
  totalCancelDictation: number;
  totalTextOnlySends: number;
};

function numMinMax(nums: number[]) {
  const v = nums.filter((n) => Number.isFinite(n));
  if (!v.length) return { min: 0, max: 0 };
  return { min: Math.min(...v), max: Math.max(...v) };
}

export function StatsGrid({
  filteredRows,
  totals,
}: {
  filteredRows: PStats[];
  totals: Totals;
}) {

  const allMsgLengths = filteredRows.flatMap((p) => p.msgLengths);
  const msgLenExt = numMinMax(allMsgLengths);

  const perParticipantAvgMsgLen = filteredRows.map((p) => avg(p.msgLengths));
  const avgMsgLenStats = numMinMax(perParticipantAvgMsgLen);

  const allInterviewDurations = filteredRows.flatMap((p) => p.interviewDurationsMs);
  const interviewDurAvg = Math.round(avg(allInterviewDurations));
  const interviewDurMM = numMinMax(allInterviewDurations);

  const endDictTotalsPerParticipant = filteredRows.map(
    (p) => p.endDictationPerSession.reduce((a, b) => a + b, 0)
  );
  const endDictMM = numMinMax(endDictTotalsPerParticipant);


return (
  <div className="grid grid-cols-1 md:grid-cols-9 gap-4">
    <SimpleStat
      title="Participants"
      description="with at least one message"
      value={filteredRows.length}
    />

    <SimpleStat
      title="Interview duration"
      description={
        <>
          <div>(average total time spent in session)</div>
          <div className="text-sm text-muted-foreground">
            <span>min: {msFmt(interviewDurMM.min)}</span> {" "}
            <span>max: {msFmt(interviewDurMM.max)}</span>
          </div>
        </>
      }
      value={msFmt(interviewDurAvg)}
    />

    <SimpleStat
      title="Average messages per session"
      description="across all participants"
      value={Math.round(avg(filteredRows.flatMap((p) => p.msgCountsPerSession)))}
    />

    <SimpleStat
      title="Average message length"
      description={
        <>
          <div>(across all participants)</div>
          <div className="text-sm text-muted-foreground">
            <span>min avg: {Math.round(avgMsgLenStats.min)} chars</span> {" "}
            <span>max avg: {Math.round(avgMsgLenStats.max)} chars</span>
          </div>
        </>
      }
      value={`${Math.round(avg(filteredRows.flatMap((p) => p.msgLengths)))} chars`}
    />

    <SimpleStat
      title="Message length extremes"
      description={
        <div className="text-sm text-muted-foreground">
          <div>min: {msgLenExt.min} chars</div>
          <div>max: {msgLenExt.max} chars</div>
        </div>
      }
      value={`${msgLenExt.max} chars`}
    />

    <SimpleStat
      title="Total Voice Mode Sends"
      description="Total times the send voice button was pressed"
      value={filteredRows.reduce((a, b) => a + b.dictationMsgs, 0)}
    />

    <SimpleStat
      title="Total times the dictation button was used"
      description={
        <div className="text-sm text-muted-foreground">
          <div>min per participant: {endDictMM.min}</div>
          <div>max per participant: {endDictMM.max}</div>
        </div>
      }
      value={totals.totalEndDictation}
    />

    <SimpleStat
      title="Total times the dictation was canceled"
      description=""
      value={totals.totalCancelDictation}
    />

    <SimpleStat
      title="Messages sent only via text input"
      description={
        <>
          Grouped <code>text_change</code> last value equals <code>text_send</code>, no
          dictation/voice between
        </>
      }
      value={totals.totalTextOnlySends}
    />

    <SimpleStat
      title="Avg. edits after dictation"
      description="average across all participants"
      value={avg(filteredRows.flatMap((p) => p.postDictationEditCounts)).toFixed(2)}
    />

    <SimpleStat
      title="Avg. post-dictation edit time per used dictation"
      description="first→last edit time after dictation divided by total dictations"
      value={msFmt(
        Math.round(avg(filteredRows.flatMap((p) => p.postDictationEditDurations)))
      )}
    />
  </div>
);

}

function SimpleStat({
  title,
  description,
  value,
}: {
  title: string;
  description: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
