'use client'

export async function initSttAvailability(apiBase: string, slug: string): Promise<void> {

  const base = apiBase || '';
  const url = `${base}/api/stream/test?slug=${encodeURIComponent(slug)}`;

  let res: Response;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    (err as any).code = 'NETWORK';
    throw err;
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    const err = new Error(`STT check failed (${res.status})${msg ? `: ${msg}` : ''}`);
    (err as any).status = res.status;
    throw err;
  }
}

export async function transcribeAudioFile(
  apiBase: string,
  file: File,
  opts?: { signal?: AbortSignal; language?: string }
): Promise<string> {
  if (!file) throw new Error('No file provided');

  const base = apiBase || '';
  const language = opts?.language ?? 'en';

  const url = `${base}/api/transcribe/proxy?language=${encodeURIComponent(language)}`;

  const form = new FormData();
  form.append('file', file, file.name);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: form,
      signal: opts?.signal,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    (err as any).code = 'NETWORK';
    throw err;
  }

  const payload = await res.text().catch(() => '');
  if (!res.ok) {
    const err = new Error(
      `Transcription failed (${res.status})${payload ? `: ${payload}` : ''}`
    );
    (err as any).status = res.status;
    throw err;
  }

  return payload.trim();
}

