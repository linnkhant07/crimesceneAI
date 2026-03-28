const LIVE_API_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MODEL = "gemini-3.1-flash-live-preview";
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

const SUSPECT_VOICES = ["Charon", "Kore", "Fenrir"];

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
  private playbackContext: AudioContext | null = null;
  private nextPlayTime = 0;

  constructor(callbacks: LiveApiCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(apiKey: string, systemPrompt: string, suspectIndex: number) {
    this.disconnect();

    const url = `${LIVE_API_WS_URL}?key=${apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      const voiceName = SUSPECT_VOICES[suspectIndex % SUSPECT_VOICES.length];

      const configMessage = {
        setup: {
          model: `models/${MODEL}`,
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
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
            },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      };

      this.ws!.send(JSON.stringify(configMessage));
      this.callbacks.onConnectionChange(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError("WebSocket connection error");
      this.callbacks.onConnectionChange(false);
    };

    this.ws.onclose = () => {
      this.callbacks.onConnectionChange(false);
    };
  }

  private handleServerMessage(data: Record<string, unknown>) {
    const serverContent = data.serverContent as {
      modelTurn?: { parts?: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> };
      inputTranscription?: { text: string };
      outputTranscription?: { text: string };
      turnComplete?: boolean;
    } | undefined;

    if (serverContent) {
      if (serverContent.modelTurn?.parts) {
        for (const part of serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            this.handleAudioResponse(part.inlineData.data);
          }
          if (part.text) {
            this.currentTranscript += part.text;
            this.callbacks.onTranscriptUpdate("suspect", this.currentTranscript);
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
        this.callbacks.onTranscriptUpdate(
          "suspect",
          serverContent.outputTranscription.text
        );
      }

      if (serverContent.turnComplete) {
        this.currentTranscript = "";
        this.callbacks.onAudioEnd();
      }
    }
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

      // ScriptProcessorNode for capturing raw audio
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isRecording || !this.ws) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Resample to 16kHz if needed
        const resampled = this.resample(
          inputData,
          this.audioContext!.sampleRate,
          INPUT_SAMPLE_RATE
        );

        // Convert Float32 to Int16
        const int16Data = new Int16Array(resampled.length);
        for (let i = 0; i < resampled.length; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64 = this.arrayBufferToBase64(int16Data.buffer);

        const audioMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                data: base64,
                mimeType: "audio/pcm;rate=16000",
              },
            ],
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
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(msg));
  }

  disconnect() {
    this.stopRecording();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
    this.currentTranscript = "";
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
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
