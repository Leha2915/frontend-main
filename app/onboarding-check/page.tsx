"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useContext } from "react";
import { CheckCircle, MessageSquare } from "lucide-react";
import { useJWTAuth } from "@/context/jwtAuth";
import { SettingsContext } from "@/context/settings";

export default function FirstTimeGate() {
  const router = useRouter();


  useEffect(() => {
    // const hasOnboarded = localStorage.getItem("hasOnboarded");
    // if (hasOnboarded === "true") router.replace("/chat");
  }, [router]);

  const goOnboarding = () => {
    router.push("/onboarding");
  };

  const goChat = () => {
    router.push("/chat");
  };

  const [sessionId, setSessionId] = useState<string | null>(null);
  const { isGuest, enterAsGuest } = useJWTAuth();
  const sc = useContext(SettingsContext);

  useEffect(() => {
    const project_slug = localStorage.getItem("project") ?? "";
    if (typeof window !== "undefined" && project_slug) {
      const id = localStorage.getItem(`interview_session_${project_slug}`);
      setSessionId(id);
    }
  }, [sc.projectSlug]);

  useEffect(() => {
    const project_slug = localStorage.getItem("project") ?? "";
    const storedId = localStorage.getItem(`interview_session_${project_slug}`);
    if (!storedId) return;
    if (!isGuest) {
      enterAsGuest(project_slug);
      localStorage.setItem('instant-resume', '/onboarding-check');
      window.location.href = "/pause";
    }
  }, [isGuest, enterAsGuest]);


  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
          Is this your first time using <span className="text-slate-700">LadderChat</span>?
        </h1>
        <p className="mt-3 text-slate-600">
          
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={goOnboarding}
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors p-5 text-left"
          >
            <div>
              <div className="text-lg font-medium text-slate-900">Yes</div>
              <div className="mt-1 text-sm text-slate-600">To onboarding</div>
            </div>
            <CheckCircle className="size-6 shrink-0 opacity-80 group-hover:opacity-100" aria-hidden />
          </button>

          <button
            onClick={goChat}
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors p-5 text-left"
          >
            <div>
              <div className="text-lg font-medium text-slate-900">No</div>
              <div className="mt-1 text-sm text-slate-600">Directly to chat</div>
            </div>
            <MessageSquare className="size-6 shrink-0 opacity-80 group-hover:opacity-100" aria-hidden />
          </button>
        </div>

      </div>
    </main>
  );
}
