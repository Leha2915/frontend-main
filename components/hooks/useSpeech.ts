'use client'

import { useCallback, useEffect, useRef, useState, useContext } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs'
import { TARGET_SR, CHUNK_MS, getWorkletURL, resampleFloat32PCM, floatTo16BitPCM } from '../../lib/audioUtils'
import { SettingsContext } from '@/context/settings'

type Opts = {
  onTranscript: (text: string) => void
  onLevel?: (level: number) => void
  onError?: (err: unknown) => void
  onOpen?: () => void
  onClose?: (ev: CloseEvent | undefined) => void
  onUploadDone?: (ok: boolean, urlOrMsg?: string) => void
}

export function useSpeech(
  { onTranscript, onLevel, onError, onOpen, onClose, onUploadDone }: Opts,
  recordMP3: boolean = false
) {
  const sc = useContext(SettingsContext)

  const api_url = process.env.NEXT_PUBLIC_API_URL
  const baseUrl = (api_url ?? location.origin)
  const transcribeUrl = `${baseUrl}/api/transcribe/proxy`

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null)

  const bufferRef = useRef<Int16Array>(new Int16Array(0))
  const lastFlushRef = useRef<number>(0)
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

  const reportError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
    setStreamingError(msg)
    try { onErrorRef.current?.(err) } catch {}
    console.error('[useSpeech]', err)
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
      lastFlushRef.current = now
      return
    }

    if (elapsed >= CHUNK_MS) {
      lastFlushRef.current = now
    }
  }

  const ensureMp3Encoder = (sampleRate: number) => {
    if (!recordMP3) return
    if (!mp3EncoderRef.current) {
      mp3EncoderRef.current = new Mp3Encoder(1, sampleRate, 128)
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
    if (!recordMP3) return
    try {
      const enc = mp3EncoderRef.current
      if (!enc || !mp3StartedRef.current) return
      const last = enc.flush()
      if (last && last.length) mp3ChunksRef.current.push(last)

      const total = mp3ChunksRef.current.reduce((n, c) => n + c.byteLength, 0)
      const merged = new Uint8Array(total)
      let off = 0
      for (const c of mp3ChunksRef.current) { merged.set(c, off); off += c.byteLength }
      const blob = new Blob([merged], { type: 'audio/mpeg' })

      const project_slug = localStorage.getItem('project') ?? ''
      const interview_session_id = localStorage.getItem(`interview_session_${project_slug}`) ?? ''
      const filename = `recording-${project_slug}-${interview_session_id}-${new Date().toISOString().replace(/[:.]/g, '-')}.mp3`

      const duration_sec = Math.round(await getAudioDuration(blob))
      const size_bytes = blob.size
      const mime_type = blob.type

      const fd = new FormData()
      fd.append('file', blob, filename)
      fd.append('filename', filename)
      fd.append('mime_type', mime_type)
      fd.append('size_bytes', String(size_bytes))
      fd.append('duration_sec', String(duration_sec))
      fd.append('project_slug', project_slug)
      fd.append('interview_session_id', interview_session_id)

      const backendUrl = process.env.NEXT_PUBLIC_API_URL
      const res = await fetch(`${backendUrl}/uploads/audio`, { method: 'POST', body: fd })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Upload failed')
      }
      onUploadDoneRef.current?.(true)
    } catch (e: any) {
      reportError(e)
      onUploadDoneRef.current?.(false, e?.message)
    } finally {
      mp3EncoderRef.current = null
      mp3ChunksRef.current = []
      mp3StartedRef.current = false
    }
  }

  const pcm16ToWavBlob = (pcm16: Int16Array, sampleRate: number) => {
    const numChannels = 1
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = pcm16.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    let p = 0
    const writeStr = (s: string) => { for (let i=0;i<s.length;i++) view.setUint8(p++, s.charCodeAt(i)) }
    writeStr('RIFF')
    view.setUint32(p, 36 + dataSize, true); p += 4
    writeStr('WAVE')
    writeStr('fmt ')
    view.setUint32(p, 16, true); p += 4
    view.setUint16(p, 1, true); p += 2
    view.setUint16(p, numChannels, true); p += 2
    view.setUint32(p, sampleRate, true); p += 4
    view.setUint32(p, byteRate, true); p += 4
    view.setUint16(p, blockAlign, true); p += 2
    view.setUint16(p, 16, true); p += 2
    writeStr('data')
    view.setUint32(p, dataSize, true); p += 4

    for (let i=0;i<pcm16.length;i++, p+=2) view.setInt16(p, pcm16[i], true)
    return new Blob([view], { type: 'audio/wav' })
  }

  const transcribeBlob = async (
    wav: Blob,
    filename = 'audio.wav',
  ): Promise<string> => {
    const fd = new FormData()
    fd.append('file', wav, filename)
    const url = `${transcribeUrl}?language=${encodeURIComponent(sc.language)}&slug=${encodeURIComponent(sc.projectSlug)}`
    console.log("url", url)
    let res: Response
    try {
      res = await fetch(url, { method: 'POST', body: fd })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      ;(err as any).code = 'NETWORK'
      throw err
    }

    const text = await res.text().catch(() => '')
    if (!res.ok) {
      const err = new Error(`Transcription failed (${res.status})${text ? `: ${text}` : ''}`)
      ;(err as any).status = res.status
      throw err
    }
    return text.trim()
  }


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
      try { await (ac as any).audioWorklet.addModule(workletUrl) }
      catch { reportError(new Error('AudioWorklet not loaded.')); throw new Error('AudioWorklet not loaded.') }

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

  const transcribeNow = useCallback(async (): Promise<string> => {
    const ac = audioContextRef.current
    const srcSR = ac?.sampleRate ?? 16000
    const pcm16All = bufferRef.current
    bufferRef.current = new Int16Array(0)
    lastFlushRef.current = performance.now()

    if (!pcm16All.length) return ''

    // Resampling nur nötig wenn srcSR != TARGET_SR
    let finalPcm16: Int16Array
    if (srcSR === TARGET_SR) {
      finalPcm16 = pcm16All
    } else {
      // Erst zu Float32 für Resampling, dann zurück zu Int16
      const float32 = new Float32Array(pcm16All.length)
      for (let i = 0; i < pcm16All.length; i++) {
        float32[i] = pcm16All[i] / (pcm16All[i] < 0 ? 0x8000 : 0x7FFF)
      }
      const resampled = resampleFloat32PCM(float32, srcSR, TARGET_SR)
      finalPcm16 = floatTo16BitPCM(resampled)
    }
    
    const wav = pcm16ToWavBlob(finalPcm16, TARGET_SR)
    const filename = `mic-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`
    const text = await transcribeBlob(wav, filename)
    try { onTranscriptRef.current?.(text) } catch {}
    return text
  }, [])

  const start = useCallback(async () => {
    await ensureAudioStarted()
    isRecordingRef.current = true
    setRecording(true)
    try { await audioContextRef.current?.resume() } catch {}
    try { onOpenRef.current?.() } catch {}
  }, [ensureAudioStarted])

  const pauseAndTranscribe = useCallback(async () => {
    isRecordingRef.current = false
    try {
      const text = await transcribeNow()
      return text
    } catch (e) {
      reportError(e)
      throw e
    } finally {
    }
  }, [transcribeNow])

  const stop = useCallback(async () => {
    isRecordingRef.current = false
    try {
      await transcribeNow()
    } catch (e) {
    }

    try { await finalizeAndUploadMp3() } catch {}

    try { workletNodeRef.current?.disconnect() } catch {}
    workletNodeRef.current = null
    try { audioContextRef.current?.close() } catch {}
    audioContextRef.current = null
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
    mediaStreamRef.current = null

    bufferRef.current = new Int16Array(0)
    lastFlushRef.current = 0
    setRecording(false)

    try { onCloseRef.current?.(undefined) } catch {}
  }, [transcribeNow])

  useEffect(() => () => { stop().catch(() => {}) }, [stop])

  return { start, stop, pauseAndTranscribe, recording, streamingError }
}
