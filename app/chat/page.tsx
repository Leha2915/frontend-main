'use client'

import RequireAuthLevel from "@/components/RequireAuthLevel";
import { MessageCircle } from "lucide-react";
import { useContext, useEffect } from "react";
import { ChatsContext } from "@/context/chats";
import { useRouter } from "next/navigation";
import { SettingsContext } from "@/context/settings";
import getTranslation from "@/lib/translation";


export default function Dashboard() {
  const { chats } = useContext(ChatsContext);
  const { timeLimit, language } = useContext(SettingsContext);
  const lang = language;
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const firstChat = chats.length > 0 ? chats[0] : null;
        if (firstChat) {
          router.push(`/chat/${firstChat.chatid}`);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [chats, router]);

  return (
    <RequireAuthLevel allowGuest>
      <div className="flex flex-col items-center justify-center h-full bg-white p-8">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-blue-600" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">
              {getTranslation("app_chat.Dashboard.welcome_title", lang)}
            </h2>

            <p className="text-gray-600 leading-relaxed">
              {getTranslation("app_chat.Dashboard.p1_before", lang)}{" "}
              <span className="font-mono text-xs bg-orange-50 border-orange-200 text-orange-700 px-2 py-1 rounded border">
                {getTranslation("app_chat.Dashboard.topic_token", lang)}
              </span>{" "}
              {getTranslation("app_chat.Dashboard.p1_after", lang)}{" "}
              {getTranslation("app_chat.Dashboard.p2_before", lang)}{" "}
              <span className="font-mono text-xs bg-white px-2 py-1 rounded border">Enter</span>{" "}
              {getTranslation("app_chat.Dashboard.p2_after", lang)}
            </p>
          </div>
        </div>
      </div>
    </RequireAuthLevel>
  )
}
