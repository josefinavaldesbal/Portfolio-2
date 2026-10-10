// ════════════════════════════════════════════════════════
//  HOSPITAL OLVIDADO — Punto de entrada principal
// ════════════════════════════════════════════════════════

import { HospitalEngine } from './engine.js?v=5.0';
import { UIManager }      from './ui.js?v=5.0';
import { audioManager }   from './audio.js?v=5.0';

// ── Estado global ────────────────────────────────────────
let engine = null;
let ui     = null;
let gameStarted = false;

// ── Inicialización ───────────────────────────────────────
async function init() {
  const canvas = document.getElementById('game-canvas');

  // Callback para iniciar sesión VR en WebXR
  const handleStartVR = async () => {
    if (!gameStarted) {
      await startGame();
    }
    if (engine) {
      await engine.startVRSession();
    }
  };

  // Crear UI (con callbacks: startGame, restartGame, startVR)
  ui = new UIManager(startGame, restartGame, handleStartVR);
  window._ui = ui;

  // Mostrar pantalla de inicio
  ui.showScreen('screen-intro');

  // ESC — pausa / despausa
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && gameStarted) {
      if (engine?.isPointerLocked) {
        engine.unlockPointer();
        ui.openPause();
        engine.pause();
      } else {
        // Si hay modales abiertos, cerrarlos
        const riddleOpen    = !document.getElementById('modal-riddle')?.classList.contains('hidden');
        const portfolioOpen = !document.getElementById('modal-portfolio')?.classList.contains('hidden');
        const pauseOpen     = !document.getElementById('modal-pause')?.classList.contains('hidden');

        if (riddleOpen)    { ui.closeRiddle(); }
        if (portfolioOpen) { ui.closePortfolio(); }
        if (pauseOpen)     { ui.closePause(); engine.resume(); engine.lockPointer(); }
        if (!riddleOpen && !portfolioOpen && !pauseOpen) {
          engine.lockPointer();
        }
      }
    }
  });

  // Click en canvas para re-lockear el puntero
  canvas?.addEventListener('click', () => {
    if (gameStarted && !engine?.isPointerLocked) {
      const anyModalOpen = ['modal-riddle', 'modal-portfolio', 'modal-pause', 'screen-transition', 'jumpscare-overlay']
        .some(id => !document.getElementById(id)?.classList.contains('hidden'));
      if (!anyModalOpen) engine?.lockPointer();
    }
  });
}

// ── Iniciar juego ────────────────────────────────────────
async function startGame() {
  ui.showScreen('screen-loading');
  ui.setLoadingProgress(5, 'Inicializando motor 3D…');

  try {
    const canvas = document.getElementById('game-canvas');

    // Crear el motor 3D
    engine = new HospitalEngine(
      canvas,
      // Callback: interacción con objeto
      (workId) => {
        const opened = ui.openRiddle(workId, engine);
        if (!opened) {
          // Ya desbloqueado — mostrar portafolio directamente
          ui.openPortfolio(workId);
          engine.unlockPointer();
        }
      },
      // Callback: progreso de carga
      (percent, text) => {
        ui.setLoadingProgress(percent, text);
      },
      // Callback: contacto con el zombie -> disparar jumpscare
      () => {
        ui.triggerZombieJumpscare();
      }
    );
    window._engine = engine;

    // Cargar el modelo del hospital
    ui.setLoadingProgress(15, 'Cargando hospital…');
    await engine.loadHospitalModel('assets/models/hospital.glb');

    ui.setLoadingProgress(100, '¡Listo!');
    await delay(400);

    // Mostrar pantalla de juego
    ui.showScreen('screen-game');
    engine.start();

    // Mostrar overlay "Click para jugar" — el PointerLock requiere click del usuario
    gameStarted = true;
    showClickToPlay();
  } catch (err) {
    console.error('[Error al iniciar el hospital]', err);
    ui.setLoadingProgress(100, 'Error: ' + (err.message || err));
  }
}

// ── Reiniciar juego ───────────────────────────────────────
async function restartGame() {
  gameStarted = false;
  engine?.pause();
  engine = null;
  ui.reset();
  await startGame();
}

// ── Click para jugar (PointerLock requiere gesto del usuario) ────
function showClickToPlay() {
  let overlay = document.getElementById('click-to-play');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'click-to-play';
    overlay.innerHTML = `
      <div style="
        position:fixed; inset:0; z-index:80;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        background:rgba(0,0,0,0.75);
        font-family:'Oswald',sans-serif;
        cursor:pointer;
      ">
        <div style="font-size:3rem; margin-bottom:1rem;">🏥</div>
        <p style="font-size:1.4rem; color:#c8bfaf; letter-spacing:0.2em; text-transform:uppercase;">
          Click para entrar al hospital
        </p>
        <p style="font-size:0.8rem; color:#555; margin-top:0.5rem; letter-spacing:0.1em;">
          Mueve el mouse para mirar · WASD para caminar
        </p>
      </div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  const engage = () => {
    overlay.style.display = 'none';
    engine.lockPointer();
    audioManager.startAmbient();
  };
  overlay.addEventListener('click', engage, { once: true });
}

// ── Utilidad ──────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Arrancar ──────────────────────────────────────────────
init();
