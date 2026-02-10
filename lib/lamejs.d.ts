declare module 'lamejs/src/Mp3Encoder' {
  export default class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(pcm: Int16Array): Uint8Array;
    flush(): Uint8Array;
  }
}