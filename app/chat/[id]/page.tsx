"use client";

import ChatInput from "@/components/ChatInput";
import ChatMessages from "@/components/ChatMessages";
import { ChatsContext } from "@/context/chats";
import { SettingsContext } from "@/context/settings";
import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { useMutation } from "@tanstack/react-query";
import { getSessionId, getCookieName, getCookieValue, setCookie } from "@/lib/session";
import { ChatPromptAnswer, Message } from "@/lib/types";
import getTranslation from "@/lib/translation";

export default function ChatPage() {
  const { id: PageId } = useParams<{ id: string }>();
  const cc = useContext(ChatsContext);
  const sc = useContext(SettingsContext);
  const router = useRouter();

  const lang = sc.language;

  const thischat = cc.chats.find((element) => element.chatid === PageId);

  const sentForChatRef = useRef<Set<string>>(new Set());

  const { mutate: sendAutoHello } = useMutation<ChatPromptAnswer, Error, Message>({
    mutationFn: async (userMsg) => {
      const cookieName = getCookieName(sc.projectSlug);
      let sessionId = getCookieValue(cookieName);
      if (!sessionId) {
        sessionId = getSessionId(sc.projectSlug);
        setCookie(cookieName, sessionId);
      }

      const payload = {
        topic: sc.topic,
        stimulus: thischat?.stimulus,
        messages: [...(thischat?.messages || []), userMsg],
        model: sc.model,
        projectSlug: sc.projectSlug,
        session_id: sessionId,
        chat_id: PageId,
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "unknown");
      return res.json() as Promise<ChatPromptAnswer>;
    },

    onMutate(userMsg) {
      cc.markAutoHelloSent(PageId);
    },

    onSuccess(parsed) {
      if (parsed.Next?.session_id) {
        const cookieName = getCookieName(sc.projectSlug);
        setCookie(cookieName, parsed.Next.session_id);
        localStorage.setItem(`interview_session_${sc.projectSlug}`, parsed.Next.session_id);
      }
      cc.addMessageToRawChat(PageId, parsed);

      const {
        Next: { NextQuestion, ThoughtProcess, EndOfInterview, CompletionReason, ValuesCount, ValuesMax },
      } = parsed;

      if (EndOfInterview) {
        cc.setChatfinished(PageId, true);

        const unfinishedChats = cc.chats.filter((chat) => !chat.finished && chat.chatid !== PageId);
        const hasMoreChats = unfinishedChats.length > 0;

        const nextText = hasMoreChats
          ? getTranslation("app_chat_id.ChatPage.next_has_more", lang)
          : getTranslation("app_chat_id.ChatPage.next_none_left", lang);

        if (CompletionReason === "VALUES_LIMIT_REACHED") {
          const ofMax =
            ValuesMax && typeof ValuesMax === "number"
              ? getTranslation("app_chat_id.ChatPage.of_max", lang).replace("{max}", String(ValuesMax))
              : "";
          const msg = getTranslation("app_chat_id.ChatPage.values_target_reached", lang)
            .replace("{count}", String(ValuesCount ?? "0"))
            .replace("{ofMax}", ofMax)
            .replace("{next}", nextText);

          cc.addMessageToChat(PageId, { id: nanoid(), isUserMessage: false, text: msg });
        } else {
          const msg = getTranslation("app_chat_id.ChatPage.chat_finished_msg", lang).replace("{next}", nextText);
          cc.addMessageToChat(PageId, { id: nanoid(), isUserMessage: false, text: msg });
        }
      } else {
        if (sc.interviewMode !== 3) {
          cc.addMessageToChat(PageId, { id: nanoid(), isUserMessage: false, text: NextQuestion });
        } else {
          cc.addMessageToChat(PageId, { id: nanoid(), isUserMessage: false, text: "" });
        }

        cc.setLastLLMTought(PageId, ThoughtProcess);
      }
    },

    onError(err) {
      const msg = getTranslation("app_chat_id.ChatPage.error_sending", lang).replace(
        "{error}",
        err.message || "Unknown Error"
      );
      cc.addMessageToChat(PageId, { id: nanoid(), isUserMessage: false, text: msg });
    },
  });

  useEffect(() => {
    if (!thischat) return;
    if (thischat.finished) return;

    if (sentForChatRef.current.has(PageId)) return;

    const alreadyStarted =
      thischat.autoHelloSent ||
      thischat.messages.some((m) => m.isUserMessage) ||
      thischat.rawMessages?.some((m: any) => m && typeof m === "object" && "userMessage" in m && m.userMessage === false);

    if (alreadyStarted) {
      sentForChatRef.current.add(PageId);
      return;
    }

    const helloMessage: Message = {
      id: nanoid(),
      isUserMessage: true,
      text: getTranslation("app_chat_id.ChatPage.auto_hello", lang),
    };

    sentForChatRef.current.add(PageId);
    cc.markAutoHelloSent(PageId);
    sendAutoHello(helloMessage);
  }, [PageId, thischat?.finished, thischat?.messages.length, thischat?.rawMessages.length]);

  useEffect(() => {
    const handleFinishedChatKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && thischat?.finished) {
        const unfinishedChats = cc.chats.filter((chat) => !chat.finished);
        if (unfinishedChats.length > 0) {
          const nextChat = unfinishedChats[0];
          router.push(`/chat/${nextChat.chatid}`);
        } else {
          router.push("/finish");
        }
      }
    };

    if (thischat?.finished) {
      document.addEventListener("keydown", handleFinishedChatKeyDown);
      return () => {
        document.removeEventListener("keydown", handleFinishedChatKeyDown);
      };
    }
  }, [thischat?.finished, cc.chats, router]);

  if (!thischat) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {getTranslation("app_chat_id.ChatPage.chat_not_found_title", lang)}
          </h2>
          <p className="text-gray-600">
            {getTranslation("app_chat_id.ChatPage.chat_not_found_body", lang)}
          </p>
        </div>
      </div>
    );
  }

  const currentIndex = cc.chats.findIndex((element) => element.chatid === PageId);
  const totalChats = cc.chats.length;

  const waitingForInitialResponse = thischat.messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="border-b border-gray-200 p-3 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{sc.topic}</h1>
            <span className="text-gray-600 font-medium">
              {getTranslation("app_chat_id.ChatPage.discussion_label", lang)} {thischat.stimulus}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-semibold text-blue-600">
              {getTranslation("app_chat_id.ChatPage.counter", lang)
                .replace("{current}", String(currentIndex + 1))
                .replace("{total}", String(totalChats))}
            </div>
            <div className="text-xs text-gray-500">{getTranslation("app_chat_id.ChatPage.topics_label", lang)}</div>
          </div>
        </div>
      </div>

      {sc.interviewMode !== 3 && (
        <div className="flex-1 overflow-hidden">
          <ChatMessages className="h-full" chat={thischat} />
        </div>
      )}

      <div className="border-t border-gray-200 sticky bottom-0 bg-white">
        <ChatInput
          chat={thischat}
          topic={sc.topic}
          model={sc.model}
          waitingForInitialResponse={waitingForInitialResponse}
        />
      </div>

      {waitingForInitialResponse && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4" />
          <p className="text-lg font-medium text-blue-600">
            {getTranslation("app_chat_id.ChatPage.connecting", lang)}
          </p>
        </div>
      )}
    </div>
  );
}
