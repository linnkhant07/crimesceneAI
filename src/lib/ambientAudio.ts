import type { Setting } from "@/types/game";

const SETTING_CONFIGS: Record<
  Setting,
  {
    baseFreq: number;
    secondFreq: number;
    thirdFreq: number;
    filterFreq: number;
    lfoRate: number;
    noiseLevel: number;
  }
> = {
  "noir-city": {
    baseFreq: 55,
    secondFreq: 82.41,
    thirdFreq: 110,
    filterFreq: 400,
    lfoRate: 0.05,
    noiseLevel: 0.03,
  },
  "medieval-castle": {
    baseFreq: 65.41,
    secondFreq: 98,
    thirdFreq: 130.81,
    filterFreq: 300,
    lfoRate: 0.03,
    noiseLevel: 0.02,
  },
  "space-station": {
    baseFreq: 41.2,
    secondFreq: 73.42,
    thirdFreq: 123.47,
    filterFreq: 600,
    lfoRate: 0.08,
    noiseLevel: 0.04,
  },
  "small-town": {
    baseFreq: 73.42,
    secondFreq: 110,
    thirdFreq: 146.83,
    filterFreq: 350,
    lfoRate: 0.04,
    noiseLevel: 0.015,
  },
};

export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private tensionGain: GainNode | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private isPlaying = false;
  private setting: Setting = "noir-city";

  async start(setting: Setting, volume = 0.15) {
    if (this.isPlaying) this.stop();

    this.setting = setting;
    this.ctx = new AudioContext();
    const config = SETTING_CONFIGS[setting];

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);

    // Drone oscillators
    const freqs = [config.baseFreq, config.secondFreq, config.thirdFreq];
    const gains = [0.3, 0.2, 0.1];

    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i === 0 ? "sawtooth" : "sine";
      osc.frequency.value = freq;

      const oscGain = this.ctx!.createGain();
      oscGain.gain.value = gains[i];

      const filter = this.ctx!.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = config.filterFreq;
      filter.Q.value = 2;

      // LFO for filter sweep
      const lfo = this.ctx!.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = config.lfoRate + i * 0.01;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = config.filterFreq * 0.3;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      osc.connect(oscGain);
      oscGain.connect(filter);
      filter.connect(this.masterGain!);
      osc.start();
      this.oscillators.push(osc, lfo);
    });

    // Filtered noise
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * config.noiseLevel;
    }

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = config.filterFreq * 0.5;
    noiseFilter.Q.value = 0.5;

    this.noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.masterGain);
    this.noiseSource.start();

    // Tension layer (starts silent, can be activated)
    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionGain.connect(this.masterGain);

    this.tensionOsc = this.ctx.createOscillator();
    this.tensionOsc.type = "sine";
    this.tensionOsc.frequency.value = config.baseFreq * 3;
    const tensionFilter = this.ctx.createBiquadFilter();
    tensionFilter.type = "lowpass";
    tensionFilter.frequency.value = 200;
    this.tensionOsc.connect(tensionFilter);
    tensionFilter.connect(this.tensionGain);
    this.tensionOsc.start();

    // Fade in
    this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 2);
    this.isPlaying = true;
  }

  setTension(level: number) {
    if (!this.ctx || !this.tensionGain) return;
    const clamped = Math.max(0, Math.min(1, level));
    this.tensionGain.gain.setTargetAtTime(
      clamped * 0.15,
      this.ctx.currentTime,
      0.5
    );
  }

  setVolume(volume: number) {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      this.ctx.currentTime,
      0.3
    );
  }

  playStinger() {
    if (!this.ctx || !this.masterGain) return;
    const config = SETTING_CONFIGS[this.setting];

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = config.baseFreq * 4;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.frequency.setTargetAtTime(100, this.ctx.currentTime, 1);

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 3);
  }

  stop() {
    if (!this.ctx) return;

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    }

    setTimeout(() => {
      this.oscillators.forEach((o) => {
        try { o.stop(); } catch {}
      });
      try { this.noiseSource?.stop(); } catch {}
      try { this.tensionOsc?.stop(); } catch {}
      try { this.ctx?.close(); } catch {}

      this.oscillators = [];
      this.noiseSource = null;
      this.tensionOsc = null;
      this.tensionGain = null;
      this.masterGain = null;
      this.ctx = null;
      this.isPlaying = false;
    }, 1000);
  }

  get playing() {
    return this.isPlaying;
  }
}

let ambientInstance: AmbientAudio | null = null;

export function getAmbientAudio(): AmbientAudio {
  if (!ambientInstance) {
    ambientInstance = new AmbientAudio();
  }
  return ambientInstance;
}
