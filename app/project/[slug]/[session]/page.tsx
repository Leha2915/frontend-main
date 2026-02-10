"use client";

import React, { useEffect, useState, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { Button } from "@/components/ui/button";
import { MessageSquare, GitBranch, Info, Download, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

import type { TreeStructure, ChatPromptAnswer } from "@/lib/types";
import { extractStimulusACVGroups, StimulusGroup } from "@/lib/acvExtract";

import { ChatsContext } from "@/context/chats";
import { ProgressContext } from "@/context/progress";
import { useInterviewSessionLoader } from "@/lib/interviewSessionLoader";
import { useJWTAuth } from "@/context/jwtAuth";

import SessionAudiosTab from "@/app/project/[slug]/[session]/_components/TabAudio";
import SessionEventsTab from "@/app/project/[slug]/[session]/_components/TabEvents";
import SessionChatTab from "@/app/project/[slug]/[session]/_components/TabChat";
import SessionInfoTab from "@/app/project/[slug]/[session]/_components/TabInfo";
import SessionTreeTab from "@/app/project/[slug]/[session]/_components/TabTree";

const api_url = process.env.NEXT_PUBLIC_API_URL;

type PageProps = { params: { slug: string; session: string } };

type ProjectInfo = {
  slug: string;
  topic: string;
  description: string;
  baseURL: string;
  model: string;
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

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u0000/g, "");
}

function roleToLabel(role: string | undefined, isUserMessage?: boolean): "USER" | "SYSTEM" {
  const r = (role || (isUserMessage ? "user" : "assistant")).toLowerCase();
  return r === "user" ? "USER" : "SYSTEM";
}

function emitMessageLines(lines: string[], index: number, role: "USER" | "SYSTEM", contentRaw: string) {
  const content = normalizeNewlines(String(contentRaw ?? ""));
  const prefix = `    [${index}] ${role}: `;
  const parts = content.split("\n");
  lines.push(`${prefix}${parts[0] ?? ""}`);
  const contIndent = " ".repeat(prefix.length);
  for (let i = 1; i < parts.length; i++) {
    lines.push(`${contIndent}${parts[i]}`);
  }
}

function formatChatsAsText(chats: any[] = []): string {
  const lines: string[] = [];
  lines.push(`Export generated at: ${new Date().toISOString()}`);

  for (const chat of chats ?? []) {
    lines.push("");
    const chatId = String(chat?.chatid ?? "");
    const stim = chat?.stimulus ?? "";
    const finishedRaw = chat?.finished;
    const isFinished = finishedRaw === true || String(finishedRaw).toLowerCase() === "true";
    const status = isFinished ? "finished" : "not finished";
    const headerLeft = chatId ? `--- Chat ${chatId} ` : `--- Chat `;
    lines.push(`${headerLeft} (${status}) : ${stim || "-"}`);
    const msgs = chat?.messages ?? [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const role = roleToLabel(m?.role, m?.isUserMessage);
      const text = m?.text ?? m?.content ?? "";
      emitMessageLines(lines, i + 1, role, text);
    }
  }

  return lines.join("\n");
}

export default function UserSessionPage({ params }: PageProps) {
  const router = useRouter();
  const { fetchWithAuth } = useJWTAuth();
  const cc = useContext(ChatsContext);
  const pc = useContext(ProgressContext);
  const { load, isLoading: loaderBusy } = useInterviewSessionLoader();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [view, setView] = useState<"info" | "chat" | "tree" | "events" | "audio">("info");
  const [order, setOrder] = useState<string[]>([]);
  const [finishedSet, setFinishedSet] = useState<Set<string>>(new Set());
  const [tree, setTree] = useState<TreeStructure | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [projRes, sessRes] = await Promise.all([
          fetchWithAuth?.(`${api_url}/projects/${params.slug}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }),
          fetchWithAuth?.(`${api_url}/project/${params.slug}/session/${params.session}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }),
        ]);

        if (projRes && projRes.ok) setProject(await projRes.json());
        if (sessRes && sessRes.ok) setSessionMeta(await sessRes.json());
      } catch (e) {
        console.warn("Failed to fetch project/session meta", e);
      }
    })();
  }, [params.slug, params.session, fetchWithAuth]);

  useEffect(() => {
    if (bootstrapped) return;

    (async () => {
      try {
        const { order, finished, tree } = await load(params.session, params.slug, {
          onEmptyOrder: () => router.replace(`/project/${params.slug}`),
        });
        setOrder(order ?? []);
        setFinishedSet(new Set((finished ?? []).map(String)));
        setTree(tree ?? null);
        if (tree && (order?.length ?? 0) > 0) {
          const envelope: ChatPromptAnswer = {
            Next: {
              NextQuestion: "",
              AskingIntervieweeFor: "",
              ThoughtProcess: "",
              EndOfInterview: false,
              session_id: params.session,
            },
            Tree: tree,
          };
          order.forEach((_, idx) => {
            const pageId = String(idx + 1);
            cc.addMessageToRawChat?.(pageId, envelope);
          });
        }
        pc.setSubmittedRanking(true);
        setBootstrapped(true);
      } catch (e) {
        console.error(e);
        alert("Failed to load session data");
      }
    })();
  }, [bootstrapped, load, params.session, params.slug, router, cc, pc]);

  const showSkeleton = loaderBusy || !bootstrapped;
  const isChat = view === "chat";
  const isTree = view === "tree";
  const isInfo = view === "info";
  const isEvents = view === "events";
  const isAudio = view === "audio";

  const finishedCount = finishedSet.size;
  const totalCount = order.length;
  const progressPct = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0;

  const acv = useMemo(() => {
    if (!tree) return { attributes: 0, consequences: 0, values: 0, total: 0 };

    const getChildren = (n: any) => n?.children ?? n?.nodes ?? [];
    the_type: {}
    const getType = (n: any) =>
      String(n?.type ?? n?.node_type ?? n?.label ?? "").toUpperCase();

    let attributes = 0, consequences = 0, values = 0, total = 0;

    const seed = Array.isArray((tree as any).nodes)
      ? (tree as any).nodes
      : Array.isArray((tree as any).children)
      ? (tree as any).children
      : [tree];

    const stack = [...seed];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;

      const t = getType(n);
      if (
        t.startsWith("TOPIC") || t.startsWith("IDEA") || t.startsWith("STIMULUS") ||
        t.startsWith("ATTR")  || t.startsWith("CONS") || t.startsWith("VAL")
      )
        total += 1;
      if (t.startsWith("ATTR")) attributes += 1;
      else if (t.startsWith("CONS")) consequences += 1;
      else if (t.startsWith("VAL")) values += 1;
      const kids = getChildren(n);
      if (kids?.length) stack.push(...kids);
    }

    const chains: StimulusGroup[] = extractStimulusACVGroups(tree, {
      requireCompletedFlag: false,
      includeEmptyStimuli: false,
      includeIncompleteChains: true,
      mergeConsequencePath: true,
      checkSuperSet: true,
    });

    console.log(chains);
    return { attributes, consequences, values, total };
  }, [tree]);

  return (
    <RequireAuthLevel>
      <div className="flex flex-col h-full bg-white">
        <div className="border-b border-gray-200 p-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative">
              <div className="inline-flex items-center rounded-xl p-1 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 shadow-inner">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={isInfo}
                  onClick={() => setView("info")}
                  className={`relative flex items-center gap-2 px-4 ${
                    isInfo
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-purple-500/40"
                      : "text-gray-600 hover:text-gray-900"
                  } rounded-lg transition-all`}
                >
                  <Info className="h-4 w-4" />
                  <span>Info</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={isChat}
                  onClick={() => setView("chat")}
                  className={`relative flex items-center gap-2 px-4 ${
                    isChat
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-blue-500/40"
                      : "text-gray-600 hover:text-gray-900"
                  } rounded-lg transition-all`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={isEvents}
                  onClick={() => setView("events")}
                  className={`relative flex items-center gap-2 px-4 ${
                    isEvents
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-fuchsia-500/40"
                      : "text-gray-600 hover:text-gray-900"
                  } rounded-lg transition-all`}
                >
                  <ListTree className="h-4 w-4" />
                  <span>Events</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={isAudio}
                  onClick={() => setView("audio")}
                  className={`relative flex items-center gap-2 px-4 ${
                    isAudio
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-rose-500/40"
                      : "text-gray-600 hover:text-gray-900"
                  } rounded-lg transition-all`}
                >
                  <Download className="h-4 w-4" />
                  <span>Audio</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={isTree}
                  onClick={() => setView("tree")}
                  className={`relative flex items-center gap-2 px-4 ${
                    isTree
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-emerald-500/40"
                      : "text-gray-600 hover:text-gray-900"
                  } rounded-lg transition-all`}
                >
                  <GitBranch className="h-4 w-4" />
                  <span>Tree</span>
                </Button>
              </div>

              <div className="pointer-events-none relative mt-1 h-0.5">
                <div
                  className={cn(
                    "absolute left-0 h-0.5 transition-transform duration-300 ease-out",
                    "w-1/5",
                    isInfo ? "bg-purple-500"
                      : isChat ? "bg-blue-500"
                      : isEvents ? "bg-fuchsia-500"
                      : isAudio ? "bg-rose-500"
                      : "bg-emerald-500"
                  )}
                  style={{
                    transform:
                      isInfo ? "translateX(0%)"
                      : isChat ? "translateX(100%)"
                      : isEvents ? "translateX(200%)"
                      : isAudio ? "translateX(300%)"
                      : "translateX(400%)",
                  }}
                />
              </div>
            </div>

            {isChat && (
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  const txt = formatChatsAsText((cc as any)?.chats ?? []);
                  const fname = `session_${params.session}_${params.slug}.txt`;
                  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = fname;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                disabled={!(cc as any)?.chats?.length}
                title={(cc as any)?.chats?.length ? "Export chats as text file" : "No chats"}
              >
                <Download className="h-4 w-4" />
                Download chats (.txt)
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showSkeleton ? (
            <div className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-40 rounded-xl bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          ) : isTree ? (
            <SessionTreeTab
              sessionId={params.session}
              projectSlug={params.slug}
              hasTree={!!tree}
            />
          ) : isInfo ? (
            <SessionInfoTab
              slug={params.slug}
              sessionId={params.session}
              project={project}
              sessionMeta={sessionMeta}
              finishedCount={finishedCount}
              totalCount={totalCount}
              progressPct={progressPct}
              acv={tree ? acv : null}
            />
          ) : isEvents ? (
            <div className="space-y-4 ring-1 ring-fuchsia-200 rounded-2xl p-4">
              <SessionEventsTab
                sessionId={params.session}
                fetchWithAuth={fetchWithAuth!}
              />
            </div>
          ) : isAudio ? (
            <div className="space-y-4 ring-1 ring-rose-200 rounded-2xl p-4">
              <SessionAudiosTab
                projectSlug={params.slug}
                sessionId={params.session}
                fetchWithAuth={fetchWithAuth!}
              />
            </div>
          ) : (
            <SessionChatTab
              sessionId={params.session}
              order={order}
              finishedSet={finishedSet}
            />
          )}
        </div>
      </div>
    </RequireAuthLevel>
  );
}
