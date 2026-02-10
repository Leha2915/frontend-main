"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PStats } from "./types";
import { avg, msFmt } from "./utils";

export function EditIntensityTable({ rows }: { rows: PStats[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Edit rate & intensity</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Participant</th>
              <th className="px-3 py-2 font-medium">Edit rate</th>
              <th className="px-3 py-2 font-medium">Avg. edits / group</th>
              <th className="px-3 py-2 font-medium">Avg. edit time</th>
              <th className="px-3 py-2 font-medium">#Voice sends</th>
              <th className="px-3 py-2 font-medium">Avg. edits during dictation</th>
              <th className="px-3 py-2 font-medium">Avg. edits after dictation</th>
              <th className="px-3 py-2 font-medium">Avg. time end→send</th>
              <th className="px-3 py-2 font-medium">Avg. post-dictation edit time</th>
              <th className="px-3 py-2 font-medium">Avg. #end_dictation / session</th>
              <th className="px-3 py-2 font-medium">Avg. #cancel_dictation / session</th>
              <th className="px-3 py-2 font-medium">Avg. #focus_chat / session</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const withEdits = p.editCounts.filter((c) => (c ?? 0) > 0).length;
              const total = p.editCounts.length || 1;
              const editRate = Math.round((withEdits / total) * 100);
              const avgPostEdits = avg(p.postDictationEditCounts);
              const avgPostDur = avg(p.postDictationEditDurations);
              const avgTimeToSend = avg(p.postDictationTimeToSendMs);
              const avgEndDictPerSession = avg(p.endDictationPerSession);
              const avgCancelDictPerSession = avg(p.cancelDictationPerSession);
              const avgFocusChatPerSession = avg(p.focusChatPerSession);

              return (
                <tr key={p.participant} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono break-all">{p.participant || "anonymous"}</td>
                  <td className="px-3 py-2">{editRate}%</td>
                  <td className="px-3 py-2">{avg(p.editCounts).toFixed(2)}</td>
                  <td className="px-3 py-2">{msFmt(avg(p.editDurations))}</td>
                  <td className="px-3 py-2">{p.dictationMsgs}</td>
                  <td className="px-3 py-2">
                    {p.dictationEditCounts.length ? avg(p.dictationEditCounts).toFixed(2) : "0.00"}
                  </td>
                  <td className="px-3 py-2">
                    {p.postDictationEditCounts.length ? avgPostEdits.toFixed(2) : "0.00"}
                  </td>
                  <td className="px-3 py-2">
                    {p.postDictationTimeToSendMs.length ? msFmt(avgTimeToSend) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.postDictationEditDurations.length ? msFmt(avgPostDur) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.endDictationPerSession.length ? avgEndDictPerSession.toFixed(2) : "0.00"}
                  </td>
                  <td className="px-3 py-2">
                    {p.cancelDictationPerSession.length ? avgCancelDictPerSession.toFixed(2) : "0.00"}
                  </td>
                  <td className="px-3 py-2">
                    {p.focusChatPerSession.length ? avgFocusChatPerSession.toFixed(2) : "0.00"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
