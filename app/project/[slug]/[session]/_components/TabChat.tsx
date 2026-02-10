"use client";

import React from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatsContext } from "@/context/chats";

type Props = {
  sessionId: string;
  order: string[];
  finishedSet: Set<string>;
};

export default function SessionChatTab({ sessionId, order, finishedSet }: Props) {
  const cc = useContext(ChatsContext);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    order.forEach((_, idx) => (next[`${sessionId}-${idx}`] = false));
    setOpen(next);
  }, [sessionId, order]);

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const getChatMessagesByIndex = (idx: number) => {
    const pageId = String(idx + 1);
    const chat =
      (cc as any)?.chats?.find?.((c: any) => c?.chatid === pageId) ??
      (cc as any)?.getChat?.(pageId) ??
      null;

    return chat?.messages ?? chat?.viewMessages ?? chat?.msgs ?? [];
  };

  const hasAnyChats = useMemo(() => {
    return Array.isArray((cc as any)?.chats) && (cc as any).chats.length > 0;
  }, [cc]);

  if (order.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <p className="text-gray-600">No interviews found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 ring-1 ring-blue-200 rounded-2xl p-0.5">
      {order.map((stimulus, idx) => {
        const chatHistory = getChatMessagesByIndex(idx);
        const isFinished = finishedSet.has(String(stimulus));
        const key = `${sessionId}-${idx}`;
        const isOpen = !!open[key];

        return (
          <Card
            key={key}
            className={cn(
              "rounded-2xl border shadow-sm hover:shadow-md transition",
              isFinished ? "border-emerald-200" : "border-amber-200"
            )}
          >
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base leading-snug line-clamp-2">
                  <span className="text-gray-900">Stimulus:</span>{" "}
                  <span className="font-semibold">{stimulus}</span>
                </CardTitle>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={isFinished ? "default" : "secondary"}
                    className={cn(
                      "px-2.5 py-1 text-xs",
                      isFinished && "bg-emerald-600 hover:bg-emerald-600"
                    )}
                    title={isFinished ? "Completed" : "Running"}
                  >
                    {isFinished ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    <span className="ml-1">{isFinished ? "Finished" : "Running"}</span>
                  </Badge>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-700"
                    onClick={() => toggle(key)}
                    disabled={!hasAnyChats}
                    title={hasAnyChats ? (isOpen ? "Hide" : "Show") : "No messages yet"}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {isOpen ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="pt-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">◀ System</span>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">User ▶</span>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {!chatHistory || chatHistory.length === 0 ? (
                    <div className="text-gray-600 text-sm">No messages</div>
                  ) : (
                    chatHistory.map((msg: any, i: number) => {
                      const isUser = msg?.isUserMessage ?? msg?.role === "user";
                      const text = msg?.text ?? msg?.content ?? "";
                      return (
                        <div key={`${sessionId}-${idx}-${i}`} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                              isUser
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-gray-50 text-gray-900 border border-gray-200"
                            )}
                          >
                            {text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
