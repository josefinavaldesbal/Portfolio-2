// ════════════════════════════════════════════════════════
//  Generador de Audio de Terror Atmosférico en WAV (Node.js)
// ════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const audioDir = path.join(__dirname, '..', 'assets', 'audio');

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

/**
 * Crea un Buffer con formato WAV PCM 16-bit
 */
function createWavBuffer(sampleRate, channels, samples) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audio format (1 = PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bits per sample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to -1.0 .. 1.0
    let s = Math.max(-1.0, Math.min(1.0, samples[i]));
    let intVal = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(intVal), offset);
    offset += 2;
  }

  return buffer;
}

// ── 1. AMBIENTE DE TERROR (Música de fondo cinemática, 45 segundos, loop continuo) ──
function generateHorrorAmbient() {
  const sampleRate = 32000;
  const duration = 40.0; // 40 segundos loopable
  const totalSamples = Math.floor(sampleRate * duration);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  console.log('Sintetizando banda sonora ambiental de terror (40s)...');

  // Capa 1: Sub-drone oscuro con batimiento binaural (45Hz izquierda, 48Hz derecha)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const lfoPitch = Math.sin(t * 0.1) * 2.5;
    const droneL = Math.sin(2 * Math.PI * (45.0 + lfoPitch) * t) * 0.32;
    const droneR = Math.sin(2 * Math.PI * (47.8 + lfoPitch) * t) * 0.32;
    const subL = Math.sin(2 * Math.PI * 30.0 * t) * 0.22;
    left[i] += droneL + subL;
    right[i] += droneR + subL;
  }

  // Capa 2: Acordes de tensión disonantes (Tritono Eb/A y notas fantasma) con trémolo lento
  const chords = [
    { freq: 110.0, pan: -0.2, amp: 0.14 }, // A2
    { freq: 155.56, pan: 0.25, amp: 0.12 }, // Eb3 (Tritono)
    { freq: 164.81, pan: -0.3, amp: 0.10 }, // E3 (segunda menor)
    { freq: 220.0, pan: 0.15, amp: 0.08 }, // A3
    { freq: 311.13, pan: -0.1, amp: 0.06 }  // Eb4
  ];

  chords.forEach(({ freq, pan, amp }, chordIndex) => {
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const swell = Math.sin(t * 0.25 + chordIndex * 1.3) * 0.5 + 0.5;
      const drift = Math.sin(t * 0.08 + chordIndex) * 0.8;
      const val = Math.sin(2 * Math.PI * (freq + drift) * t) * amp * swell;
      left[i] += val * (1 - pan * 0.5);
      right[i] += val * (1 + pan * 0.5);
    }
  });

  // Capa 3: Viento oscuro y susurros de aire frío (filtro paso banda de ruido)
  let noiseFilterL = 0;
  let noiseFilterR = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const windIntensity = (Math.sin(t * 0.2) * 0.5 + 0.5) * (Math.sin(t * 0.55) * 0.3 + 0.7);
    const whiteNoise = (Math.random() * 2 - 1) * 0.07 * windIntensity;
    noiseFilterL = noiseFilterL * 0.94 + whiteNoise * 0.06;
    noiseFilterR = noiseFilterR * 0.93 + whiteNoise * 0.07;
    left[i] += noiseFilterL;
    right[i] += noiseFilterR;
  }

  // Capa 4: Latido cardíaco sordo y lejano (a ~52 bpm = cada 1.15 segundos)
  const bpmInterval = sampleRate * 1.15;
  for (let start = 0; start < totalSamples; start += bpmInterval) {
    const beatSamples = Math.floor(sampleRate * 0.35);
    for (let j = 0; j < beatSamples && (start + j) < totalSamples; j++) {
      const bt = j / sampleRate;
      const env = Math.exp(-bt * 14.0);
      const thump1 = Math.sin(2 * Math.PI * (48 - bt * 20) * bt) * 0.22 * env;
      left[start + j] += thump1;
      right[start + j] += thump1;

      // Segundo pulso de latido (lub-dub)
      const secondPulse = Math.floor(sampleRate * 0.16);
      if (j >= secondPulse) {
        const bt2 = (j - secondPulse) / sampleRate;
        const env2 = Math.exp(-bt2 * 16.0);
        const thump2 = Math.sin(2 * Math.PI * (44 - bt2 * 18) * bt2) * 0.18 * env2;
        left[start + j] += thump2;
        right[start + j] += thump2;
      }
    }
  }

  // Capa 5: Ecos metálicos distantes de hospital (gotas / tuberías chirriantes)
  const metallicEvents = [6.2, 14.8, 23.5, 33.1];
  metallicEvents.forEach((sec, idx) => {
    const startSample = Math.floor(sec * sampleRate);
    const metalLen = Math.floor(sampleRate * 2.8);
    const pan = idx % 2 === 0 ? -0.4 : 0.4;
    for (let j = 0; j < metalLen && (startSample + j) < totalSamples; j++) {
      const mt = j / sampleRate;
      const decay = Math.exp(-mt * 2.2);
      const chime = (
        Math.sin(2 * Math.PI * 440 * mt) * 0.04 +
        Math.sin(2 * Math.PI * 780 * mt) * 0.035 +
        Math.sin(2 * Math.PI * 1220 * mt) * 0.02 +
        Math.sin(2 * Math.PI * 1890 * mt) * 0.015
      ) * decay;
      left[startSample + j] += chime * (1 - pan);
      right[startSample + j] += chime * (1 + pan);
    }
  });

  // Crossfade de 2.5 segundos en los extremos para que el loop sea 100% imperceptible
  const crossfadeLen = Math.floor(sampleRate * 2.5);
  for (let i = 0; i < crossfadeLen; i++) {
    const alpha = i / crossfadeLen;
    const endIdx = totalSamples - crossfadeLen + i;
    left[i] = left[i] * alpha + left[endIdx] * (1 - alpha);
    right[i] = right[i] * alpha + right[endIdx] * (1 - alpha);
  }

  // Interleaving estéreo
  const interleaved = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    // Soft clipping
    const l = Math.tanh(left[i] * 1.15) * 0.85;
    const r = Math.tanh(right[i] * 1.15) * 0.85;
    interleaved[i * 2]     = l;
    interleaved[i * 2 + 1] = r;
  }

  const wavBuf = createWavBuffer(sampleRate, 2, interleaved);
  fs.writeFileSync(path.join(audioDir, 'ambient.wav'), wavBuf);
  fs.writeFileSync(path.join(audioDir, 'ambient.mp3'), wavBuf); // Copia como mp3 para navegadores que buscan .mp3
  console.log('✅ assets/audio/ambient.wav generado con éxito (' + (wavBuf.length / 1024 / 1024).toFixed(2) + ' MB)');
}

// ── 2. PASOS EN BALDOSAS DE HOSPITAL (Footstep 1 y 2) ──────────────────────────
function generateFootsteps() {
  const sampleRate = 22050;
  const duration = 0.32;
  const totalSamples = Math.floor(sampleRate * duration);

  [1, 2].forEach(stepNum => {
    const samples = new Float32Array(totalSamples);
    const baseFreq = stepNum === 1 ? 75 : 82;
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 22.0);
      const thud = Math.sin(2 * Math.PI * (baseFreq - t * 60) * t) * 0.7 * env;
      const grit = (Math.random() * 2 - 1) * Math.exp(-t * 38.0) * 0.25;
      samples[i] = thud + grit;
    }
    const wavBuf = createWavBuffer(sampleRate, 1, samples);
    fs.writeFileSync(path.join(audioDir, `footstep${stepNum}.wav`), wavBuf);
    fs.writeFileSync(path.join(audioDir, `footstep${stepNum}.mp3`), wavBuf);
  });
  console.log('✅ assets/audio/footstep1 y footstep2 generados');
}

// ── 3. EFECTO SONORO DE SOMBRA PASANDO (Whoosh espectral siniestro) ───────────
function generateShadowWhoosh() {
  const sampleRate = 32000;
  const duration = 1.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  let noiseFilter = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Panning de izquierda a derecha rápidamente
    const pan = (t / duration) * 2 - 1; // de -1 a +1
    // Curva de volumen (aparece rápido y se disipa)
    const env = Math.sin((t / duration) * Math.PI);
    const rawNoise = (Math.random() * 2 - 1) * 0.35;
    noiseFilter = noiseFilter * 0.88 + rawNoise * 0.12;

    const lowRush = Math.sin(2 * Math.PI * (55 + Math.sin(t * 8) * 15) * t) * 0.35;
    const whisperPitch = Math.sin(2 * Math.PI * (340 + t * 120) * t) * 0.12;
    const val = (noiseFilter + lowRush + whisperPitch) * env * 1.2;

    left[i]  = val * Math.max(0, 1 - pan);
    right[i] = val * Math.max(0, 1 + pan);
  }

  const interleaved = new Float32Array(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    interleaved[i * 2]     = Math.tanh(left[i]) * 0.9;
    interleaved[i * 2 + 1] = Math.tanh(right[i]) * 0.9;
  }

  const wavBuf = createWavBuffer(sampleRate, 2, interleaved);
  fs.writeFileSync(path.join(audioDir, 'shadow_whoosh.wav'), wavBuf);
  fs.writeFileSync(path.join(audioDir, 'shadow_whoosh.mp3'), wavBuf);
  console.log('✅ assets/audio/shadow_whoosh generado');
}

// ── 4. SFX COMPLEMENTARIOS (Llaves y aciertos si hicieran falta) ───────────────
function generateComplementarySFX() {
  const sampleRate = 22050;

  // Llave recogiendo (tintineo metálico agudo)
  {
    const dur = 0.8;
    const samples = new Float32Array(Math.floor(sampleRate * dur));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 6);
      samples[i] = (
        Math.sin(2 * Math.PI * 1850 * t) * 0.35 +
        Math.sin(2 * Math.PI * 2420 * t) * 0.25 +
        Math.sin(2 * Math.PI * 3180 * t) * 0.15
      ) * env;
    }
    const buf = createWavBuffer(sampleRate, 1, samples);
    fs.writeFileSync(path.join(audioDir, 'key_pickup.wav'), buf);
    fs.writeFileSync(path.join(audioDir, 'key_pickup.mp3'), buf);
  }

  // Desbloqueo / Apertura de cerradura pesada
  {
    const dur = 1.0;
    const samples = new Float32Array(Math.floor(sampleRate * dur));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 4);
      const click = (t < 0.08 ? (Math.random() * 2 - 1) * 0.6 : 0);
      const clang = Math.sin(2 * Math.PI * 220 * t) * 0.4 * env;
      samples[i] = click + clang;
    }
    const buf = createWavBuffer(sampleRate, 1, samples);
    fs.writeFileSync(path.join(audioDir, 'door_unlock.wav'), buf);
    fs.writeFileSync(path.join(audioDir, 'door_unlock.mp3'), buf);
  }

  // Respuesta correcta
  {
    const dur = 1.2;
    const samples = new Float32Array(Math.floor(sampleRate * dur));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 3.5);
      const chord = (
        Math.sin(2 * Math.PI * 523.25 * t) * 0.25 + // C5
        Math.sin(2 * Math.PI * 659.25 * t) * 0.25 + // E5
        Math.sin(2 * Math.PI * 783.99 * t) * 0.25   // G5
      ) * env;
      samples[i] = chord;
    }
    const buf = createWavBuffer(sampleRate, 1, samples);
    fs.writeFileSync(path.join(audioDir, 'correct.wav'), buf);
    fs.writeFileSync(path.join(audioDir, 'correct.mp3'), buf);
  }

  // Respuesta incorrecta
  {
    const dur = 0.9;
    const samples = new Float32Array(Math.floor(sampleRate * dur));
    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 4);
      const buzz = Math.sin(2 * Math.PI * 92 * t) * 0.4 * env + (Math.random() * 2 - 1) * 0.1 * env;
      samples[i] = buzz;
    }
    const buf = createWavBuffer(sampleRate, 1, samples);
    fs.writeFileSync(path.join(audioDir, 'wrong.wav'), buf);
    fs.writeFileSync(path.join(audioDir, 'wrong.mp3'), buf);
  }

  console.log('✅ SFX complementarios generados');
}

generateHorrorAmbient();
generateFootsteps();
generateShadowWhoosh();
generateComplementarySFX();
console.log('🎉 Todos los audios de terror han sido generados satisfactoriamente.');
