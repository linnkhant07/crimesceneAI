const LYRIA_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;

export interface LyriaCallbacks {
  onConnectionChange: (connected: boolean) => void;
  onError: (error: string) => void;
}

export interface WeightedPrompt {
  text: string;
  weight: number;
}

export class LyriaClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private callbacks: LyriaCallbacks;
  private ready = false;
  private gainNode: GainNode | null = null;

  constructor(callbacks: LyriaCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(apiKey: string, prompts: WeightedPrompt[]) {
    this.disconnect();

    const url = `${LYRIA_WS_URL}?key=${apiKey}`;
    this.ws = new WebSocket(url);

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0.4;
    this.gainNode.connect(this.audioContext.destination);

    this.ws.onopen = () => {
      this.ws!.send(
        JSON.stringify({ setup: { model: "models/lyria-realtime-exp" } })
      );
      // Give server time to process setup before sending prompts
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({ clientContent: { weightedPrompts: prompts } })
          );
          this.ws.send(
            JSON.stringify({
              musicGenerationConfig: {
                temperature: 1.1,
                guidance: 4.0,
                density: 0.5,
                brightness: 0.4,
              },
            })
          );
          this.ws.send(JSON.stringify({ playbackControl: "PLAY" }));
          this.ready = true;
          this.callbacks.onConnectionChange(true);
        }
      }, 500);
    };

    this.ws.onmessage = async (event) => {
      try {
        const text =
          event.data instanceof Blob ? await event.data.text() : event.data;
        const data = JSON.parse(text);

        if (data.serverContent?.audioChunks) {
          for (const chunk of data.serverContent.audioChunks) {
            if (chunk.data) {
              this.handleAudioChunk(chunk.data);
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError("Lyria connection error");
      this.callbacks.onConnectionChange(false);
    };

    this.ws.onclose = () => {
      this.ready = false;
      this.callbacks.onConnectionChange(false);
    };
  }

  private handleAudioChunk(base64Data: string) {
    if (!this.audioContext || !this.gainNode) return;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const numFrames = int16.length / CHANNELS;

    const buffer = this.audioContext.createBuffer(
      CHANNELS,
      numFrames,
      SAMPLE_RATE
    );
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < numFrames; i++) {
      left[i] = int16[i * 2] / 32768;
      right[i] = int16[i * 2 + 1] / 32768;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;
  }

  updatePrompts(prompts: WeightedPrompt[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.ready)
      return;
    this.ws.send(
      JSON.stringify({ clientContent: { weightedPrompts: prompts } })
    );
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(
        volume,
        this.audioContext?.currentTime ?? 0,
        0.5
      );
    }
  }

  pause() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ playbackControl: "PAUSE" }));
  }

  play() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ playbackControl: "PLAY" }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
    this.nextPlayTime = 0;
    this.ready = false;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN && this.ready;
  }
}
