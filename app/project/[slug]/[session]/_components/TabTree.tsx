"use client";

import React, { useEffect } from "react";
import Analytics from "@/app/analytics/page";

type Props = {
  sessionId: string;
  projectSlug: string;
  hasTree: boolean;
};

export default function SessionTreeTab({ sessionId, projectSlug, hasTree }: Props) {
  useEffect(() => {
    localStorage.setItem("project", projectSlug);
    localStorage.setItem(`interview_session_${projectSlug}`, sessionId);
  }, [sessionId, projectSlug]);

  if (!hasTree) {
    return <div className="text-gray-600">No tree available</div>;
  }

  return (
    <div className="rounded-2xl border h-[81vh] overflow-hidden ring-1 ring-emerald-200">
      <Analytics />
    </div>
  );
}
