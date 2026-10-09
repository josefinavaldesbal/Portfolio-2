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
    this.collectedKeys  = new Set();
    this.unlockedWorks  = new Set();
    this.totalWorks     = PORTFOLIO_ITEMS.length;
    this.activeRiddle   = null;

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

  // ── ABRIR ACERTIJO ────────────────────────────────────────
  openRiddle(workId, engine) {
    // Si ya fue desbloqueado, mostrar el portafolio directamente
    if (this.unlockedWorks.has(workId)) {
      this.openPortfolio(workId);
      return false; // no necesita bloquear controles de nuevo
    }

    const riddle = RIDDLES.find(r => r.workId === workId);
    if (!riddle) return false;

    this.activeRiddle = riddle;

    // Rellenar el modal
    const item = PORTFOLIO_ITEMS.find(p => p.id === workId);
    document.getElementById('riddle-title').textContent =
      item ? item.room : 'Expediente Clínico';

    const qEl = document.getElementById('riddle-question');
    if (qEl) {
      qEl.innerHTML = `<em style="color:var(--text-dim);font-size:0.85rem">${riddle.narrative}</em><br><br>${riddle.question}`;
    }

    // Limpiar opciones anteriores
    const optEl   = document.getElementById('riddle-options');
    const inputEl = document.getElementById('riddle-input');
    const feedEl  = document.getElementById('riddle-feedback');

    optEl.innerHTML = '';
    feedEl.textContent = '';
    feedEl.className   = 'feedback hidden';
    inputEl.value      = '';

    if (riddle.type === 'multiple') {
      inputEl.classList.add('hidden');
      // Mezclar opciones aleatoriamente
      const shuffled = [...riddle.options].sort(() => Math.random() - 0.5);
      shuffled.forEach(opt => {
        const btn = document.createElement('button');
        btn.className    = 'riddle-option';
        btn.dataset.answer = opt;
        btn.textContent  = opt;
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
    const correct = this.activeRiddle.answer.toLowerCase().trim();
    const given   = (answer ?? '').toLowerCase().trim();

    const feedEl = document.getElementById('riddle-feedback');

    if (given === correct) {
      // ✅ Correcto
      audioManager.playSFX('correct');
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

      const workId = this.activeRiddle.workId;
      setTimeout(() => {
        this.closeRiddle();
        this._showLoadingTransition(workId, () => {
          this._collectKey(workId);
        });
      }, 950);

    } else {
      // ❌ Incorrecto
      audioManager.playSFX('wrong');
      if (feedEl) {
        feedEl.textContent = this.activeRiddle.wrongMsg;
        feedEl.className   = 'feedback wrong';
        feedEl.classList.remove('hidden');
      }
      // Resaltar opción incorrecta
      document.querySelectorAll('.riddle-option').forEach(btn => {
        if (btn.dataset.answer === answer) {
          btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 1000);
        }
      });
    }
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
