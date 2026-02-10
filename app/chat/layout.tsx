"use client";

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusDot } from '@/components/ui/statusDot';
import { ChatsContext } from '@/context/chats';
import { SettingsContext } from '@/context/settings';
import { cn } from '@/lib/utils';
import { ChevronRightIcon, Circle, MessageSquare, Clock, Users, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useContext, useEffect, useState, useCallback } from 'react';
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { useJWTAuth } from '@/context/jwtAuth';
import dynamic from 'next/dynamic';
import { InterviewHealthContext } from "@/context/health";
import { useInterviewTimer, InterviewTimerProvider } from '@/components/hooks/useTimeRouter';
import getTranslation from "@/lib/translation";

const DEV_ALLOW_COUNTDOWN_VIEW = false;

function AnalyticsLoading() {
  const sc = useContext(SettingsContext);
  const lang = sc.language;
  return (
    <div className="w-full h-full flex items-center justify-center p-8 text-sm text-gray-500">
      {getTranslation("app_chat.ChatLayout.loading_tree", lang)}
    </div>
  );
}

const AnalyticsOverlay = dynamic(() => import('@/app/analytics/page'), {
  ssr: false,
  loading: () => <AnalyticsLoading />
});

export function RemainingBadge() {
  const sc = useContext(SettingsContext);
  const lang = sc.language;
  const { remaining, expired } = useInterviewTimer();

  if (sc.timeLimit < 0) {
    return (
      <span className="px-2 py-1 rounded text-sm border border-gray-300 text-gray-700">
        {getTranslation("app_chat.ChatLayout.badge_no_limit", lang)}
      </span>
    );
  }

  const m = Math.floor(remaining / 60);
  const s = String(remaining % 60).padStart(2, '0');

  return (
    <span className={`px-2 py-1 rounded text-sm border ${expired ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-700'}`}>
      {expired
        ? getTranslation("app_chat.ChatLayout.badge_time_up", lang)
        : getTranslation("app_chat.ChatLayout.badge_remaining", lang)
            .replace("{m}", String(m))
            .replace("{s}", s)
      }
    </span>
  );
}

export default function ChatPagesLayout({ children }: { children: React.ReactNode }) {
  const { isGuest, enterAsGuest } = useJWTAuth();
  const sc = useContext(SettingsContext);
  const lang = sc.language;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [storageKey, setStorageKey] = useState<string>('interview-global-timer');

  useEffect(() => {
    const project_slug = localStorage.getItem("project") ?? "";
    if (project_slug) {
      const id = localStorage.getItem(`interview_session_${project_slug}`);
      setSessionId(id);
      setStorageKey(`interview-global-timer-${id ?? 'na'}`);
      setKeyReady(true);
    }
  }, [sc.projectSlug]);

  useEffect(() => {
    const project_slug = localStorage.getItem("project") ?? "";
    const storedId = localStorage.getItem(`interview_session_${project_slug}`);
    if (!storedId) return;
    if (!isGuest) {
      enterAsGuest(project_slug);
      localStorage.setItem('instant-resume', '/chat');
      window.location.href = "/pause";
    }
  }, [isGuest, enterAsGuest]);

  return (
    <RequireAuthLevel allowGuest>
      {keyReady ? (
        <InterviewTimerProvider
          storageKey={storageKey}
          timeoutHref="/finish"
          disabled={sc.timeLimit < 0}
        >
          <InnerChatLayout sessionId={sessionId}>
            {children}
          </InnerChatLayout>
        </InterviewTimerProvider>
      ) : null}
    </RequireAuthLevel>
  );
}

function InnerChatLayout({ children, sessionId }: { children: React.ReactNode; sessionId: string | null }) {
  const router = useRouter();
  const { id } = useParams();
  const sc = useContext(SettingsContext);
  const lang = sc.language;
  const cc = useContext(ChatsContext);
  const hc = useContext(InterviewHealthContext);

  const AllChatsFinished = cc.chats.every((element) => element.finished === true);

  const [showAnalytics, setShowAnalytics] = useState(false);
  const viewTree = useCallback(() => setShowAnalytics(true), []);
  const closeOverlay = useCallback(() => setShowAnalytics(false), []);

  const { expired, start, reset } = useInterviewTimer();

  useEffect(() => { start(); }, [start]);

  useEffect(() => {
    if (!showAnalytics) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeOverlay(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showAnalytics, closeOverlay]);

  return (
    <>
      {sessionId && (
        <div className="absolute top-4 right-6 text-xs text-gray-500 bg-gray-100  px-2 py-1 rounded-md shadow-sm z-50 flex items-center gap-2">
          {DEV_ALLOW_COUNTDOWN_VIEW && <RemainingBadge/>}
          <StatusDot title={hc.tooltip} onClick={() => console.log('show')} />
          <span>{getTranslation("app_chat.ChatLayout.session_id_label", lang)}</span>
          <span className="font-mono">{sessionId}</span>
        </div>
      )}

      <div className="flex h-full bg-gray-50">
        <div className="w-80 lg:w-80 md:w-72 sm:w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 leading-6">
                  {getTranslation("app_chat.ChatLayout.sidebar_title", lang)}
                </h1>
                <p className="text-sm text-gray-600 mt-1 leading-4">
                  {getTranslation("app_chat.ChatLayout.sidebar_subtitle", lang)
                    .replace("{count}", String(cc.chats.length))}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cc.chats.map((chat, index) => {
              const isActive = id == chat.chatid;
              const isCompleted = chat.finished;
              const hasUserMessages = chat.messages.length !== 0;
              const isNotStarted = !hasUserMessages && !isCompleted;

              return (
                <button key={index} className="w-full text-left" onClick={() => router.push('/chat/' + (chat.chatid))}>
                  <div
                    className={cn(
                      'p-4 rounded-lg border transition-all duration-200 hover:shadow-sm',
                      {
                        'bg-blue-50 border-blue-200 shadow-sm': isActive,
                        'bg-green-50 border-green-200': isCompleted && !isActive,
                        'bg-orange-50 border-orange-200': isNotStarted && !isActive,
                        'bg-white border-gray-200 hover:border-gray-300': !isActive && !isCompleted && !isNotStarted,
                      }
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <h3 className="font-medium text-gray-900 truncate leading-6">
                            {chat.stimulus}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs leading-4">
                          {isCompleted ? (
                            <>
                              <Clock className="h-3 w-3 text-green-600" />
                              <span className="text-green-600 font-medium">
                                {getTranslation("app_chat.ChatLayout.status_completed", lang)}
                              </span>
                            </>
                          ) : isNotStarted ? (
                            <>
                              <Circle className="h-3 w-3 text-orange-600" />
                              <span className="text-orange-600 font-medium">
                                {getTranslation("app_chat.ChatLayout.status_not_started", lang)}
                              </span>
                            </>
                          ) : (
                            <>
                              <Users className="h-3 w-3 text-blue-600" />
                              <span className="text-blue-600 font-medium">
                                {getTranslation("app_chat.ChatLayout.status_in_progress", lang)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">

              {sc.treeEnabled &&
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1">
                    <Button variant="secondary" className="w-full" onClick={viewTree}>
                      {getTranslation("app_chat.ChatLayout.show_tree_btn", lang)}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  {getTranslation("app_chat.ChatLayout.show_tree_tt", lang)}
                </TooltipContent>
              </Tooltip>
              }

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1">
                    <Button
                      variant="default"
                      className="w-full"
                      disabled={!AllChatsFinished}
                      onClick={() => {
                        reset();
                        router.push('/finish');
                      }}
                    >
                      {getTranslation("app_chat.ChatLayout.finish_btn", lang)}
                      <ChevronRightIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  {AllChatsFinished
                    ? getTranslation("app_chat.ChatLayout.finish_tt_ready", lang)
                    : getTranslation("app_chat.ChatLayout.finish_tt_blocked", lang)}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>

      {showAnalytics && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={closeOverlay} />
          <div className="relative bg-white w-[96vw] h-[92vh] md:w-[92vw] md:h-[88vh] rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur">
              <div className="font-medium text-gray-900">
                {getTranslation("app_chat.ChatLayout.overlay_title", lang)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeOverlay}
                  aria-label={getTranslation("app_chat.ChatLayout.overlay_close_aria", lang)}
                >
                  <X className="h-4 w-4 mr-1" />
                  {getTranslation("app_chat.ChatLayout.overlay_close", lang)}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <AnalyticsOverlay />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
