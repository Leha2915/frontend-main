'use client'

let USE_BROWSER_TTS = false
const AVM_TTS_LANG  = 'en-EN'
const AVM_TTS_RATE  = 1
const AVM_TTS_PITCH = 1

const DEFAULT_LANGUAGE_CODE = 'en'

function toLanguageCode(lang?: string | null): string {
  if (!lang) return DEFAULT_LANGUAGE_CODE
  return String(lang).toLowerCase().split('-')[0] || DEFAULT_LANGUAGE_CODE
}

function toBrowserLangTag(lang?: string | null): string {
  const code = toLanguageCode(lang)
  const map: Record<string, string> = {
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
  }
  return map[code] || code
}

let elevenAudio: HTMLAudioElement | null = null
function getAudio(): HTMLAudioElement {
  if (!elevenAudio) {
    elevenAudio = new Audio()
    elevenAudio.preload = 'auto'
  }
  return elevenAudio
}

const ttsSessionIdRef = { current: 0 }
const isCurrent = (id: number) => id === ttsSessionIdRef.current

const state = {
  currentUtter: null as SpeechSynthesisUtterance | null,
  mse: null as MediaSource | null,
  sb: null as SourceBuffer | null,
  reader: null as ReadableStreamDefaultReader<Uint8Array> | null,
  lastUrl: null as string | null,
  aborter: null as AbortController | null,
  ac: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  sourceNode: null as MediaElementAudioSourceNode | null,
  raf: null as number | null,
  onLevel: null as ((rms: number) => void) | null,
  browserLevelTimer: null as number | null,
}


function ensureAnalyser(onLevel?: (rms: number) => void) {
  state.onLevel = onLevel ?? null
  const audio = getAudio()

  if (!state.ac) {
    state.ac = new (window.AudioContext || (window as any).webkitAudioContext)()
  }

  if (!state.sourceNode) {
    state.sourceNode = state.ac.createMediaElementSource(audio)
  }

  if (!state.analyser) {
    state.analyser = state.ac.createAnalyser()
    state.analyser.fftSize = 512
    state.sourceNode.connect(state.analyser)
    state.analyser.connect(state.ac.destination)
  }

  const data = new Uint8Array(state.analyser.frequencyBinCount)
  const tick = () => {
    if (!state.analyser) return
    state.analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / data.length)
    state.onLevel?.(rms)
    state.raf = requestAnimationFrame(tick)
  }

  const startRaf = () => {
    if (state.raf) cancelAnimationFrame(state.raf)
    state.raf = requestAnimationFrame(tick)
  }
  const stopRaf = () => {
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null }
    state.onLevel?.(0)
  }

  audio.onplay = () => { try { startRaf() } catch {} }
  audio.onpause = () => { try { stopRaf() } catch {} }
  audio.onended = () => { try { stopRaf() } catch {} }
}

function startBrowserPseudoLevel(maxLevel = 0.6) {
  stopBrowserPseudoLevel()
  let last = 0
  const tick = () => {
    const target = 0.05 + Math.random() * 0.30
    last = last + (target - last) * 0.35
    state.onLevel?.(Math.max(0, Math.min(maxLevel, last)))
  }
  state.browserLevelTimer = window.setInterval(tick, 100) as unknown as number
}
function stopBrowserPseudoLevel() {
  if (state.browserLevelTimer != null) {
    clearInterval(state.browserLevelTimer as unknown as number)
    state.browserLevelTimer = null
  }
  state.onLevel?.(0)
}

async function getResponseBodyError(res: Response): Promise<string> {
  try {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const data = await res.clone().json().catch(() => null)
      if (data && typeof data === 'object') {
        const msg = (data as any).detail ?? (data as any).message ?? JSON.stringify(data)
        return `HTTP ${res.status}: ${msg}`
      }
    }
    const text = await res.clone().text().catch(() => '')
    return `HTTP ${res.status}: ${text || res.statusText}`
  } catch {
    return `HTTP ${res.status}: ${res.statusText}`
  }
}

export async function initTtsAvailability(api_url: string, projectSlug: string) {
  try {
    const url = `${api_url}/tts/test`
    console.log(`[tts/test] POST ${url} …`)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug }),
    })

    if (!res.ok) {
      const errMsg = await getResponseBodyError(res)
      USE_BROWSER_TTS = true
      console.log(`[tts/test] USE_BROWSER_TTS=${USE_BROWSER_TTS} (cause: ERROR)`)
      throw new Error(errMsg)
    }
    USE_BROWSER_TTS = false
    console.log(`[tts/test] USE_BROWSER_TTS=${USE_BROWSER_TTS}`)
  } catch (e) {
    USE_BROWSER_TTS = true
    console.log(`[tts/test] Fallback to Browser TTS: ${USE_BROWSER_TTS}`)
    throw (e instanceof Error ? e : new Error(String(e)))
  }
}

function browserSpeak(text: string, languageCode?: string) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = toBrowserLangTag(languageCode)
  u.rate = 1
  u.pitch = 1
  try { speechSynthesis.resume?.() } catch {}
  try { speechSynthesis.cancel() } catch {}
  try { speechSynthesis.resume?.() } catch {}
  state.currentUtter = u
  speechSynthesis.speak(u)
  return u
}


  export function stopTTS() {
    ttsSessionIdRef.current += 1

    try { speechSynthesis.cancel() } catch {}
    try { speechSynthesis.resume?.() } catch {}
    try { speechSynthesis.cancel() } catch {}
    state.currentUtter = null
    stopBrowserPseudoLevel()

    try {
      const audio = getAudio()
      audio.onended = null
      audio.onerror = null
      audio.onpause = null
      audio.onplay = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load?.()
    } catch {}

    try { state.reader?.cancel() } catch {}
    state.reader = null

    try { state.aborter?.abort() } catch {}
    state.aborter = null

    try {
      const sb = state.sb
      const mse = state.mse

      if (sb && sb.updating) {
        const sbRef = sb
        let done = false
        const onEnd = () => { done = true }
        try { sbRef.addEventListener('updateend', onEnd, { once: true }) } catch {}
        const started = performance.now()
        while (sbRef.updating && performance.now() - started < 150) {}
        try { sbRef.removeEventListener('updateend', onEnd as any) } catch {}
      }

      if (mse && mse.readyState === 'open') {
        try { mse.endOfStream() } catch {}
      }
    } catch {}
    state.sb = null
    state.mse = null

    if (state.lastUrl) {
      try { URL.revokeObjectURL(state.lastUrl) } catch {}
      state.lastUrl = null
    }
    
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null }
    state.onLevel?.(0)
  }


async function speakElevenStreamed(
  api_url: string,
  projectSlug: string,
  text: string,
  onAfterAudio: () => void,
  onLevel?: (rms: number) => void,
  languageCode?: string
) {
  const sessionId = ++ttsSessionIdRef.current
  const controller = new AbortController()
  state.aborter = controller

  let res: Response | null = null
  try {
    res = await fetch(`${api_url}/tts/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        projectSlug,
        language_code: toLanguageCode(languageCode),
      }),
      signal: controller.signal
    })
  } catch {
    if (!isCurrent(sessionId) || controller.signal.aborted) return
  }
  if (!res || !res.ok || !res.body) { if (isCurrent(sessionId)) await speakElevenSimple(api_url, projectSlug, text, onAfterAudio, onLevel, languageCode); return }

  const mime = 'audio/mpeg'
  if (!('MediaSource' in window) || !MediaSource.isTypeSupported(mime)) { if (isCurrent(sessionId)) await speakElevenSimple(api_url, projectSlug, text, onAfterAudio, onLevel); return }

  const audio = getAudio()
  ensureAnalyser(onLevel)

  const mediaSource = new MediaSource()
  state.mse = mediaSource
  const objectUrl = URL.createObjectURL(mediaSource)
  if (state.lastUrl) { try { URL.revokeObjectURL(state.lastUrl) } catch {} }
  state.lastUrl = objectUrl
  audio.src = objectUrl

  const done = () => {
    try { URL.revokeObjectURL(objectUrl) } catch {}
    if (state.lastUrl === objectUrl) state.lastUrl = null
    onAfterAudio()
  }
  audio.onended = done
  audio.onerror = done

  const reader = res.body.getReader()
  state.reader = reader

  await new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', async () => {
      if (!isCurrent(sessionId)) { try { mediaSource.endOfStream() } catch {} resolve(); return }
      const sb = mediaSource.addSourceBuffer(mime)
      state.sb = sb

      const pump = async (): Promise<void> => {
        if (!isCurrent(sessionId)) { try { mediaSource.endOfStream() } catch {} return }
        if (controller.signal.aborted) { try { mediaSource.endOfStream() } catch {} resolve(); return }
        let result: ReadableStreamReadResult<Uint8Array>
        try {
          result = await reader.read()
        } catch (e) {
          if (!isCurrent(sessionId) || controller.signal.aborted) { resolve(); return }
          reject(e); return
        }
        const { value, done } = result
        if (done) { if (mediaSource.readyState !== 'ended') mediaSource.endOfStream(); resolve(); return }
        await new Promise<void>((r) => {
          const append = () => { sb.removeEventListener('updateend', append); r() }
          sb.addEventListener('updateend', append, { once: true })
          try { sb.appendBuffer(new Uint8Array(value!)) } catch { r() }
        })
        if (audio.paused) audio.play().catch(() => {})
        await pump()
      }

      try { pump() } catch (e) { reject(e) }
    }, { once: true })
  })
}

async function speakElevenSimple(
  api_url: string,
  projectSlug: string,
  text: string,
  onAfterAudio: () => void,
  onLevel?: (rms: number) => void,
  languageCode?: string
) {
  const sessionId = ++ttsSessionIdRef.current
  const controller = new AbortController()
  state.aborter = controller

  let response: Response | null = null
  try {
    response = await fetch(`${api_url}/tts/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        projectSlug,
        language_code: toLanguageCode(languageCode),
      }),
      signal: controller.signal
    })
  } catch {
    if (!isCurrent(sessionId) || controller.signal.aborted) return
  }
  if (!response || !response.ok) return
  const audioBlob = await response.blob()
  if (!isCurrent(sessionId)) return
  const audioUrl = URL.createObjectURL(audioBlob)
  if (state.lastUrl) { try { URL.revokeObjectURL(state.lastUrl) } catch {} }
  state.lastUrl = audioUrl
  const audio = getAudio()

  ensureAnalyser(onLevel)

  audio.src = audioUrl
  const done = () => {
    try { URL.revokeObjectURL(audioUrl) } catch {}
    if (state.lastUrl === audioUrl) state.lastUrl = null
    onAfterAudio()
  }
  audio.onended = done
  audio.onerror = done
  audio.play().catch(() => { done() })
}

export async function speakAnswer(args: {
  api_url: string
  projectSlug: string
  text: string
  avmOpen: boolean
  chatFinished: boolean
  onAfterAudio: () => void
  onLevel?: (rms: number) => void,
  language?: string
}) {
  const { api_url, projectSlug, text, avmOpen, chatFinished, onAfterAudio, onLevel, language } = args
  if (!text || !avmOpen || chatFinished) return

  if (USE_BROWSER_TTS) {
    const sessionId = ++ttsSessionIdRef.current
    state.onLevel = onLevel ?? null
    const u = browserSpeak(text, language)

    u.onstart = () => startBrowserPseudoLevel()
    const end = () => {
      if (!isCurrent(sessionId)) return
      stopBrowserPseudoLevel()
      onAfterAudio()
    }
    u.onend = end
    u.onerror = end
    return
  }

  await speakElevenStreamed(api_url, projectSlug, text, onAfterAudio, onLevel, language)
}
