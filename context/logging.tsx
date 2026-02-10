"use client"

import React, { createContext, useContext, useMemo } from "react"
import { LoggingClient } from "@/lib/logging/client"
import { LogEvent, LoggingContext } from "@/lib/logging/types"
import { SettingsContext } from "@/context/settings"
import { ProgressContext } from "@/context/progress"

type LoggingAPI = {
  client: LoggingClient
  getCtx: () => LoggingContext
  log: (e: Omit<LogEvent, "id" | "ts">) => void
}

const LoggingCtx = createContext<LoggingAPI | null>(null)

export function LoggingProvider({ children }: { children: React.ReactNode }) {
  const sc = useContext(SettingsContext)
  const pc = useContext(ProgressContext)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""
  const endpoint = `${apiUrl}/logs`

  const client = useMemo(() => new LoggingClient({ endpoint }), [endpoint])

  const getCtx = (): LoggingContext => {
    const slug = sc.projectSlug || localStorage.getItem("project") || undefined
    const sess = (slug && localStorage.getItem(`interview_session_${slug}`)) || ""
    return {
      sessionId: sess,
      participantId: pc.userId || undefined,
      projectSlug: slug
    }
  }

  const value: LoggingAPI = {
    client,
    getCtx,
    log: (ePartial) => client.log(client.createEvent(ePartial)),
  }

  return <LoggingCtx.Provider value={value}>{children}</LoggingCtx.Provider>
}

export function useLogging(dummy: boolean = false): LoggingAPI {
  const ctx = useContext(LoggingCtx)

  if (!ctx) throw new Error("useLogging must be used within LoggingProvider")

  if (dummy) {
    return {
      client: null,
      getCtx: () => ({
        sessionId: "dummy-session",
        participantId: "dummy-user",
        projectSlug: "dummy-project"
      }),
      log: (e) => {
      },
    }
  }

  return ctx
}
