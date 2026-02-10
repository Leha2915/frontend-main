import { LogEvent } from "./types"

const U = () => Math.random().toString(36).slice(2)

export interface LoggingClientOptions {
  endpoint: string
  flushIntervalMs?: number
  maxBuffer?: number
  maxAgeMs?: number
}

export class LoggingClient {
  private buffer: LogEvent[] = []
  private timer: number | null = null
  private lastFlush = Date.now()
  private opts: Required<LoggingClientOptions>

  constructor(opts: LoggingClientOptions) {
    this.opts = {
      flushIntervalMs: 5_000,
      maxBuffer: 100,
      maxAgeMs: 30_000,
      ...opts,
    }
    this.restoreFromStorage()
    this.start()
    this.setupUnloadHooks()
  }

  createEvent(partial: Omit<LogEvent, "id" | "ts">): LogEvent {
    return { id: U(), ts: Date.now(), ...partial }
  }

  log(e: LogEvent) {
    this.buffer.push(e)
    this.persistToStorage()
    const tooBig = this.buffer.length >= this.opts.maxBuffer
    const tooOld = Date.now() - this.lastFlush >= this.opts.maxAgeMs
    if (tooBig || tooOld) this.flush().catch(() => {})
  }

  start() {
    if (this.timer || typeof window === "undefined") return
    this.timer = window.setInterval(() => {
      if (this.buffer.length) this.flush().catch(() => {})
    }, this.opts.flushIntervalMs)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async flush() {
    if (!this.buffer.length) return
    const payload = this.buffer.slice()

    console.log(payload)
    try {
      const res = await fetch(this.opts.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ logs: payload }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this.buffer = []
      this.lastFlush = Date.now()
      this.persistToStorage()
    } catch {
    }
  }

  sendBeacon() {
    if (!this.buffer.length) return
    try {
      const blob = new Blob([JSON.stringify({ logs: this.buffer })], { type: "application/json" })
      navigator.sendBeacon(this.opts.endpoint, blob)
      this.buffer = []
      this.persistToStorage()
    } catch {}
  }

  private setupUnloadHooks() {
    if (typeof window === "undefined" || typeof document === "undefined") return
    const onHide = () => this.sendBeacon()
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide()
    })
    window.addEventListener("pagehide", onHide)
    window.addEventListener("beforeunload", onHide)
  }

  private persistToStorage() {
    if (typeof localStorage === "undefined") return
    try {
      localStorage.setItem("__logging_buffer__", JSON.stringify(this.buffer))
    } catch {}
  }

  private restoreFromStorage() {
    if (typeof localStorage === "undefined") return
    try {
      const raw = localStorage.getItem("__logging_buffer__")
      if (!raw) return
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) this.buffer = arr
    } catch {}
  }
}
