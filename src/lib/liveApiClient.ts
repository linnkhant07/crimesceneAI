const LIVE_API_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/** Must be a model with Live API support — see https://ai.google.dev/gemini-api/docs/models */
const DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

function getLiveModel(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL?.trim()) {
    return process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL.trim();
  }
  return DEFAULT_LIVE_MODEL;
}
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

const MALE_VOICES = ["Charon", "Fenrir"];
const FEMALE_VOICES = ["Kore", "Aoede"];

export interface LiveApiCallbacks {
  onTranscriptUpdate: (role: "user" | "suspect", text: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (error: string) => void;
  onAudioStart: () => void;
  onAudioEnd: () => void;
}

export class LiveApiClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private callbacks: LiveApiCallbacks;
  private isRecording = false;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private currentTranscript = "";
  private outputTranscript = "";
  private playbackContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private setupComplete = false;
  /** Avoid double onError when both ws.onerror and onclose(abnormal) fire */
  private failureNotified = false;

  constructor(callbacks: LiveApiCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(apiKey: string, systemPrompt: string, suspectIndex: number, gender: "male" | "female" = "male") {
    this.disconnect();
    this.failureNotified = false;

    const url = `${LIVE_API_WS_URL}?key=${apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      const voices = gender === "female" ? FEMALE_VOICES : MALE_VOICES;
      const voiceName = voices[suspectIndex % voices.length];

      // Wire format confirmed from SDK source: setup → generationConfig → responseModalities/speechConfig
      const configMessage = {
        setup: {
          model: `models/${getLiveModel()}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      };

      this.ws!.send(JSON.stringify(configMessage));
      // Do NOT call onConnectionChange yet — wait for setupComplete from server
    };

    this.ws.onmessage = async (event) => {
      try {
        const text = event.data instanceof Blob ? await event.data.text() : event.data;
        const data = JSON.parse(text);
        console.log("[LiveAPI] message from server:", JSON.stringify(data));
        this.handleServerMessage(data);
      } catch {
        console.log("[LiveAPI] raw message (not JSON):", event.data);
      }
    };

    this.ws.onerror = () => {
      if (!this.failureNotified) {
        this.failureNotified = true;
        this.callbacks.onError(
          "WebSocket error (network, API key restrictions, or blocked WebSocket). See browser Network → WS."
        );
      }
      this.callbacks.onConnectionChange(false);
    };

    this.ws.onclose = (ev: CloseEvent) => {
      this.setupComplete = false;
      this.callbacks.onConnectionChange(false);
      if (ev.code !== 1000 && !this.failureNotified) {
        this.failureNotified = true;
        const detail = ev.reason
          ? `${ev.reason} (code ${ev.code})`
          : `closed with code ${ev.code}`;
        console.warn("[LiveAPI]", detail);
        this.callbacks.onError(
          `Live session ended: ${detail}. If this is immediate, the model id may be wrong or your key may not allow Live API.`
        );
      }
    };
  }

  private handleServerMessage(data: Record<string, unknown>) {
    const errObj = data.error as { message?: string; code?: number } | undefined;
    if (errObj?.message) {
      if (!this.failureNotified) {
        this.failureNotified = true;
        this.callbacks.onError(errObj.message);
      }
      this.callbacks.onConnectionChange(false);
      return;
    }

    // Server confirms setup is ready — now signal the UI
    if (data.setupComplete !== undefined) {
      this.setupComplete = true;
      this.callbacks.onConnectionChange(true);
      return;
    }

    const serverContent = data.serverContent as {
      interrupted?: boolean;
      modelTurn?: { parts?: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> };
      inputTranscription?: { text: string };
      outputTranscription?: { text: string };
      turnComplete?: boolean;
    } | undefined;

    if (serverContent) {
      if (serverContent.interrupted) {
        this.clearPlaybackQueue();
      }

      if (serverContent.modelTurn?.parts) {
        for (const part of serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            this.handleAudioResponse(part.inlineData.data);
          }
          if (part.text) {
            this.currentTranscript += part.text;
          }
        }
      }

      if (serverContent.inputTranscription?.text) {
        this.callbacks.onTranscriptUpdate(
          "user",
          serverContent.inputTranscription.text
        );
      }

      if (serverContent.outputTranscription?.text) {
        this.outputTranscript += serverContent.outputTranscription.text;
      }

      if (serverContent.turnComplete) {
        if (this.outputTranscript.trim()) {
          this.callbacks.onTranscriptUpdate("suspect", this.outputTranscript.trim());
        } else if (this.currentTranscript.trim()) {
          this.callbacks.onTranscriptUpdate("suspect", this.currentTranscript.trim());
        }
        this.currentTranscript = "";
        this.outputTranscript = "";
        this.callbacks.onAudioEnd();
      }
    }
  }

  private clearPlaybackQueue() {
    this.audioQueue = [];
    this.nextPlayTime = 0;
    this.isPlaying = false;
  }

  private handleAudioResponse(base64Data: string) {
    if (!this.isPlaying) {
      this.callbacks.onAudioStart();
      this.isPlaying = true;
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    this.audioQueue.push(float32Array);
    this.playNextAudioChunk();
  }

  private playNextAudioChunk() {
    if (this.audioQueue.length === 0) return;

    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }

    if (this.playbackContext.state === "suspended") {
      void this.playbackContext.resume();
    }

    const chunk = this.audioQueue.shift()!;
    const buffer = this.playbackContext.createBuffer(
      1,
      chunk.length,
      OUTPUT_SAMPLE_RATE
    );
    buffer.getChannelData(0).set(chunk);

    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);

    const now = this.playbackContext.currentTime;
    const startTime = Math.max(now, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;

    source.onended = () => {
      if (this.audioQueue.length === 0) {
        this.isPlaying = false;
      }
    };
  }

  async startRecording() {
    if (this.isRecording || !this.ws) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isRecording || !this.ws) return;

        const inputData = event.inputBuffer.getChannelData(0);

        const resampled = this.resample(
          inputData,
          this.audioContext!.sampleRate,
          INPUT_SAMPLE_RATE
        );

        const int16Data = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64 = this.arrayBufferToBase64(int16Data.buffer);

        // Current Live API format: realtimeInput.audio (not mediaChunks)
        const audioMessage = {
          realtimeInput: {
            audio: {
              data: base64,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        };

        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(audioMessage));
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (error) {
      this.callbacks.onError(
        `Microphone access error: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  stopRecording() {
    this.isRecording = false;

    // Required when automatic voice activity detection is enabled (default): tells the server
    // the mic stream ended so it can finalize the user turn and generate a reply. Without this,
    // mic-only sessions (e.g. interrogation) often get no or sporadic model audio; crime-scene
    // Hayes still works because sendText(image) triggers separate turns.
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              audioStreamEnd: true,
            },
          })
        );
      } catch {
        /* ignore */
      }
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  sendText(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      realtimeInput: {
        text,
      },
    };

    this.ws.send(JSON.stringify(msg));
  }

  disconnect(silent = false) {
    this.stopRecording();

    if (this.ws) {
      if (silent) {
        this.ws.onclose = null;
        this.ws.onerror = null;
      }
      this.ws.close();
      this.ws = null;
    }

    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }

    this.clearPlaybackQueue();
    this.currentTranscript = "";
    this.outputTranscript = "";
    this.setupComplete = false;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  private resample(
    data: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) return data;

    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const lower = Math.floor(srcIndex);
      const upper = Math.min(Math.ceil(srcIndex), data.length - 1);
      const frac = srcIndex - lower;
      result[i] = data[lower] * (1 - frac) + data[upper] * frac;
    }

    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
