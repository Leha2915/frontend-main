import { Chat, ChatPromptAnswer, Message } from "@/lib/types"
import { createContext, useState } from "react"

export const ChatsContext = createContext<{
  chats: Chat[]
  isChatExisting: (PageId: string) => boolean
  addMessageToChat: (chatid: string, message: Message) => void
  addMessageToRawChat: (chatid: string, message: Message | ChatPromptAnswer) => void
  setChatfinished: (chatid: string, isFinished: boolean) => void
  setLastLLMTought: (chatid: string, lastLLMTought: string) => void
  initChat: (
    chatid: string,
    stimulus: string,
    messages: Message[],
    finished: boolean,
    rawMessages: (Message | ChatPromptAnswer)[],
    lastLLMTought: string,
    autoHelloSent: boolean
  ) => void
  resetChats: () => void
  markAutoHelloSent: (chatid: string) => void
}>({
  chats: [],
  isChatExisting: () => false,
  addMessageToChat: () => {},
  addMessageToRawChat: () => {},
  setChatfinished: () => {},
  setLastLLMTought: () => {},
  initChat: () => {},
  resetChats: () => {},
  markAutoHelloSent: () => {},
})

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([])

  const isChatExisting = (PageId: string) => chats.some((c) => c.chatid === PageId)

  const initChat = (
    chatid: string,
    stimulus: string,
    messages: Message[],
    finished: boolean,
    rawMessages: (Message | ChatPromptAnswer)[],
    lastLLMTought: string,
    autoHelloSent: boolean = false
  ) => {
    setChats((prev) => {
      if (prev.some((c) => c.chatid === chatid)) return prev
      return [
        ...prev,
        {
          chatid,
          stimulus,
          messages,
          finished,
          rawMessages,
          lastLLMTought,
          autoHelloSent,
        },
      ]
    })
  }

  const resetChats = () => setChats([])

  const addMessageToChat = (chatid: string, message: Message) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatid === chatid
          ? { ...chat, messages: [...chat.messages, message] }
          : chat
      )
    )
  }

  const markAutoHelloSent = (chatid: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatid === chatid ? { ...chat, autoHelloSent: true } : chat
      )
    )
  }

  const addMessageToRawChat = (chatid: string, message: Message | ChatPromptAnswer) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatid === chatid
          ? { ...chat, rawMessages: [...(chat.rawMessages ?? []), message] }
          : chat
      )
    )
  }

  const setChatfinished = (chatid: string, isFinished: boolean) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatid === chatid ? { ...chat, finished: isFinished } : chat
      )
    )
  }

  const setLastLLMTought = (chatid: string, thought: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatid === chatid ? { ...chat, lastLLMTought: thought } : chat
      )
    )
  }

  return (
    <ChatsContext.Provider
      value={{
        chats,
        isChatExisting,
        addMessageToChat,
        addMessageToRawChat,
        setChatfinished,
        setLastLLMTought,
        initChat,
        resetChats,
        markAutoHelloSent,
      }}
    >
      {children}
    </ChatsContext.Provider>
  )
}
