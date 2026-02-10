"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PauseIcon, PlayIcon, XCircle, RefreshCw } from "lucide-react";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { useInterviewSessionLoader } from "@/lib/interviewSessionLoader";
import { useContext, useEffect, useState } from "react";
import { ChatsContext } from "@/context/chats";

import getTranslation from "@/lib/translation";
import { SettingsContext } from "@/context/settings";


export default function InterviewPausedPage() {

  const sc = useContext(SettingsContext)
  const lang = sc.language;

  const instantResume = typeof window !== 'undefined'
    ? localStorage.getItem('instant-resume')
    : null;

  const router = useRouter();
  const { isLoading, loadFromLocalStorage, clearSession, logout } = useInterviewSessionLoader();
  const cc = useContext(ChatsContext);
  const [bootstrapped, setBootstrapped] = useState(false);

  const handleResume = () => router.push("/chat");

  const handleEnd = () => {
    const slug = localStorage.getItem("project") ?? "";
    clearSession(slug);
    logout();
    cc.resetChats();
    window.location.href = "/";
  };

  const handleRestart = () => {
    const slug = localStorage.getItem("project") ?? "";
    clearSession(slug);
    cc.resetChats();
    window.location.href = `/project/${slug}`;
  };

  useEffect(() => {
    if (bootstrapped) return;

    (async () => {
      await loadFromLocalStorage({
        onEmptyOrder: handleRestart,
      });
      setBootstrapped(true);
    })();
  }, [bootstrapped, loadFromLocalStorage]);

  
  useEffect(() => {
    if (instantResume) {
      localStorage.removeItem('instant-resume')
      router.push(instantResume)
    }
  });

  return (
    <RequireAuthLevel allowGuest>
      {!instantResume &&
      <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
        <PauseIcon className="w-16 h-16 text-yellow-400 mb-2" />
        <h1 className="text-3xl font-bold">{getTranslation("app_pause.InterviewPausedPage.title", lang)}</h1>
        <p className="text-lg text-gray-600 max-w-md">
          {getTranslation("app_pause.InterviewPausedPage.desc", lang)}
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mt-4">
          <Button
            onClick={handleResume}
            disabled={isLoading}
            className="flex items-center gap-2 text-lg px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
          >
            <PlayIcon className="w-5 h-5 text-emerald-600" />
            {isLoading ? getTranslation("app_pause.InterviewPausedPage.loading", lang) : getTranslation("app_pause.InterviewPausedPage.resume", lang)}
          </Button>

          <Button
            onClick={handleRestart}
            className="flex items-center gap-2 text-lg px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
          >
            <RefreshCw className="w-5 h-5 text-amber-500" />
            {getTranslation("app_pause.InterviewPausedPage.restart", lang)}
          </Button>

          <Button
            onClick={handleEnd}
            className="flex items-center gap-2 text-lg px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
          >
            <XCircle className="w-5 h-5 text-rose-600" />
            {getTranslation("app_pause.InterviewPausedPage.end", lang)}
          </Button>
        </div>
      </div>
      }
    </RequireAuthLevel>
    
  );
}
