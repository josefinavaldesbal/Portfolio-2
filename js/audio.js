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
    this.sfxShadow      = document.getElementById('audio-shadow');

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
    trySet(this.sfxJumpscare, 'assets/audio/jumpscare.wav');
    trySet(this.sfxShadow,    'assets/audio/shadow_whoosh.mp3');
  }

  _configureVolumes() {
    if (this.ambient) {
      this.ambient.volume = 0.45;
      this.ambient.loop   = true;
    }
    [this.footstep1, this.footstep2, this.sfxUnlock,
     this.sfxKey, this.sfxCorrect, this.sfxWrong, this.sfxShadow]
      .forEach(el => { if (el) el.volume = this.sfxVolume; });
    if (this.sfxJumpscare) {
      this.sfxJumpscare.volume = 1.0;
    }
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
      shadow:    this.sfxShadow,
    };
    const el = map[name];
    if (!el || !el.src) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  /** Reproduce el efecto sonoro de una sombra siniestra pasando rápidamente */
  playShadowPass() {
    this.playSFX('shadow');
  }

  /**
   * Genera un efecto sonoro de impacto aterrador: GRITO ESTRIDENTE (Human Horror Scream)
   * Inicia con volumen alto de impacto y cubre toda la duración visual del susto sin cortarse.
   */
  playJumpscareScreamer() {
    if (this.muted) return;

    // 1. Audio elemento pre-renderizado (vocal scream en .wav/.mp3)
    if (this.sfxJumpscare) {
      this.sfxJumpscare.volume = 1.0;
      this.sfxJumpscare.currentTime = 0;
      this.sfxJumpscare.play().catch(() => {});
    }

    // 2. Síntesis acústica de grito humano en Web Audio API (modelo de formantes vocales abiertos)
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
      const duration = 2.3; // Cubre con holgura los 2.0s del susto visual

      // Master Gain: ataque brutal a volumen máximo (1.0) en 12ms, sostenido hasta 1.85s y desvanecimiento suave hasta 2.3s
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, now);
      master.gain.exponentialRampToValueAtTime(1.0, now + 0.012); // Volumen de impacto alto instantáneo
      master.gain.setValueAtTime(0.98, now + 1.85);
      master.gain.exponentialRampToValueAtTime(0.001, now + duration);
      master.connect(ctx.destination);

      // Saturación armónica de cuerdas vocales desgarradas
      const shaper = ctx.createWaveShaper();
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const k = 45;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = '4x';
      shaper.connect(master);

      // --- FILTROS DE FORMANTES VOCALES (Garganta abierta gritando "¡AAAAH / AYYY!") ---
      // F1: Resonancia faríngea (~880 Hz)
      const formant1 = ctx.createBiquadFilter();
      formant1.type = 'bandpass';
      formant1.frequency.setValueAtTime(880, now);
      formant1.Q.setValueAtTime(5.5, now);

      // F2: Resonancia oral (~1550 Hz)
      const formant2 = ctx.createBiquadFilter();
      formant2.type = 'bandpass';
      formant2.frequency.setValueAtTime(1550, now);
      formant2.Q.setValueAtTime(6.0, now);

      // F3: Formante estridente del grito ("Singer's/Screamer's cluster" ~2950 Hz - penetrante)
      const formant3 = ctx.createBiquadFilter();
      formant3.type = 'bandpass';
      formant3.frequency.setValueAtTime(2950, now);
      formant3.Q.setValueAtTime(7.0, now);

      // F4: Agudos de tensión vocal (~3900 Hz)
      const formant4 = ctx.createBiquadFilter();
      formant4.type = 'bandpass';
      formant4.frequency.setValueAtTime(3900, now);
      formant4.Q.setValueAtTime(8.0, now);

      const vocalBus = ctx.createGain();
      vocalBus.gain.setValueAtTime(1.1, now);

      // Conectar formantes al saturador
      formant1.connect(vocalBus);
      formant2.connect(vocalBus);
      formant3.connect(vocalBus);
      formant4.connect(vocalBus);
      vocalBus.connect(shaper);

      // --- FUENTE GLOTAL: Osciladores vocales con modulación áspera (roughness) ---
      // LFO de aspereza vocal (frecuencia de choque 55 Hz para simular rotura de cuerdas vocales)
      const lfoRoughness = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfoRoughness.frequency.setValueAtTime(55, now);
      lfoGain.gain.setValueAtTime(120, now); // Modulación profunda
      lfoRoughness.connect(lfoGain);
      lfoRoughness.start(now);
      lfoRoughness.stop(now + duration);

      // Oscilador fundamental F0 (agudo, 780 Hz inicial con subida de terror a 1020 Hz y descenso agónico a 680 Hz)
      const voiceOsc1 = ctx.createOscillator();
      voiceOsc1.type = 'sawtooth';
      voiceOsc1.frequency.setValueAtTime(780, now);
      voiceOsc1.frequency.exponentialRampToValueAtTime(1020, now + 0.12);
      voiceOsc1.frequency.exponentialRampToValueAtTime(860, now + 1.2);
      voiceOsc1.frequency.exponentialRampToValueAtTime(680, now + duration);
      lfoGain.connect(voiceOsc1.frequency);

      const voiceGain1 = ctx.createGain();
      voiceGain1.gain.setValueAtTime(0.55, now);
      voiceOsc1.connect(voiceGain1);
      voiceGain1.connect(formant1);
      voiceGain1.connect(formant2);
      voiceGain1.connect(formant3);
      voiceGain1.connect(formant4);
      voiceOsc1.start(now);
      voiceOsc1.stop(now + duration);

      // Oscilador armónico desfasado (simula desgarre de registro agudo / biphonación)
      const voiceOsc2 = ctx.createOscillator();
      voiceOsc2.type = 'sawtooth';
      voiceOsc2.frequency.setValueAtTime(1180, now);
      voiceOsc2.frequency.exponentialRampToValueAtTime(1520, now + 0.15);
      voiceOsc2.frequency.exponentialRampToValueAtTime(1250, now + 1.3);
      voiceOsc2.frequency.exponentialRampToValueAtTime(920, now + duration);

      const voiceGain2 = ctx.createGain();
      voiceGain2.gain.setValueAtTime(0.4, now);
      voiceOsc2.connect(voiceGain2);
      voiceGain2.connect(formant2);
      voiceGain2.connect(formant3);
      voiceGain2.connect(formant4);
      voiceOsc2.start(now);
      voiceOsc2.stop(now + duration);

      // --- TURBULENCIA DE ALIENTO AGÓNICO (Ruido de aire desgarrado) ---
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.2);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(noiseGain);
      noiseGain.connect(formant2);
      noiseGain.connect(formant3);
      noiseGain.connect(formant4);
      noise.start(now);
      noise.stop(now + duration);

      // --- GOLPE DE IMPACTO SUB-GRAVE AL PECHO (Shock físico en t=0) ---
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(120, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.45);
      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      sub.connect(subGain);
      subGain.connect(master);
      sub.start(now);
      sub.stop(now + 0.8);
    } catch (err) {
      console.warn('[Audio] Error al reproducir grito estridente:', err);
    }
  }
}

export const audioManager = new AudioManager();
