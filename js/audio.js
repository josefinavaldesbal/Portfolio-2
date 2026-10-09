// ════════════════════════════════════════════════════════
//  HOSPITAL OLVIDADO — Sistema de Audio
// ════════════════════════════════════════════════════════

/**
 * Gestiona todos los sonidos del juego.
 * Los archivos de audio van en assets/audio/
 * 
 * ARCHIVOS NECESARIOS (agrega tus propios o descárgalos libres de derechos):
 *  ambient.mp3        — Música de fondo de terror (loop)
 *  footstep1.mp3      — Paso 1 (sonido de paso en piso de hospital)
 *  footstep2.mp3      — Paso 2 (alternado con el anterior)
 *  key_pickup.mp3     — Sonido al recoger una llave
 *  door_unlock.mp3    — Sonido al abrir puerta con llave
 *  correct.mp3        — Acertijo correcto
 *  wrong.mp3          — Acertijo incorrecto
 *  win.mp3            — Fanfarria de victoria
 * 
 * FUENTES GRATUITAS recomendadas:
 *  - freesound.org (CC0 / Attribution)
 *  - mixkit.co
 *  - pixabay.com/sound-effects
 */

class AudioManager {
  constructor() {
    this.muted    = false;
    this.ambientVolume = 0.35;
    this.sfxVolume     = 0.7;
    this.footstepToggle = 0; // alterna entre footstep1 y footstep2

    // Referencias a elementos <audio> del DOM
    this.ambient        = document.getElementById('audio-ambient');
    this.footstep1      = document.getElementById('audio-footstep-1');
    this.footstep2      = document.getElementById('audio-footstep-2');
    this.sfxUnlock      = document.getElementById('audio-unlock');
    this.sfxKey         = document.getElementById('audio-key');
    this.sfxCorrect     = document.getElementById('audio-riddle-correct');
    this.sfxWrong       = document.getElementById('audio-riddle-wrong');
    this.sfxJumpscare   = document.getElementById('audio-jumpscare');

    this._setSources();
    this._configureVolumes();
  }

  _setSources() {
    // Intenta cargar cada archivo; si no existe, el elemento queda silencioso
    const trySet = (el, src) => {
      if (!el) return;
      el.src = src;
      el.load();
    };

    trySet(this.ambient,      'assets/audio/ambient.mp3');
    trySet(this.footstep1,    'assets/audio/footstep1.mp3');
    trySet(this.footstep2,    'assets/audio/footstep2.mp3');
    trySet(this.sfxUnlock,    'assets/audio/door_unlock.mp3');
    trySet(this.sfxKey,       'assets/audio/key_pickup.mp3');
    trySet(this.sfxCorrect,   'assets/audio/correct.mp3');
    trySet(this.sfxWrong,     'assets/audio/wrong.mp3');
    trySet(this.sfxJumpscare, 'assets/audio/jumpscare.mp3');
  }

  _configureVolumes() {
    if (this.ambient) {
      this.ambient.volume = this.ambientVolume;
      this.ambient.loop   = true;
    }
    [this.footstep1, this.footstep2, this.sfxUnlock,
     this.sfxKey, this.sfxCorrect, this.sfxWrong, this.sfxJumpscare]
      .forEach(el => { if (el) el.volume = this.sfxVolume; });
  }

  /** Inicia la música ambiental (debe llamarse desde interacción del usuario) */
  startAmbient() {
    if (!this.ambient || this.muted) return;
    this.ambient.play().catch(() => {}); // ignora error autoplay
  }

  /** Alterna mute global */
  toggleMute() {
    this.muted = !this.muted;
    if (this.ambient) {
      this.muted ? this.ambient.pause() : this.ambient.play().catch(() => {});
    }
    return this.muted;
  }

  /** Reproduce un paso de caminar (alterna L/R) */
  playFootstep() {
    if (this.muted) return;
    const step = this.footstepToggle % 2 === 0 ? this.footstep1 : this.footstep2;
    this.footstepToggle++;
    if (!step || !step.src) return;
    step.currentTime = 0;
    step.play().catch(() => {});
  }

  playSFX(name) {
    if (this.muted) return;
    if (name === 'jumpscare') {
      this.playJumpscareScreamer();
      return;
    }
    const map = {
      key:       this.sfxKey,
      unlock:    this.sfxUnlock,
      correct:   this.sfxCorrect,
      wrong:     this.sfxWrong,
      jumpscare: this.sfxJumpscare,
    };
    const el = map[name];
    if (!el || !el.src) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  /**
   * Genera un efecto sonoro de impacto aterrador (Screamer/Jumpscare)
   * Combina audio tag y síntesis Web Audio API (100% garantizada en todos los navegadores)
   */
  playJumpscareScreamer() {
    if (this.muted) return;

    // 1. Audio elemento si existe archivo
    if (this.sfxJumpscare && this.sfxJumpscare.src) {
      this.sfxJumpscare.currentTime = 0;
      this.sfxJumpscare.play().catch(() => {});
    }

    // 2. Síntesis de terror procedural Web Audio API (alarido agudo + sub-bass + ruido blanco)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this._ctx) {
        this._ctx = new AudioCtx();
      }
      if (this._ctx.state === 'suspended') {
        this._ctx.resume();
      }

      const ctx = this._ctx;
      const now = ctx.currentTime;
      const duration = 2.0;

      // Master Gain para el screamer
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, now);
      master.gain.exponentialRampToValueAtTime(0.98, now + 0.02); // Ataque brutal instantáneo
      master.gain.setValueAtTime(0.9, now + 0.85);
      master.gain.exponentialRampToValueAtTime(0.001, now + duration);
      master.connect(ctx.destination);

      // Waveshaper / Saturación no lineal extrema
      const shaper = ctx.createWaveShaper();
      const n_samples = 22050;
      const curve = new Float32Array(n_samples);
      const k = 70;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = '4x';
      shaper.connect(master);

      // Osciladores en frecuencias de alarido agudo disonante
      const screechFreqs = [780, 840, 1150, 1680, 2400];
      screechFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.35, now + duration);

        g.gain.setValueAtTime(0.22 / screechFreqs.length, now);
        osc.connect(g);
        g.connect(shaper);
        osc.start(now);
        osc.stop(now + duration);
      });

      // Impacto sub-grave de conmoción física (pecho)
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(150, now);
      sub.frequency.exponentialRampToValueAtTime(34, now + 0.5);
      subGain.gain.setValueAtTime(0.75, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      sub.connect(subGain);
      subGain.connect(master);
      sub.start(now);
      sub.stop(now + 0.85);

      // Ráfaga de ruido blanco raspado (aliento monstruoso desgarrado)
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(500, now + duration);
      filter.Q.setValueAtTime(5.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(shaper);

      noise.start(now);
      noise.stop(now + duration);
    } catch (err) {
      console.warn('[Audio] Error al reproducir screamer procedural:', err);
    }
  }
}

export const audioManager = new AudioManager();
