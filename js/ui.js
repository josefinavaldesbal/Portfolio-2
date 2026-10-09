// ════════════════════════════════════════════════════════
//  HOSPITAL OLVIDADO — Interfaz de Usuario (UI)
// ════════════════════════════════════════════════════════

import { PORTFOLIO_ITEMS, RIDDLES } from './data.js';
import { audioManager }             from './audio.js';

export class UIManager {
  constructor(onStartGame, onRestart, onStartVR) {
    this.onStartGame = onStartGame;
    this.onRestart   = onRestart;
    this.onStartVR   = onStartVR;

    // Estado del juego
    this.collectedKeys   = new Set();
    this.unlockedWorks   = new Set();
    this.totalWorks      = PORTFOLIO_ITEMS.length;
    this.activeRiddle    = null;

    // Sistema de vidas e intentos por tótem
    this.MAX_ATTEMPTS    = 3;
    this.totemAttempts   = new Map();
    this.totemCooldowns  = new Map();
    this.currentAttempts = 3;
    this._notifTimeout   = null;

    this._buildKeySlots();
    this._bindButtons();
    this._updateProgress();
  }

  // ── SLOTS DE LLAVES EN HUD ───────────────────────────────
  _buildKeySlots() {
    const container = document.getElementById('key-slots');
    if (!container) return;
    PORTFOLIO_ITEMS.forEach(item => {
      const slot = document.createElement('div');
      slot.className = 'key-slot';
      slot.id        = `key-slot-${item.id}`;
      slot.title     = item.room;
      slot.textContent = '🗝';
      container.appendChild(slot);
    });
  }

  // ── BINDING DE BOTONES ───────────────────────────────────
  _bindButtons() {
    // Botón inicio
    document.getElementById('btn-start')?.addEventListener('click', () => {
      audioManager.startAmbient();
      this.onStartGame();
    });

    // Botones WebXR VR (pantalla de inicio y HUD)
    document.getElementById('btn-vr-intro')?.addEventListener('click', () => {
      this.onStartVR?.();
    });
    document.getElementById('btn-vr-hud')?.addEventListener('click', () => {
      this.onStartVR?.();
    });

    // Mute
    document.getElementById('btn-mute')?.addEventListener('click', () => {
      const muted = audioManager.toggleMute();
      const btn = document.getElementById('btn-mute');
      if (btn) btn.textContent = muted ? '🔇' : '🔊';
    });

    // Riddle: enviar respuesta
    document.getElementById('btn-riddle-submit')?.addEventListener('click', () => {
      this._submitRiddle();
    });

    // Riddle: cerrar sin responder
    document.getElementById('btn-riddle-close')?.addEventListener('click', () => {
      this.closeRiddle();
    });

    // Portfolio: cerrar
    document.getElementById('btn-portfolio-close')?.addEventListener('click', () => {
      this.closePortfolio();
    });

    // Pausa: continuar
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.closePause();
    });

    // Pausa: reiniciar
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.closePause();
      this.onRestart();
    });

    // Jugar de nuevo en pantalla de victoria
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.onRestart();
    });

    // Tecla E para responder riddle con Enter
    document.getElementById('riddle-input')?.addEventListener('keydown', e => {
      if (e.code === 'Enter') this._submitRiddle();
    });

    // Opciones del riddle — delegación de eventos
    document.getElementById('riddle-options')?.addEventListener('click', e => {
      const btn = e.target.closest('.riddle-option');
      if (!btn) return;
      const answer = btn.dataset.answer;
      this._checkAnswer(answer);
    });
  }

  // ── PANTALLAS ────────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }

  // ── PANTALLA DE CARGA ────────────────────────────────────
  setLoadingProgress(percent, text) {
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('loading-text');
    if (bar) bar.style.width = `${percent}%`;
    if (txt) txt.textContent = text;
  }

  // ── GESTIÓN DE ENFRIAMIENTO Y NOTIFICACIONES ───────────────
  isTotemOnCooldown(workId) {
    const end = this.totemCooldowns.get(workId);
    return end ? Date.now() < end : false;
  }

  getTotemCooldownSeconds(workId) {
    const end = this.totemCooldowns.get(workId) || 0;
    return Math.max(0, Math.ceil((end - Date.now()) / 1000));
  }

  setTotemCooldown(workId, durationMs = 12000) {
    this.totemCooldowns.set(workId, Date.now() + durationMs);
  }

  showNotification(msg, duration = 4000) {
    const el = document.getElementById('hud-notification');
    if (!el) return;
    el.innerHTML = msg;
    el.classList.remove('hidden');
    el.classList.add('visible');
    clearTimeout(this._notifTimeout);
    this._notifTimeout = setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.classList.add('hidden'), 350);
    }, duration);
  }

  _renderLives() {
    for (let i = 0; i < this.MAX_ATTEMPTS; i++) {
      const skull = document.getElementById(`life-${i}`);
      if (!skull) continue;
      if (i < this.currentAttempts) {
        skull.className = 'life-skull active';
      } else {
        skull.className = 'life-skull lost';
      }
    }
  }

  // ── ABRIR ACERTIJO ────────────────────────────────────────
  openRiddle(workId, engine) {
    // Si ya fue desbloqueado, mostrar el portafolio directamente
    if (this.unlockedWorks.has(workId)) {
      this.openPortfolio(workId);
      return false; // no necesita bloquear controles de nuevo
    }

    // Si el tótem está en enfriamiento por fallo de acertijo (screamer)
    if (this.isTotemOnCooldown(workId)) {
      const left = this.getTotemCooldownSeconds(workId);
      this.showNotification(`⚠️ Tótem sellado por la entidad. Espera ${left}s...`);
      return false;
    }

    const riddle = RIDDLES.find(r => r.workId === workId);
    if (!riddle) return false;

    this.activeRiddle = riddle;

    // Inicializar o recuperar intentos disponibles (máx 3)
    if (!this.totemAttempts.has(workId)) {
      this.totemAttempts.set(workId, this.MAX_ATTEMPTS);
    }
    this.currentAttempts = this.totemAttempts.get(workId);

    // Actualizar indicador visual de calaveras (3 vidas)
    this._renderLives();

    // Rellenar el modal
    const item = PORTFOLIO_ITEMS.find(p => p.id === workId);
    document.getElementById('riddle-title').textContent =
      item ? item.room : 'Expediente Clínico';

    const qEl = document.getElementById('riddle-question');
    if (qEl) {
      qEl.innerHTML = `<em style="color:var(--text-dim);font-size:0.85rem">${riddle.narrative}</em><br><br>${riddle.question}`;
    }

    // Limpiar opciones anteriores y reactivar inputs/botones
    const optEl     = document.getElementById('riddle-options');
    const inputEl   = document.getElementById('riddle-input');
    const feedEl    = document.getElementById('riddle-feedback');
    const submitBtn = document.getElementById('btn-riddle-submit');
    const closeBtn  = document.getElementById('btn-riddle-close');

    if (submitBtn) submitBtn.disabled = false;
    if (closeBtn)  closeBtn.disabled = false;

    optEl.innerHTML    = '';
    feedEl.textContent = '';
    feedEl.className   = 'feedback hidden';
    inputEl.value      = '';
    inputEl.disabled   = false;

    if (riddle.type === 'multiple') {
      inputEl.classList.add('hidden');
      // Mezclar opciones aleatoriamente
      const shuffled = [...riddle.options].sort(() => Math.random() - 0.5);
      shuffled.forEach(opt => {
        const btn = document.createElement('button');
        btn.className      = 'riddle-option';
        btn.dataset.answer = opt;
        btn.textContent    = opt;
        optEl.appendChild(btn);
      });
    } else {
      inputEl.classList.remove('hidden');
      setTimeout(() => inputEl.focus(), 100);
    }

    document.getElementById('modal-riddle')?.classList.remove('hidden');
    engine?.unlockPointer();
    return true;
  }

  _submitRiddle() {
    if (!this.activeRiddle) return;
    if (this.activeRiddle.type === 'text') {
      const answer = document.getElementById('riddle-input')?.value.trim();
      this._checkAnswer(answer);
    }
    // Para multiple, se maneja en el click de opción
  }

  _checkAnswer(answer) {
    if (!this.activeRiddle) return;
    const workId  = this.activeRiddle.workId;
    const correct = this.activeRiddle.answer.toLowerCase().trim();
    const given   = (answer ?? '').toLowerCase().trim();

    const feedEl = document.getElementById('riddle-feedback');

    if (given === correct) {
      // ✅ RESPUESTA CORRECTA
      audioManager.playSFX('correct');
      this.totemAttempts.set(workId, this.MAX_ATTEMPTS); // Resetear intentos al ganar

      if (feedEl) {
        feedEl.innerHTML = `<span style="color:#7dd88a;font-weight:bold;font-size:1rem">✓ ¡ACERTIJO RESUELTO!</span><br>${this.activeRiddle.correctMsg}<br><span style="color:#d4af37;font-size:0.85rem">🔓 Desbloqueando expediente clínico...</span>`;
        feedEl.className   = 'feedback correct';
        feedEl.classList.remove('hidden');
      }

      // Resaltar opción seleccionada y bloquear las demás
      document.querySelectorAll('.riddle-option').forEach(btn => {
        if (btn.dataset.answer === answer) {
          btn.classList.add('correct');
        } else {
          btn.style.opacity = '0.35';
          btn.disabled = true;
        }
      });

      setTimeout(() => {
        this.closeRiddle();
        this._showLoadingTransition(workId, () => {
          this._collectKey(workId);
        });
      }, 950);

    } else {
      // ❌ RESPUESTA INCORRECTA — RESTAR 1 INTENTO
      this.currentAttempts--;
      this.totemAttempts.set(workId, this.currentAttempts);

      // Animar agotamiento sobre la calavera correspondiente (de derecha a izquierda)
      const lostSkull = document.getElementById(`life-${this.currentAttempts}`);
      if (lostSkull) {
        lostSkull.className = 'life-skull lost';
      }

      // Sacudida visual de la caja del acertijo
      const box = document.querySelector('.riddle-content');
      box?.classList.add('riddle-shake');
      setTimeout(() => box?.classList.remove('riddle-shake'), 450);

      // Resaltar opción seleccionada errónea
      document.querySelectorAll('.riddle-option').forEach(btn => {
        if (btn.dataset.answer === answer) {
          btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 900);
        }
      });

      if (this.currentAttempts > 0) {
        // Aún le quedan intentos (2 o 1)
        audioManager.playSFX('wrong');
        if (feedEl) {
          feedEl.innerHTML = `✕ Respuesta incorrecta. <span style="color:#ff7777;font-weight:bold">Intentos restantes: ${this.currentAttempts}/3</span>`;
          feedEl.className = 'feedback wrong';
          feedEl.classList.remove('hidden');
        }
      } else {
        // 💀 0 INTENTOS (Condición de fallo y activación del screamer)
        // 1. Bloquear inmediatamente todos los inputs
        document.querySelectorAll('.riddle-option').forEach(btn => {
          btn.disabled = true;
        });
        const inputEl = document.getElementById('riddle-input');
        if (inputEl) inputEl.disabled = true;
        const submitBtn = document.getElementById('btn-riddle-submit');
        if (submitBtn) submitBtn.disabled = true;
        const closeBtn = document.getElementById('btn-riddle-close');
        if (closeBtn) closeBtn.disabled = true;

        if (feedEl) {
          feedEl.innerHTML = `<span style="color:#ff2222;font-weight:bold;font-size:0.95rem">⚠️ ¡SIN INTENTOS RESTANTES! ALGO TE HA DETECTADO...</span>`;
          feedEl.className = 'feedback wrong';
          feedEl.classList.remove('hidden');
        }

        // 2. Disparar el evento de fallo con screamer/jumpscare
        setTimeout(() => {
          this._triggerJumpscare(workId);
        }, 400);
      }
    }
  }

  // ── ACTIVACIÓN DEL JUMPSCARE / SCREAMER ─────────────────────
  _triggerJumpscare(workId) {
    // 1. Cerrar interfaz del tótem
    this.closeRiddle();

    // 2. Efecto sonoro de impacto estridente de terror
    audioManager.playSFX('jumpscare');

    // 3. Efecto visual: Desplegar en pantalla completa de forma repentina
    const jumpscareEl = document.getElementById('jumpscare-overlay');
    if (jumpscareEl) {
      jumpscareEl.classList.remove('hidden');
      jumpscareEl.classList.remove('fade-out');
      jumpscareEl.classList.add('active');
    }
    document.body.classList.add('screen-shake');

    // Sacudida violenta de cámara en Three.js
    if (window._engine) {
      window._engine.triggerCameraShake(2.0, 0.45);
    }

    // 4. Duración del screamer (2.0 segundos, dentro del rango 1.5 - 2.5s)
    const SCREAMER_DURATION = 2000;

    setTimeout(() => {
      // Iniciar desvanecimiento a negro
      if (jumpscareEl) jumpscareEl.classList.add('fade-out');

      setTimeout(() => {
        // 5. Flujo posterior al susto:
        if (jumpscareEl) {
          jumpscareEl.classList.remove('active');
          jumpscareEl.classList.remove('fade-out');
          jumpscareEl.classList.add('hidden');
        }
        document.body.classList.remove('screen-shake');

        // Estado del jugador: repeler a distancia segura y parpadear linterna
        if (window._engine) {
          window._engine.repelPlayerFromTotem(workId);
          window._engine.flickerFlashlight(2.0);
          window._engine.lockPointer();
        }

        // Tiempo de enfriamiento (12 segundos) y restablecer intentos a 3
        this.setTotemCooldown(workId, 12000);
        this.totemAttempts.set(workId, this.MAX_ATTEMPTS);

        this.showNotification('⚠️ ¡La entidad te ha expulsado! Tótem sellado temporalmente (12s)', 4500);
      }, 250);
    }, SCREAMER_DURATION);
  }

  // ── TRANSICIÓN ANIMADA ENTRE ACERTIJO Y PORTAFOLIO ──────────
  _showLoadingTransition(workId, onComplete) {
    const screenTrans = document.getElementById('screen-transition');
    const bar = document.getElementById('transition-bar');
    const title = document.getElementById('transition-title');
    const subtitle = document.getElementById('transition-subtitle');
    const status = document.getElementById('transition-status');
    const item = PORTFOLIO_ITEMS.find(p => p.id === workId);

    if (!screenTrans) {
      if (onComplete) onComplete();
      return;
    }

    if (title && item) title.textContent = `EXPEDIENTE: ${item.room.toUpperCase()}`;
    if (subtitle) subtitle.textContent = '🗝️ Llave obtenida — Acceso concedido';
    if (status) status.textContent = 'Desencriptando y cargando proyecto… 0%';
    if (bar) {
      bar.style.transition = 'width 0.12s ease';
      bar.style.width = '0%';
    }

    screenTrans.classList.remove('hidden');
    audioManager.playSFX('key');

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 14) + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        if (bar) bar.style.width = '100%';
        if (status) status.innerHTML = '<span style="color:#7dd88a;font-weight:bold">¡EXPEDIENTE Y PROYECTO LISTOS!</span>';
        audioManager.playSFX('unlock');
        setTimeout(() => {
          screenTrans.classList.add('hidden');
          if (onComplete) onComplete();
        }, 550);
      } else {
        if (bar) bar.style.width = `${progress}%`;
        if (status) {
          if (progress < 40) status.textContent = `Desbloqueando cerradura… ${progress}%`;
          else if (progress < 75) status.textContent = `Cargando planos y fotografías… ${progress}%`;
          else status.textContent = `Generando visualización… ${progress}%`;
        }
      }
    }, 110);
  }

  closeRiddle() {
    document.getElementById('modal-riddle')?.classList.add('hidden');
    this.activeRiddle = null;
    const isJumpscareActive = document.getElementById('jumpscare-overlay')?.classList.contains('active');
    if (window._engine && !window._engine.isPointerLocked && !isJumpscareActive) {
      window._engine.lockPointer();
    }
  }

  // ── RECOGER LLAVE ─────────────────────────────────────────
  _collectKey(workId) {
    if (this.collectedKeys.has(workId)) return;
    this.collectedKeys.add(workId);

    // Animar slot de llave
    const slot = document.getElementById(`key-slot-${workId}`);
    slot?.classList.add('collected');

    // Desbloquear trabajo
    this.unlockedWorks.add(workId);
    audioManager.playSFX('unlock');
    this._updateProgress();
    this.openPortfolio(workId);
    this._checkWinCondition();
  }

  // ── PROGRESO ──────────────────────────────────────────────
  _updateProgress() {
    const el = document.getElementById('progress-count');
    if (el) el.textContent = `${this.unlockedWorks.size} / ${this.totalWorks}`;
  }

  // ── MOSTRAR PORTAFOLIO ────────────────────────────────────
  openPortfolio(workId) {
    const item = PORTFOLIO_ITEMS.find(p => p.id === workId);
    if (!item) return;

    const iconEl = document.getElementById('portfolio-icon');
    const titleEl = document.getElementById('portfolio-title');
    if (iconEl) iconEl.textContent = item.icon || '🗂';
    if (titleEl) titleEl.textContent = (item.room || 'EXPEDIENTE').toUpperCase();

    const body = document.getElementById('portfolio-body');
    const mainImg = item.images?.[0] || '';

    if (body) {
      body.innerHTML = `
        <div class="portfolio-grid">
          <div class="portfolio-info-col">
            <div class="portfolio-unlocked-badge">🗝️ PROYECTO DESBLOQUEADO</div>
            <h3 class="portfolio-project-title">${item.title}</h3>
            <p class="portfolio-project-desc">${item.description}</p>
            ${item.tools?.length
              ? `<p class="portfolio-project-tools">
                  <strong>Herramientas:</strong> ${item.tools.join(', ')}
                 </p>`
              : ''}
            ${item.link
              ? `<a class="portfolio-project-link" href="${item.link}" target="_blank" rel="noopener">Ver proyecto →</a>`
              : ''}
          </div>
          ${mainImg ? `
            <div class="portfolio-image-col">
              <div class="portfolio-image-card">
                <div class="portfolio-image-backdrop" style="background-image: url('${mainImg}')"></div>
                <img src="${mainImg}" alt="${item.title}" class="portfolio-image-main" loading="lazy"
                     onerror="this.parentElement.style.display='none'">
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    document.getElementById('modal-portfolio')?.classList.remove('hidden');
    if (window._engine && window._engine.isPointerLocked) {
      window._engine.unlockPointer();
    }
  }

  closePortfolio() {
    document.getElementById('modal-portfolio')?.classList.add('hidden');
    if (window._engine && !window._engine.isPointerLocked) {
      window._engine.lockPointer();
    }
  }

  // ── PAUSA ─────────────────────────────────────────────────
  openPause() {
    document.getElementById('modal-pause')?.classList.remove('hidden');
  }

  closePause() {
    document.getElementById('modal-pause')?.classList.add('hidden');
  }

  // ── CONDICIÓN DE VICTORIA ────────────────────────────────
  _checkWinCondition() {
    if (this.unlockedWorks.size < this.totalWorks) return;

    setTimeout(() => {
      audioManager.playSFX('key'); // sonido de victoria
      this._buildWinLinks();
      this.showScreen('screen-win');
    }, 2000);
  }

  _buildWinLinks() {
    const container = document.getElementById('win-portfolio-links');
    if (!container) return;
    container.innerHTML = '';
    PORTFOLIO_ITEMS.forEach(item => {
      const btn = document.createElement('button');
      btn.className   = 'win-link';
      btn.textContent = `${item.icon} ${item.room}`;
      btn.addEventListener('click', () => this.openPortfolio(item.id));
      container.appendChild(btn);
    });
  }

  // ── RESETEAR JUEGO ────────────────────────────────────────
  reset() {
    this.collectedKeys.clear();
    this.unlockedWorks.clear();
    this._updateProgress();
    document.querySelectorAll('.key-slot').forEach(s => s.classList.remove('collected'));
    document.getElementById('screen-transition')?.classList.add('hidden');
    this.closeRiddle();
    this.closePortfolio();
    this.closePause();
  }
}
