'use client'

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs';
import { TARGET_SR, CHUNK_MS, getWorkletURL, resampleFloat32PCM, floatTo16BitPCM } from '../../lib/audioUtils'
import { SettingsContext } from '@/context/settings';

type Opts = {
  onTranscript: (text: string) => void
  onLevel?: (level: number) => void
  onError?: (err: unknown) => void
  onOpen?: () => void
  onClose?: (ev: CloseEvent) => void
  onUploadDone?: (ok: boolean, urlOrMsg?: string) => void
}

export function useSpeechStream(
  { onTranscript, onLevel, onError, onOpen, onClose, onUploadDone }: Opts,
  recordMP3: boolean = false
) {
  const {language, projectSlug} = useContext(SettingsContext)
  const api_url = process.env.NEXT_PUBLIC_API_URL
  const baseUrl = (api_url ?? location.origin)
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/api/stream?slug=${projectSlug}&language=${language}&translate=false`

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null)
  const bufferRef = useRef<Int16Array>(new Int16Array(0))
  const lastFlushRef = useRef<number>(0)
  const connectSeqRef = useRef(0)
  const isRecordingRef = useRef(false)

  const mp3EncoderRef = useRef<Mp3Encoder | null>(null)
  const mp3ChunksRef = useRef<Uint8Array[]>([])
  const mp3StartedRef = useRef(false)

  const onTranscriptRef = useRef(onTranscript)
  const onLevelRef = useRef(onLevel)
  const onErrorRef = useRef(onError)
  const onOpenRef  = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  const onUploadDoneRef = useRef(onUploadDone)

  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onLevelRef.current = onLevel }, [onLevel])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { onOpenRef.current  = onOpen }, [onOpen])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onUploadDoneRef.current = onUploadDone }, [onUploadDone])

  const [recording, setRecording] = useState(false)
  const [streamingError, setStreamingError] = useState<string | null>(null)
  const closeExpectedRef = useRef(false);

  const reportError = (err: unknown) => {
    setStreamingError(prev => {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
      return msg
    })
    try { onErrorRef.current?.(err) } catch {}
    console.error('[useSpeechStream]', err)
  }

  const appendToBuffer = (src: Float32Array) => {
    // Sofort zu Int16 konvertieren für Speicher-Effizienz
    const int16 = floatTo16BitPCM(src)
    const prev = bufferRef.current
    const merged = new Int16Array(prev.length + int16.length)
    merged.set(prev, 0)
    merged.set(int16, prev.length)
    bufferRef.current = merged
  }

  const flushIfNeeded = (srcSampleRate: number) => {
    const now = performance.now()
    if (!lastFlushRef.current) lastFlushRef.current = now
    const elapsed = now - lastFlushRef.current

    if (!isRecordingRef.current) {
      bufferRef.current = new Int16Array(0)
      lastFlushRef.current = now
      return
    }

    if (elapsed >= CHUNK_MS && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Buffer ist bereits Int16, Resampling nur nötig wenn srcSampleRate != TARGET_SR
      let finalInt16: Int16Array
      if (srcSampleRate === TARGET_SR) {
        finalInt16 = bufferRef.current
      } else {
        // Erst zu Float32 für Resampling, dann zurück zu Int16
        const float32 = new Float32Array(bufferRef.current.length)
        for (let i = 0; i < bufferRef.current.length; i++) {
          float32[i] = bufferRef.current[i] / (bufferRef.current[i] < 0 ? 0x8000 : 0x7FFF)
        }
        const resampled = resampleFloat32PCM(float32, srcSampleRate, TARGET_SR)
        finalInt16 = floatTo16BitPCM(resampled)
      }
      if (finalInt16.length) wsRef.current.send(finalInt16.buffer)
      bufferRef.current = new Int16Array(0)
      lastFlushRef.current = now
    }
  }

  const ensureMp3Encoder = (sampleRate: number) => {
    if (!recordMP3) return
    if (!mp3EncoderRef.current) {
      // channels=1, samplerate = AC rate (48000), kbps=128
      mp3EncoderRef.current = new Mp3Encoder(1, sampleRate, 128);
      mp3ChunksRef.current = []
      mp3StartedRef.current = true
    }
  }

  const encodeMp3Chunk = (mono: Float32Array) => {
    if (!recordMP3) return
    const enc = mp3EncoderRef.current
    if (!enc) return
    const pcm16 = floatTo16BitPCM(mono)
    const mp3buf = enc.encodeBuffer(pcm16 as unknown as Int16Array)
    if (mp3buf && mp3buf.length) {
      mp3ChunksRef.current.push(new Uint8Array(mp3buf))
    }
  }


  async function getAudioDuration(blob: Blob): Promise<number> {
    const ab = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuf = await ctx.decodeAudioData(ab.slice(0));
    ctx.close?.();
    return audioBuf.duration;
  }

  const finalizeAndUploadMp3 = async () => {
    if (!recordMP3) return;
    try {
      const enc = mp3EncoderRef.current;
      if (!enc || !mp3StartedRef.current) return;

      const last = enc.flush();
      if (last && last.length) mp3ChunksRef.current.push(last);

      const total = mp3ChunksRef.current.reduce((n, c) => n + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of mp3ChunksRef.current) {
        merged.set(c, off);
        off += c.byteLength;
      }
      const blob = new Blob([merged], { type: "audio/mpeg" });

      const project_slug = localStorage.getItem("project") ?? "";
      const interview_session_id = localStorage.getItem(`interview_session_${project_slug}`) ?? "";

      const filename = `recording-${project_slug}-${interview_session_id}-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.mp3`;

      const duration_sec = Math.round(await getAudioDuration(blob));
      const size_bytes = blob.size;
      const mime_type = blob.type;

      const fd = new FormData();
      fd.append("file", blob, filename);
      fd.append("filename", filename);
      fd.append("mime_type", mime_type);
      fd.append("size_bytes", String(size_bytes));
      fd.append("duration_sec", String(duration_sec));
      fd.append("project_slug", project_slug);
      fd.append("interview_session_id", interview_session_id);

      const backendUrl = process.env.NEXT_PUBLIC_API_URL

      const res = await fetch(`${backendUrl}/uploads/audio`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Upload failed");
      }

      onUploadDoneRef.current?.(true);
    } catch (e: any) {
      reportError(e);
      onUploadDoneRef.current?.(false, e?.message);
    } finally {
      mp3EncoderRef.current = null;
      mp3ChunksRef.current = [];
      mp3StartedRef.current = false;
    }
  };


  const ensureAudioStarted = useCallback(async () => {
    if (audioContextRef.current) { try { await audioContextRef.current.resume() } catch {} return }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (e) {
      reportError(new Error('No Mic access (getUserMedia).'))
      throw e
    }
    mediaStreamRef.current = stream

    let ac: AudioContext
    try {
      ac = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    } catch (e) {
      reportError(new Error('Unable to create Audio Context.'))
      throw e
    }
    audioContextRef.current = ac
    const source = ac.createMediaStreamSource(stream)

    const workletUrl = getWorkletURL()
    if ((ac as any).audioWorklet) {
      try {
        await (ac as any).audioWorklet.addModule(workletUrl)
      } catch (e) {
        reportError(new Error('AudioWorklet not loaded.'))
        throw e
      }
      const worklet = new (window as any).AudioWorkletNode(ac, 'mono-capture-processor')
      worklet.port.onmessage = (ev: MessageEvent) => {
        if (!isRecordingRef.current) { onLevelRef.current?.(0); return }
        const mono = ev.data as Float32Array
        let sum = 0
        for (let i = 0; i < mono.length; i++) { const s = mono[i]; sum += s * s }
        const rms = Math.sqrt(sum / mono.length)
        const mapped = Math.pow(Math.min(1, rms * 6), 0.5)
        onLevelRef.current?.(mapped)
        ensureMp3Encoder(ac.sampleRate)
        encodeMp3Chunk(mono)
        appendToBuffer(mono)
        flushIfNeeded(ac.sampleRate)
      }
      source.connect(worklet as any)
      workletNodeRef.current = worklet as any
    } else {
      const sp = (ac as any).createScriptProcessor(2048, 1, 1)
      sp.onaudioprocess = (e: any) => {
        if (!isRecordingRef.current) { onLevelRef.current?.(0); return }
        const mono = new Float32Array(e.inputBuffer.getChannelData(0))
        let sum = 0
        for (let i = 0; i < mono.length; i++) { const s = mono[i]; sum += s * s }
        const rms = Math.sqrt(sum / mono.length)
        const mapped = Math.pow(Math.min(1, rms * 6), 0.5)
        onLevelRef.current?.(mapped)

        ensureMp3Encoder(ac.sampleRate)
        encodeMp3Chunk(mono)

        appendToBuffer(mono)
        flushIfNeeded(ac.sampleRate)
      }
      source.connect(sp)
      workletNodeRef.current = sp
    }

    try { await ac.resume() } catch {}
  }, [recordMP3])

  const openFreshWs = useCallback(async (): Promise<WebSocket> => {
    const mySeq = ++connectSeqRef.current
    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'

    ws.addEventListener('open', () => {
      try { ws.send(new Int16Array(Math.floor(TARGET_SR * 0.02)).buffer) } catch {}
      try { onOpenRef.current?.() } catch {}
    })

    ws.onmessage = (ev) => {
      if (!isRecordingRef.current) return
      try {
        const msg = JSON.parse(ev.data as any)
        const t = (msg?.transcription || '').trim()
        if (!t) return
        onTranscriptRef.current?.(t)
      } catch {}
    }

    ws.onerror = () => reportError(new Error('WebSocket error.'))

    ws.onclose = (ev) => {
      try { onCloseRef.current?.(ev) } catch {}

      if (closeExpectedRef.current || !isRecordingRef.current) {
        closeExpectedRef.current = false;
        return;
      }
      if (ev.code === 1000) return;

      const codeHints: Record<number, string> = {
        1001: 'Connection interruped.',
        1005: 'No server response.',
        1006: 'Unexpected Interruption.',
        1011: 'Upstream error.',
        1013: 'Server at max capacity.',
      };
      const hint = codeHints[ev.code];
      const reason = ev.reason ? ` (${ev.reason})` : '';
      const msg = hint ? `${hint}${reason}` : `websocket closed with code ${ev.code}${reason}`;

      reportError(new Error(msg));
      try { onErrorRef.current?.(new Error(msg)) } catch {}
    };

    await new Promise<void>((resolve, reject) => {
      const ok = () => resolve()
      const bad = () => reject(new Error('WS open failed'))
      ws.addEventListener('open', ok, { once: true })
      ws.addEventListener('error', bad, { once: true })
    })

    if (connectSeqRef.current !== mySeq) {
      try { ws.close() } catch {}
      throw new Error('stale ws connect')
    }

    wsRef.current = ws
    return ws
  }, [wsUrl])

  const start = useCallback(async () => {
    await ensureAudioStarted()
    try {
      await openFreshWs()
    } catch (e) {
      reportError(new Error('WebSocket open failed.'))
      return
    }
    isRecordingRef.current = true
    setRecording(true)
    try {
      await audioContextRef.current?.resume()
      wsRef.current?.send(new Int16Array(Math.floor(TARGET_SR * 0.03)).buffer)
    } catch {}
  }, [ensureAudioStarted, openFreshWs])

  const pauseAndCloseWs = useCallback(async () => {
    isRecordingRef.current = false
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (bufferRef.current.length && audioContextRef.current) {
          // Buffer ist bereits Int16, Resampling nur nötig wenn sampleRate != TARGET_SR
          let finalInt16: Int16Array
          if (audioContextRef.current.sampleRate === TARGET_SR) {
            finalInt16 = bufferRef.current
          } else {
            // Erst zu Float32 für Resampling, dann zurück zu Int16
            const float32 = new Float32Array(bufferRef.current.length)
            for (let i = 0; i < bufferRef.current.length; i++) {
              float32[i] = bufferRef.current[i] / (bufferRef.current[i] < 0 ? 0x8000 : 0x7FFF)
            }
            const resampled = resampleFloat32PCM(float32, audioContextRef.current.sampleRate, TARGET_SR)
            finalInt16 = floatTo16BitPCM(resampled)
          }
          if (finalInt16.length) wsRef.current.send(finalInt16.buffer)
        }
        bufferRef.current = new Int16Array(0)
        try { wsRef.current.send(new Uint8Array(0)) } catch {}
        try {
          closeExpectedRef.current = true;
          wsRef.current.close()
        } catch {}
      }
    } finally {
      wsRef.current = null
      lastFlushRef.current = performance.now()
    }
  }, [])

  const stop = useCallback(async () => {
    await pauseAndCloseWs()

    try {
      await finalizeAndUploadMp3()
    } catch (e) {
    }

    try { workletNodeRef.current?.disconnect() } catch {}
    workletNodeRef.current = null
    try { audioContextRef.current?.close() } catch {}
    audioContextRef.current = null
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
    mediaStreamRef.current = null
    bufferRef.current = new Int16Array(0)
    lastFlushRef.current = 0
    setRecording(false)
  }, [pauseAndCloseWs])

  useEffect(() => () => { stop().catch(() => {}) }, [stop])

  return { start, stop, pauseAndCloseWs, recording, streamingError }
}
