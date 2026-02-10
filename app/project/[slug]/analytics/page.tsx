"use client";

import { useRouter } from "next/navigation";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { useJWTAuth } from "@/context/jwtAuth";
import { useAnalytics } from "@/app/project/[slug]/analytics/_components/useAnalytics";
import { HeaderControls } from "@/app/project/[slug]/analytics/_components/HeaderControls";
import { StatsGrid } from "@/app/project/[slug]/analytics/_components/StatsGrid";
import {
  AvgLenPerParticipantChart,
  AvgMsgsPerParticipantChart,
  EditTimePerParticipantChart,
  PostDictAvgEditsChart,
  PostDictAvgEditDurationChart,
  InterviewDurationPerParticipantChart,
} from "@/app/project/[slug]/analytics/_components/Charts";
import { EditIntensityTable } from "@/app/project/[slug]/analytics/_components/IntensityTable";
import { Card, CardContent } from "@/components/ui/card";

type PageProps = { params: { slug: string } };

export default function AnalyticsPage({ params }: PageProps) {
  const router = useRouter();
  const { fetchWithAuth } = useJWTAuth();

  const {
    topic,
    loading,
    busy,
    progress,
    limit,
    setLimit,
    dictationEnabledOnly,
    setDictationEnabledOnly,
    sessionsResp,
    rows,
    filteredRows,
    avgLenData,
    avgCountData,
    postDictAvgCountData,
    postDictAvgDurationData,
    interviewAvgDurationData,
    totals,
    compute,
    exportJson,
  } = useAnalytics({ slug: params.slug, fetchWithAuth });

  const canExport = filteredRows.length > 0 && !busy && !loading;

  return (
    <RequireAuthLevel>
      <div className="flex flex-col h-full bg-white">
        <HeaderControls
          topic={topic}
          slug={params.slug}
          totalSessions={sessionsResp?.total ?? 0}
          limit={limit}
          setLimit={setLimit}
          dictationEnabledOnly={dictationEnabledOnly}
          setDictationEnabledOnly={setDictationEnabledOnly}
          busy={busy}
          loading={loading}
          onRefresh={() => router.refresh()}
          onCompute={compute}
          progress={progress}
          onExport={exportJson}
          canExport={canExport}
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse h-48 bg-gray-100 rounded-2xl" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-gray-600">No data. Click &quot;Load analytics&quot;.</div>
          ) : (
            <>
              <StatsGrid filteredRows={filteredRows} totals={totals} />

              <Card className="rounded-2xl">
                <CardContent className="pt-6 h-80">
                  <AvgLenPerParticipantChart data={avgLenData} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="pt-6 h-80">
                  <InterviewDurationPerParticipantChart data={interviewAvgDurationData} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="pt-6 h-80">
                  <AvgMsgsPerParticipantChart data={avgCountData} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="pt-6 h-80">
                  <EditTimePerParticipantChart rows={rows} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="pt-6 h-80">
                  <PostDictAvgEditsChart data={postDictAvgCountData} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="pt-6 h-80">
                  <PostDictAvgEditDurationChart data={postDictAvgDurationData} />
                </CardContent>
              </Card>

              <EditIntensityTable rows={rows} />
            </>
          )}
        </div>
      </div>
    </RequireAuthLevel>
  );
}
