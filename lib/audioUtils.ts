export const TARGET_SR = 16000
export const CHUNK_MS = 500

export function getWorkletURL(): string {
  const processor = `
    class MonoCaptureProcessor extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;
        const ch0 = input[0];
        if (!ch0) return true;
        let mono;
        if (input.length > 1) {
          const len = input[0].length;
          mono = new Float32Array(len);
          for (let i = 0; i < len; i++) {
            let sum = 0;
            for (let c = 0; c < input.length; c++) sum += input[c][i] || 0;
            mono[i] = sum / input.length;
          }
        } else {
          mono = ch0.slice();
        }
        this.port.postMessage(mono, [mono.buffer]);
        return true;
      }
    }
    registerProcessor('mono-capture-processor', MonoCaptureProcessor);
  `
  const blob = new Blob([processor], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

export function resampleFloat32PCM(input: Float32Array, srcSR: number, dstSR: number): Float32Array {
  if (srcSR === dstSR) return input
  const ratio = srcSR / dstSR
  const newLen = Math.floor(input.length / ratio)
  const output = new Float32Array(newLen)
  for (let i = 0; i < newLen; i++) {
    const idx = i * ratio
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = idx - i0
    output[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return output
}

export function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return out
}
