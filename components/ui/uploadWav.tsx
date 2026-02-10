'use client'

import { useContext, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, Loader2 } from 'lucide-react'
import { SettingsContext } from '@/context/settings'

type Props = {
  disabled?: boolean
  api_url: string
  onTranscript: (text: string) => void
  onError: (msg: string) => void
}

export default function UploadWav({ disabled, api_url, onTranscript, onError }: Props) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const onPickClick = () => fileInputRef.current?.click()
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragActive(true) }
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragActive(false) }
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    const file = e.dataTransfer.files?.[0]; if (file) await processFile(file)
  }
  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) await processFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validateWav = (file: File) => {
    const isWavType = file.type.includes('wav') || file.type === 'audio/wave' || file.type === 'audio/x-wav'
    const isWavName = file.name.toLowerCase().endsWith('.wav')
    return isWavType || isWavName
  }

  const uploadWav = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const {language} = useContext(SettingsContext)
    const res = await fetch(`${api_url}/api/transcribe-file?language=${language}&translate=false`, { method: 'POST', body: form })
    if (!res.ok) throw new Error('Unable to upload')
    const data = await res.json()
    return (data.results as Array<any>)
      .map((r) => r?.transcription)
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  const processFile = async (file: File) => {
    if (!validateWav(file)) { onError(`Please upload a wav file (16kHz, mono, 16-bit PCM).`); return }
    setUploading(true)
    try {
      const text = await uploadWav(file)
      if (text) onTranscript(text)
    } catch (e: any) {
      onError(`Upload failed: ${e?.message ?? 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={onPickClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      role="button"
      aria-label="Drop or pick WAV"
      className={cn(
        "h-12 w-12 rounded-xl border border-dashed transition-all duration-150",
        "flex items-center justify-center shrink-0 select-none",
        dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400",
        (disabled || uploading) && "cursor-not-allowed opacity-50",
      )}
      title="Drop or pick WAV"
    >
      {uploading ? <Loader2 className="h-5 w-5 animate-spin text-gray-700" /> : <Upload className="h-5 w-5 text-gray-700" />}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/wav"
        className="hidden"
        onChange={onFileInputChange}
        disabled={disabled || uploading}
      />
    </div>
  )
}
