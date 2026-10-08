// ============================================================
// Audio.js — синтез звуков и музыки через Web Audio API
// Все звуки генерируются программно (без mp3/wav).
// ============================================================

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.currentMusicStep = 0;

    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn('Web Audio API недоступен:', e);
    }
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }
  setSfxVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  // ------------------------------------------------------------
  // Базовые тоны
  // ------------------------------------------------------------
  tone({ freq = 440, duration = 0.15, type = 'sine', volume = 0.3, attack = 0.01, release = 0.1, target = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(target || this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + release);
  }

  sweep({ from = 220, to = 880, duration = 0.3, type = 'sine', volume = 0.3 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  noise({ duration = 0.4, volume = 0.3, filterFreq = 800 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration);
  }

  // Мягкий тон для музыки — длинная атака, фильтр
  _softTone({ freq, duration = 1.5, type = 'sine', volume = 0.1, target = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(target || this.musicGain);
    osc.start(t);
    osc.stop(t + duration + 0.2);
  }

  // ------------------------------------------------------------
  // SFX
  // ------------------------------------------------------------
  playJump() { this.sweep({ from: 300, to: 700, duration: 0.18, type: 'square', volume: 0.25 }); }
  playLand() { this.tone({ freq: 120, duration: 0.1, type: 'sine', volume: 0.2 }); }
  playDash() { this.sweep({ from: 800, to: 200, duration: 0.25, type: 'sawtooth', volume: 0.2 }); }
  playDoubleJump() {
    this.tone({ freq: 880, duration: 0.15, type: 'sine', volume: 0.25 });
    setTimeout(() => this.tone({ freq: 1320, duration: 0.2, type: 'sine', volume: 0.2 }), 80);
  }
  playKeyPickup() {
    this.tone({ freq: 660, duration: 0.1, type: 'triangle', volume: 0.25 });
    setTimeout(() => this.tone({ freq: 990, duration: 0.15, type: 'triangle', volume: 0.2 }), 80);
  }
  playCrystalPickup() { this.tone({ freq: 1200, duration: 0.12, type: 'sine', volume: 0.2 }); }
  playButtonPress() { this.tone({ freq: 200, duration: 0.08, type: 'square', volume: 0.25 }); }
  playDoorOpen() {
    this.sweep({ from: 200, to: 800, duration: 0.4, type: 'triangle', volume: 0.25 });
  }
  playDeath() {
    this.noise({ duration: 0.5, volume: 0.35, filterFreq: 400 });
    this.sweep({ from: 400, to: 80, duration: 0.5, type: 'sawtooth', volume: 0.2 });
  }
  playWin() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => {
      this.tone({ freq: f, duration: 0.25, type: 'triangle', volume: 0.3 });
    }, i * 120));
  }
  playLose() {
    const notes = [440, 370, 294, 220];
    notes.forEach((f, i) => setTimeout(() => {
      this.tone({ freq: f, duration: 0.4, type: 'sine', volume: 0.25 });
    }, i * 200));
  }
  playStar(i = 0) {
    const freqs = [880, 1100, 1320];
    this.tone({ freq: freqs[i % 3], duration: 0.25, type: 'triangle', volume: 0.3 });
  }
  playUIClick() { this.tone({ freq: 500, duration: 0.05, type: 'square', volume: 0.2 }); }
  playUIHover() { this.tone({ freq: 700, duration: 0.03, type: 'sine', volume: 0.1 }); }

  // ------------------------------------------------------------
  // Музыка — спокойный эмбиент
  // ------------------------------------------------------------
  playMenuMusic() {
    this.stopMusic();
    const notes = [
      293.66, 349.23, 440.00, 523.25, 587.33, 523.25, 440.00, 349.23,
    ];
    let i = 0;
    const tick = () => {
      if (!this.ctx) return;
      const f = notes[i % notes.length];
      this._softTone({ freq: f, duration: 2.2, type: 'sine', volume: 0.09 });
      if (i % 4 === 0) {
        this._softTone({ freq: f / 4, duration: 3.5, type: 'sine', volume: 0.06 });
      }
      if (i % 6 === 3) {
        this._softTone({ freq: f * 2, duration: 1.8, type: 'triangle', volume: 0.04 });
      }
      i++;
    };
    tick();
    this.musicTimer = setInterval(tick, 900);
  }

  playLevelMusic(levelIndex = 0) {
    this.stopMusic();
    const scales = [
      [261.63, 329.63, 392.00, 523.25],
      [293.66, 349.23, 440.00, 587.33],
      [329.63, 392.00, 493.88, 659.25],
      [349.23, 440.00, 523.25, 698.46],
      [392.00, 493.88, 587.33, 783.99],
      [220.00, 261.63, 329.63, 440.00],
      [246.94, 293.66, 369.99, 493.88],
      [277.18, 349.23, 415.30, 554.37],
      [311.13, 392.00, 466.16, 622.25],
      [369.99, 440.00, 554.37, 739.99],
      [415.30, 493.88, 622.25, 830.61],
      [261.63, 311.13, 392.00, 466.16],
    ];
    const scale = scales[levelIndex % scales.length];
    const seq = [scale[0], scale[1], scale[2], scale[3], scale[2], scale[1]];
    let i = 0;
    const tick = () => {
      if (!this.ctx) return;
      const f = seq[i % seq.length];
      this._softTone({ freq: f, duration: 2.0, type: 'sine', volume: 0.08 });
      if (i % 3 === 0) {
        this._softTone({ freq: f / 2, duration: 3.0, type: 'sine', volume: 0.05 });
      }
      i++;
    };
    tick();
    this.musicTimer = setInterval(tick, 1100);
  }

  playCutsceneMusic() {
    this.stopMusic();
    const chords = [
      [261.63, 329.63, 392.00],
      [349.23, 440.00, 523.25],
      [392.00, 493.88, 587.33],
      [261.63, 329.63, 392.00],
    ];
    let i = 0;
    const tick = () => {
      if (!this.ctx) return;
      const chord = chords[i % chords.length];
      for (const f of chord) {
        this._softTone({ freq: f, duration: 3.0, type: 'sine', volume: 0.06 });
      }
      this._softTone({ freq: chord[0] / 2, duration: 3.2, type: 'sine', volume: 0.05 });
      i++;
    };
    tick();
    this.musicTimer = setInterval(tick, 3200);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}