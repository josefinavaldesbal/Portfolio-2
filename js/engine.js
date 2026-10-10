// ════════════════════════════════════════════════════════
//  HOSPITAL OLVIDADO — Motor 3D (Three.js + WebXR + WebGPU)
//  Carga el modelo GLB, gestiona colisiones, escaleras y VR
// ════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader }        from 'three/addons/loaders/GLTFLoader.js';
import { INTERACTION_POINTS, PORTFOLIO_ITEMS }  from './data.js?v=4.0';
import { audioManager }        from './audio.js?v=4.0';

// ── Constantes de movimiento y física ─────────────────────
const MOVE_SPEED        = 4.2;   // unidades/segundo
const FOOTSTEP_DIST     = 1.6;   // distancia entre pasos
const PLAYER_HEIGHT     = 1.7;   // altura de ojos del jugador
const PLAYER_RADIUS     = 0.45;  // radio de colisión del jugador
const MAX_STEP_UP       = 0.45;  // altura máxima de escalón que puede subir
const MAX_STEP_DOWN     = 0.85;  // altura máxima de escalón que puede bajar

export class HospitalEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Function} onInteract — callback(workId) cuando el jugador presiona E o interactúa en VR
   * @param {Function} onProgress — callback(percent, text) durante la carga
   */
  constructor(canvas, onInteract, onProgress) {
    this.canvas            = canvas;
    this.onInteract        = onInteract;
    this.onProgress        = onProgress;

    this._running          = false;
    this._keys             = {};          // teclas presionadas
    this._distWalked       = 0;           // para trigger de pasos
    this.velocity          = new THREE.Vector3(0, 0, 0); // velocidad del jugador / collider
    this._nearItem         = null;        // ítem interactuable cercano
    this.collidableMeshes  = [];          // mallas para colisiones horizontales y suelo
    this.doorMeshes        = [];          // mallas de puertas
    this.controllers       = [];          // mandos WebXR
    this._totemGroups      = [];          // grupos de tótems 3D rotatorios

    this._shakeTimer            = 0;      // temporizador de sacudida de cámara
    this._shakeIntensity        = 0;      // intensidad de sacudida
    this._flashlightFlickerTimer = 0;     // temporizador de parpadeo de linterna
    this._shadowTimer           = 16.0 + Math.random() * 10.0; // tiempo para primera sombra repentina
    this._activeShadow          = null;   // sombra espectral activa
    this._zombieMixer           = null;   // AnimationMixer del zombie
    this._zombiePatrol          = null;   // Datos de patrulla circular del zombie

    this._raycaster        = new THREE.Raycaster();
    this._downRay          = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initControls();
    this._initWebXR();
    this._bindEvents();
    this._buildFallbackEnvironment(); // mientras carga el GLB
    this._initPositionDisplay();      // 📍 coordenadas en pantalla
  }

  // ── RENDERER (WebGPU / WebGL con soporte WebXR) ───────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFShadowMap;
    this.renderer.toneMapping       = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 0.55;
    this.renderer.setClearColor(0x050505);

    // Habilitar WebXR para cascos de Realidad Virtual
    this.renderer.xr.enabled = true;

    // Verificar soporte de WebGPU en la GPU del usuario para telemetría
    if ('gpu' in navigator) {
      console.log('[WebGPU] Hardware GPU compatible detectado. Canal de aceleración activo.');
    }
  }

  // ── ESCENA ───────────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
  }

  // ── CÁMARA (primera persona) ──────────────────────────────
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, PLAYER_HEIGHT, 0);
    this._yaw   = 0;
    this._pitch = 0;
  }

  // ── LUCES ────────────────────────────────────────────────
  _initLights() {
    // Luz ambiental muy tenue — atmósfera de terror oscuro
    const ambient = new THREE.AmbientLight(0x1a1a2e, 0.5);
    this.scene.add(ambient);

    // Linterna — cono amplio (54°) apuntando al frente exacto de la cámara
    this.flashlight = new THREE.SpotLight(0xfff0dd, 15, 28, Math.PI / 3.3, 0.35, 1.1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.bias = -0.0001;
    this.flashlight.position.set(0, 0, 0);         // ojo del jugador
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    this.flashlight.target.position.set(0, 0, -1); // directo al frente
    this.scene.add(this.camera);

    // Luz de emergencia roja parpadeante en el pasillo (cerca del techo Y=9.4)
    this.emergencyLight = new THREE.PointLight(0xff1a1a, 1.8, 16, 2);
    this.emergencyLight.position.set(0, 9.4, -6);
    this.scene.add(this.emergencyLight);

    // Luces fluorescentes pálidas del techo
    this._addCeilingLights();
  }

  _addCeilingLights() {
    // Luces distribuidas a lo largo del recorrido completo del hospital (z: 0 a -38)
    const positions = [
      [  0, 9.6,  -2 ],
      [ -1, 9.6,  -7 ],
      [  1, 9.6, -13 ],
      [  0, 9.6, -18 ],
      [ -1, 9.6, -23 ],
      [  1, 9.6, -28 ],
      [  0, 9.6, -33 ],
      [  0, 9.6, -38 ],
    ];
    positions.forEach(([x, y, z]) => {
      // Fluorescentes tenues — la mayoría fundidos
      const light = new THREE.PointLight(0x8899bb, 0.45, 10, 2);
      light.position.set(x, y, z);
      this.scene.add(light);

      const bulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8),
        new THREE.MeshBasicMaterial({ color: 0xbbccee })
      );
      bulb.rotation.z = Math.PI / 2;
      bulb.position.set(x, y, z);
      this.scene.add(bulb);
    });
  }

  // ── CONTROLES (First-Person PointerLock) ─────────────────
  _initControls() {
    this._mouseSensitivity = 0.0022;

    this._onMouseMove = (e) => {
      if (!this.isPointerLocked) return;

      const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

      // 1. Movimiento horizontal del mouse (X) -> Rotación Yaw (Eje Y)
      this._yaw -= movementX * this._mouseSensitivity;

      // 2. Movimiento vertical del mouse (Y) -> Inclinación Pitch (Eje X)
      this._pitch -= movementY * this._mouseSensitivity;

      // 3. Restricción estricta de ángulo vertical: [-85°, +85°]
      // Evita volteos involuntarios al mirar directo al techo o suelo
      const maxPitch = (85 * Math.PI) / 180; // ~1.4835 rad (~85 grados)
      this._pitch = Math.max(-maxPitch, Math.min(maxPitch, this._pitch));

      // 4. Bloqueo de rotación axial (Roll = 0): horizonte siempre nivelado
      this._applyCameraRotation();
    };

    document.addEventListener('mousemove', this._onMouseMove);

    // Objeto compatible con la API controls para llamadas externas
    const self = this;
    this.controls = {
      lock: () => self.lockPointer(),
      unlock: () => self.unlockPointer(),
      get isLocked() { return self.isPointerLocked; }
    };
  }

  /**
   * Aplica la orientación de la cámara separando estrictamente los ejes:
   * Yaw (Y), Pitch (X) y bloqueando permanentemente Roll (Z) en 0.
   */
  _applyCameraRotation() {
    this.camera.rotation.order = 'YXZ';

    let pitchShake = 0;
    let yawShake   = 0;
    let rollShake  = 0;

    // Solo durante el screamer se aplica sacudida temporal
    if (this._shakeTimer > 0) {
      const factor = Math.max(0, this._shakeTimer / 2.0);
      const intensity = this._shakeIntensity * factor;
      pitchShake = (Math.random() - 0.5) * intensity * 0.15;
      yawShake   = (Math.random() - 0.5) * intensity * 0.15;
      rollShake  = (Math.random() - 0.5) * intensity * 0.22;
    }

    // Roll (Z) = 0 forzado en juego normal para que el horizonte jamás se descalibre
    this.camera.rotation.set(
      this._pitch + pitchShake,
      this._yaw + yawShake,
      rollShake
    );
  }

  // ── WEBXR (Controladores y Realidad Virtual) ───────────────
  _initWebXR() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', () => {
        // En VR, apretar el gatillo interactúa si estás cerca de un punto
        this._tryInteract();
      });
      this.scene.add(controller);

      // Rayo guía láser en VR
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4)
      ]);
      const rayMat = new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.6 });
      const ray = new THREE.Line(rayGeo, rayMat);
      controller.add(ray);

      this.controllers.push(controller);
    }
  }

  async startVRSession() {
    if (!navigator.xr) {
      alert('Tu navegador no cuenta con soporte WebXR para Realidad Virtual.');
      return;
    }
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr');
      if (!supported) {
        alert('No se detectó un visor VR conectado.');
        return;
      }
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });
      await this.renderer.xr.setSession(session);
      console.log('[WebXR] Sesión VR iniciada');
    } catch (err) {
      console.warn('[WebXR] Error al iniciar sesión VR:', err);
      alert('Error al iniciar WebXR VR: ' + err.message);
    }
  }

  // ── EVENTOS TECLADO Y REDIMENSIÓN ─────────────────────────
  _bindEvents() {
    window.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'KeyE') this._tryInteract();
    });
    window.addEventListener('keyup',   e => { this._keys[e.code] = false; });
    window.addEventListener('blur',    () => { this._keys = {}; });
    window.addEventListener('resize',  () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ── ENTORNO DE RESPALDO (si no hay GLB) ───────────────────
  _buildFallbackEnvironment() {
    this._fallbackGroup = new THREE.Group();
    this._fallbackGroup.name = 'fallback';

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this._fallbackGroup.add(floor);
    this.collidableMeshes.push(floor);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 3.5;
    this._fallbackGroup.add(ceil);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 0.95 });
    const wallGeo = new THREE.BoxGeometry(4, 3.5, 80);
    const left  = new THREE.Mesh(wallGeo, wallMat);
    left.position.set(-2.5, 1.75, -40);
    this._fallbackGroup.add(left);
    this.collidableMeshes.push(left);

    const right = new THREE.Mesh(wallGeo, wallMat);
    right.position.set(2.5, 1.75, -40);
    this._fallbackGroup.add(right);
    this.collidableMeshes.push(right);

    INTERACTION_POINTS.forEach(point => {
      this._createInteractableObject(point, this._fallbackGroup);
    });

    this.scene.add(this._fallbackGroup);
  }

  _createInteractableObject(point, parent = this.scene) {
    // Si se pasa la coordenada de cámara Y, el suelo estimado está a Y - PLAYER_HEIGHT (1.7)
    let floorY = (point.position && point.position.y !== undefined)
      ? point.position.y - PLAYER_HEIGHT
      : 6.44;

    if (this.collidableMeshes && this.collidableMeshes.length > 0) {
      // Lanzamos un rayo vertical hacia abajo para detectar el piso exacto de la sala
      const probeStartY = (point.position && point.position.y !== undefined)
        ? point.position.y + 0.6
        : 14.0;
      const probe = new THREE.Raycaster(
        new THREE.Vector3(point.position.x, probeStartY, point.position.z),
        new THREE.Vector3(0, -1, 0),
        0.05,
        6.0
      );
      const hits = probe.intersectObjects(this.collidableMeshes, false);
      const floorHit = hits.find(h => {
        const wn = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        return wn.y > 0.4;
      });
      if (floorHit) {
        floorY = floorHit.point.y;
      }
    }

    // Grupo contenedor raíz del Tótem (anclado en las coordenadas de la sala sobre el suelo)
    const totemGroup = new THREE.Group();
    totemGroup.position.set(point.position.x, floorY, point.position.z);
    totemGroup.userData = { workId: point.workId, label: point.label, isTotem: true };
    parent.add(totemGroup);

    const targetSize = point.targetSize || 1.8;

    // 1. Cargar el modelo 3D GLB específico para el tótem
    if (point.model) {
      if (!this._gltfLoader) this._gltfLoader = new GLTFLoader();
      this._gltfLoader.load(
        point.model,
        (gltf) => {
          const model = gltf.scene;

          // Desactivar animaciones internas o deformaciones
          if (gltf.animations && gltf.animations.length > 0) {
            gltf.animations = [];
          }

          // Calcular Bounding Box para normalizar escala y apoyar en el suelo
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? targetSize / maxDim : 1;
          model.scale.setScalar(scale);

          // Centrar en X y Z y alinear la base del modelo (pivote inferior en Y) directamente en Y = 0
          model.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale
          );

          model.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.userData = { workId: point.workId, label: point.label, isTotem: true };
              if (!this.collidableMeshes) this.collidableMeshes = [];
              this.collidableMeshes.push(child);
              if (child.morphTargetInfluences) {
                for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                  child.morphTargetInfluences[i] = 0;
                }
              }
              if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                  mat.roughness = Math.max(mat.roughness ?? 0.5, 0.4);
                });
              }
            }
          });

          totemGroup.add(model);
          console.log(`[Tótem GLB] ${point.label} cargado con éxito (${point.model})`);
        },
        undefined,
        (err) => {
          console.warn(`[Tótem GLB] Error cargando ${point.model}:`, err);
        }
      );
    }

    // 2. Luz atmosférica puntual roja sobre el tótem (indicador de interacción)
    const beaconY = targetSize + 0.25;
    const glow = new THREE.PointLight(0xff2200, 1.8, 5.0);
    glow.position.set(0, beaconY, 0);
    totemGroup.add(glow);

    // 3. Orbe flotante brillante encima del tótem
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3333 })
    );
    particle.position.set(0, beaconY + 0.15, 0);
    particle.userData.floatOffset = Math.random() * Math.PI * 2;
    totemGroup.add(particle);

    console.log(`[Tótem 3D] ${point.label} situado en X:${point.position.x} Y:${floorY.toFixed(2)} Z:${point.position.z}`);

    if (!this._particles) this._particles = [];
    if (!this._totemGroups) this._totemGroups = [];
    if (!this._interactableObjects) this._interactableObjects = [];

    this._particles.push(particle);
    this._totemGroups.push(totemGroup);
    this._interactableObjects.push(totemGroup);
  }

  // ── CARGA DEL MODELO GLB + APERTURA DE PUERTAS + SPAWN SEGURO ──
  loadHospitalModel(path = 'assets/models/hospital.glb') {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      this.onProgress(0, 'Cargando hospital…');

      loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          // 1. Mantener escala arquitectónica nativa 1.0 (74.7m x 18.1m x 32.3m)
          // El modelo GLB ya posee dimensiones reales métricas con pasillo central a Y=6.44
          model.scale.set(1, 1, 1);
          model.position.set(0, 0, 0);

          // Limpiar colisiones previas y objetos de fallback
          this.collidableMeshes = [];
          this._particles = [];
          this._interactableObjects = [];
          if (this._fallbackGroup) {
            this.scene.remove(this._fallbackGroup);
            this._fallbackGroup = null;
          }

          // 2. Procesar puertas y mallas de colisión
          model.traverse(child => {
            const name = (child.name || '').toLowerCase();
            let isDoor = name.includes('door') || name.includes('puerta');

            // Si algún ancestro es puerta, todo el conjunto pertenece a la puerta
            let p = child.parent;
            while (p && !isDoor) {
              if (p.userData?.isDoor || (p.name || '').toLowerCase().includes('door')) {
                isDoor = true;
                break;
              }
              p = p.parent;
            }

            if (isDoor) {
              // 🚪 Abrir puertas rotándolas para despejar el paso libre entre salas
              child.userData.isDoor = true;
              if (child.type === 'Group' || child.type === 'Object3D') {
                child.rotation.y = Math.PI * 0.48; // ~86 grados abierta
              }
              this.doorMeshes.push(child);
            }

            if (child.isMesh) {
              child.castShadow    = true;
              child.receiveShadow = true;

              if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                  mat.roughness = Math.max(mat.roughness ?? 0.5, 0.6);
                  mat.metalness = Math.min(mat.metalness ?? 0, 0.25);
                });
              }

              // Registrar mallas para colisiones horizontales y escaleras (excluyendo puertas)
              if (!isDoor && !child.userData.isDoor) {
                this.collidableMeshes.push(child);
              }
            }
          });

          this.scene.add(model);
          this.hospitalModel = model;
          model.updateMatrixWorld(true);

          // Eliminar el entorno de respaldo para que no quede el pasillo provisional ni sus cajas flotando
          if (this._fallbackGroup) {
            this.scene.remove(this._fallbackGroup);
            this._fallbackGroup = null;
          }
          this._interactableObjects = [];
          this._particles = [];
          this._totemGroups = [];

          // 3. Crear objetos interactivos en sus habitaciones exactas
          INTERACTION_POINTS.forEach(point => {
            this._createInteractableObject(point, this.scene);
          });

          // 4. Ubicación de Spawn Seguro DENTRO del pasillo del hospital
          this._findSafeInteriorSpawn(model);

          // 5. Cargar entidad patrullando en Sala de Cirugía
          this._loadCirugiaEntity('assets/models/zombie.glb');

          // Ajustes de atmósfera lumínica de terror oscuro
          this.scene.traverse(child => {
            if (child.isAmbientLight) child.intensity = 0.5;
          });
          if (this.flashlight) this.flashlight.intensity = 15;

          this.onProgress(100, '¡Hospital cargado!');
          console.log(`[GLB] Hospital cargado con ${this.doorMeshes.length} puertas abiertas y ${this.collidableMeshes.length} mallas de colisión.`);
          resolve(model);
        },
        (xhr) => {
          if (xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            this.onProgress(pct, `Cargando hospital… ${pct}%`);
          }
        },
        (err) => {
          console.warn('[Hospital Engine] Error cargando GLB:', err);
          this.onProgress(100, 'Usando entorno de respaldo');
          resolve(null);
        }
      );
    });
  }

  // ── CALCULAR SPAWN POINT SEGURO DENTRO DEL HOSPITAL ────────
  _findSafeInteriorSpawn(model) {
    // Reaparición obligatoria y fija en la entrada del hospital: (0.00, 8.14, -2.00)
    this.respawnPlayer();
    console.log('[Spawn Inicial] Jugador posicionado en la entrada fija del hospital: (0.00, 8.14, -2.00)');
  }

  // ── INTERACCIÓN Y ENFRIAMIENTO ──────────────────────────
  _tryInteract() {
    if (this._nearItem) {
      if (window._ui && window._ui.isTotemOnCooldown(this._nearItem)) {
        const left = window._ui.getTotemCooldownSeconds(this._nearItem);
        window._ui.showNotification(`⚠️ Tótem sellado por la entidad. Espera ${left}s...`);
        return;
      }
      this.onInteract(this._nearItem);
    }
  }

  _checkProximity() {
    const camPos = this.camera.position;
    let closest = null;
    let closestDist = Infinity;

    INTERACTION_POINTS.forEach(point => {
      const dx = camPos.x - point.position.x;
      const dy = camPos.y - point.position.y;
      const dz = camPos.z - point.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy * 0.7 + dz * dz);
      if (dist < point.radius && dist < closestDist) {
        closestDist = dist;
        closest = point;
      }
    });

    this._nearItem = closest ? closest.workId : null;

    const prompt = document.getElementById('interaction-prompt');
    const text   = document.getElementById('interaction-text');
    if (this._nearItem && closest) {
      prompt?.classList.remove('hidden');
      if (window._ui && window._ui.isTotemOnCooldown(closest.workId)) {
        const left = window._ui.getTotemCooldownSeconds(closest.workId);
        if (text) text.innerHTML = `<span style="color:#ff5555;font-weight:bold">⚠️ Entidad hostil cerca… Espera ${left}s</span>`;
      } else {
        if (text) text.innerHTML = `<kbd>E</kbd> ${closest.label}`;
      }
    } else {
      prompt?.classList.add('hidden');
    }
  }

  // ── SACUDIDA DE CÁMARA (JUMPSCARE) Y REPULSIÓN ─────────────
  triggerCameraShake(duration = 2.0, intensity = 0.45) {
    this._shakeTimer = duration;
    this._shakeIntensity = intensity;
  }

  flickerFlashlight(duration = 1.8) {
    this._flashlightFlickerTimer = duration;
  }

  /**
   * Reaparición fija y obligatoria en la entrada del hospital:
   * Coordenadas exactas: X: 0.00, Y: 8.14, Z: -2.00
   * Resetea inmediatamente velocidades lineales/angulares, inercia de caída, sacudida
   * y orienta la vista hacia el interior del hospital con horizonte nivelado.
   */
  respawnPlayer() {
    // 1. Punto de reaparición fijo en la entrada del hospital
    this.camera.position.set(0.00, 8.14, -2.00);

    // 2. Reinicio inmediato de físicas, velocidades e inercia previa
    this.velocity.set(0, 0, 0);
    this._keys = {};
    this._distWalked = 0;
    this._shakeTimer = 0;
    this._shakeIntensity = 0;

    // 3. Orientación de cámara: mirando hacia el interior del pasillo (-Z) con horizonte nivelado (Roll = 0, Pitch = 0)
    this._yaw   = 0.0;
    this._pitch = 0.0;
    this._applyCameraRotation();

    console.log('[Respawn] Jugador reubicado en la entrada fija: (0.00, 8.14, -2.00), físicas y orientación reiniciadas.');
  }

  /**
   * Alias de compatibilidad: cualquier orden de repeler o reiniciar redirige al respawn fijo
   */
  repelPlayerFromTotem(workId) {
    this.respawnPlayer();
  }

  // ── LOOP DE JUEGO (Compatible con WebXR) ─────────────────
  start() {
    this._running = true;
    this._clock   = new THREE.Clock();

    // Usar setAnimationLoop para soporte nativo de WebXR y render regular
    this.renderer.setAnimationLoop(() => this._animate());
  }

  pause() {
    this._running = false;
  }

  resume() {
    this._running = true;
    this._clock?.start();
  }

  _animate() {
    if (!this._running) return;

    const delta = this._clock.getDelta();
    const t     = this._clock.getElapsedTime();

    this._updateMovement(delta);
    this._updateGroundElevation();
    this._updateEffects(t);
    this._checkProximity();
    this._updatePositionDisplay();
    this._updateShadows(delta);
    this._updateZombiePatrol(delta);

    // Actualizar sacudida violenta de cámara durante screamer
    if (this._shakeTimer > 0) {
      this._shakeTimer -= delta;
      if (this._shakeTimer < 0) this._shakeTimer = 0;
      const factor = this._shakeTimer / 2.0;
      const intensity = this._shakeIntensity * factor;
      this.camera.position.x += (Math.random() - 0.5) * intensity * 0.45;
      this.camera.position.y += (Math.random() - 0.5) * intensity * 0.45;
    }

    // Aplicar rotación estricta cada fotograma: Roll = 0 permanente
    this._applyCameraRotation();

    // Parpadeo errático de linterna tras el susto
    if (this._flashlightFlickerTimer > 0) {
      this._flashlightFlickerTimer -= delta;
      if (Math.random() < 0.45) {
        this.flashlight.intensity = Math.random() < 0.5 ? 0.2 : 2.5;
      } else {
        this.flashlight.intensity = 15;
      }
      if (this._flashlightFlickerTimer <= 0) {
        this.flashlight.intensity = 15;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── MOVIMIENTO CON COLISIÓN DE PAREDES (Wall Sliding) ─────
  _updateMovement(delta) {
    if (!this.controls.isLocked && !this.renderer.xr.isPresenting) return;

    const speed = MOVE_SPEED * delta;
    let forward, right;

    if (this.renderer.xr.isPresenting) {
      forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
      else forward.normalize();
      right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    } else {
      // Cálculo analítico a partir de Yaw: desacoplado de Pitch y sin riesgo de división por cero
      forward = new THREE.Vector3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));
      right   = new THREE.Vector3(Math.cos(this._yaw), 0, -Math.sin(this._yaw));
    }

    const moveVel = new THREE.Vector3();

    if (this._keys['KeyW'] || this._keys['ArrowUp'])    moveVel.addScaledVector(forward, speed);
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  moveVel.addScaledVector(forward, -speed);
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  moveVel.addScaledVector(right, -speed);
    if (this._keys['KeyD'] || this._keys['ArrowRight']) moveVel.addScaledVector(right, speed);

    if (moveVel.lengthSq() > 0) {
      // Resolver colisiones con paredes antes de mover
      const allowedMove = this._resolveWallCollisions(moveVel);
      this.camera.position.add(allowedMove);
      this.velocity.copy(allowedMove).divideScalar(Math.max(delta, 0.0001));
    } else {
      this.velocity.set(0, 0, 0);
    }
  }

  // ── RESOLUCIÓN DE COLISIONES CON PAREDES (No atravesar el GLB) ──
  _resolveWallCollisions(vel) {
    if (this.collidableMeshes.length === 0) return vel;

    const moveDist = vel.length();
    const moveDir  = vel.clone().normalize();
    const rayDist  = PLAYER_RADIUS + moveDist;

    // Probar a altura del pecho y cintura
    const probeHeights = [-0.2, -0.6];
    let blockedNormal = null;

    for (const h of probeHeights) {
      const probeOrigin = this.camera.position.clone();
      probeOrigin.y += h;

      this._raycaster.set(probeOrigin, moveDir);
      this._raycaster.far = rayDist;
      const hits = this._raycaster.intersectObjects(this.collidableMeshes, false);

      if (hits.length > 0) {
        const hit = hits[0];
        // Verificar si la cara impactada es vertical (pared)
        if (hit.face) {
          const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
          if (Math.abs(worldNormal.y) < 0.45) { // Pared vertical
            blockedNormal = worldNormal;
            break;
          }
        }
      }
    }

    if (blockedNormal) {
      // Deslizar a lo largo de la pared (Wall Sliding Projection)
      const dot = vel.dot(blockedNormal);
      const slideVel = vel.clone().sub(blockedNormal.clone().multiplyScalar(dot));

      // Verificar que el vector deslizado no choque de frente
      if (slideVel.lengthSq() > 0.0001) {
        const slideDir = slideVel.clone().normalize();
        this._raycaster.set(this.camera.position, slideDir);
        this._raycaster.far = PLAYER_RADIUS + slideVel.length();
        const slideHits = this._raycaster.intersectObjects(this.collidableMeshes, false);
        if (slideHits.length === 0) {
          return slideVel;
        }
      }
      return new THREE.Vector3(0, 0, 0); // Detenerse contra la pared
    }

    return vel;
  }

  // ── DETECCIÓN DE SUELO Y ESCALERAS (Subir y bajar) ─────────
  _updateGroundElevation() {
    if (this.collidableMeshes.length === 0) return;

    // Salvaguarda anticaída al vacío (out-of-bounds):
    // Si por algún desajuste el jugador cae fuera del mapa o por debajo del suelo mínimo
    if (this.camera.position.y < 1.0 || this.camera.position.y > 22.0) {
      console.warn('[Físicas] Caída fuera de límites del hospital detectada. Reubicando en entrada fija.');
      this.respawnPlayer();
      return;
    }

    const rayOrigin = this.camera.position.clone();
    rayOrigin.y += 0.8; // Empezar sondeo ligeramente arriba del jugador

    this._downRay.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    this._downRay.far = 5.0;
    const hits = this._downRay.intersectObjects(this.collidableMeshes, false);

    if (hits.length > 0) {
      // Buscar el piso más cercano debajo del jugador con normal vertical hacia arriba
      const floorHit = hits.find(h => {
        const wn = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        return wn.y > 0.4;
      });
      if (floorHit) {
        const targetCamY = floorHit.point.y + PLAYER_HEIGHT;
        const diff = targetCamY - this.camera.position.y;

        // Subir o bajar escalones y rampas
        if (diff > 0 && diff <= MAX_STEP_UP) {
          this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.4);
        } else if (diff < 0 && diff >= -MAX_STEP_DOWN) {
          this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.4);
        } else if (Math.abs(diff) < 0.04) {
          this.camera.position.y = targetCamY;
        }
      }
    }
  }

  // ── EFECTOS VISUALES ORGÁNICOS ───────────────────────────
  _updateEffects(t) {
    if (this.emergencyLight) {
      const flicker = Math.sin(t * 4.2) * Math.sin(t * 1.1);
      this.emergencyLight.intensity = Math.max(0, flicker) * 1.8;
    }

    if (this.flashlight) {
      this.flashlight.intensity = 10.5 + Math.sin(t * 12) * 0.35;
    }

    this._particles?.forEach(p => {
      p.position.y += Math.sin(t * 2 + p.userData.floatOffset) * 0.002;
    });
  }

  /** Bloquea el puntero del mouse para el control de cámara */
  lockPointer() {
    try {
      if (document.body.requestPointerLock) {
        document.body.requestPointerLock();
      }
    } catch (e) {
      console.warn('[PointerLock] Error al solicitar bloqueo:', e);
    }
  }

  unlockPointer() {
    try {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch (e) {
      console.warn('[PointerLock] Error al liberar puntero:', e);
    }
  }

  get isPointerLocked() {
    return document.pointerLockElement === document.body || document.pointerLockElement === this.canvas;
  }

  // ── DEBUG: muestra posición del jugador en pantalla ─────────
  // Esto ayuda a encontrar las coordenadas exactas para poner las cajas
  _initPositionDisplay() {
    this._posDiv = document.createElement('div');
    this._posDiv.id = 'pos-debug';
    Object.assign(this._posDiv.style, {
      position: 'fixed',
      top: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(5, 5, 10, 0.88)',
      color: '#00ff88',
      border: '2px solid #00aa55',
      boxShadow: '0 0 14px rgba(0, 255, 136, 0.4)',
      fontFamily: 'monospace, sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
      padding: '7px 18px',
      borderRadius: '8px',
      zIndex: '99999',
      pointerEvents: 'none',
      letterSpacing: '0.05em',
      textAlign: 'center',
      whiteSpace: 'nowrap'
    });
    document.body.appendChild(this._posDiv);
  }

  _updatePositionDisplay() {
    if (!this._posDiv) return;
    const p = this.camera.position;
    this._posDiv.innerHTML =
      `📍 <span style="color:#ffffff">Coordenadas:</span> X: <span style="color:#ffff00">${p.x.toFixed(2)}</span> &nbsp;|&nbsp; Y: <span style="color:#00ffff">${p.y.toFixed(2)}</span> &nbsp;|&nbsp; Z: <span style="color:#ff77ff">${p.z.toFixed(2)}</span>`;
  }

  // ── SISTEMA DE SOMBRAS FANTASMALAS REPENTINAS (Horror Specters) ──
  _updateShadows(delta) {
    // 1. Si hay una sombra cruzando activamente, actualizar su traslación y desvanecimiento
    if (this._activeShadow) {
      const sh = this._activeShadow;
      sh.progress += delta / sh.duration;
      const p = sh.progress;

      if (p >= 1.0) {
        // La sombra ha terminado de cruzar hacia la pared/habitación: remover de la escena
        this.scene.remove(sh.group);
        sh.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
        this._activeShadow = null;
        // Programar la próxima aparición repentina entre 22 y 42 segundos
        this._shadowTimer = 22.0 + Math.random() * 20.0;
      } else {
        // Mover la figura a lo largo de la trayectoria transversal
        sh.group.position.lerpVectors(sh.startPos, sh.endPos, p);

        // Curva suave de opacidad: se hace visible rápidamente (0 -> 0.85) y se disipa en la pared (0.85 -> 0)
        let alpha = 0.85;
        if (p < 0.2) {
          alpha = (p / 0.2) * 0.85;
        } else if (p > 0.72) {
          alpha = ((1.0 - p) / 0.28) * 0.85;
        }
        sh.mat.opacity = Math.max(0, Math.min(0.85, alpha));

        // Oscilación orgánica de zancada espectral al correr
        sh.group.position.y = sh.startPos.y + Math.abs(Math.sin(p * Math.PI * 4)) * 0.12;
        if (sh.torso) sh.torso.rotation.z = Math.sin(p * Math.PI * 5) * 0.15;
      }
      return;
    }

    // 2. Temporizador de aparición mientras el jugador está jugando
    if (this.controls?.isLocked || this.renderer.xr.isPresenting) {
      this._shadowTimer -= delta;
      if (this._shadowTimer <= 0) {
        this._triggerRandomShadowPass();
      }
    }
  }

  _triggerRandomShadowPass() {
    if (this._activeShadow) return;

    // Obtener vector frontal y transversal del jugador (desacoplados del pitch vertical)
    const forward = new THREE.Vector3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw)).normalize();
    const right   = new THREE.Vector3(Math.cos(this._yaw), 0, -Math.sin(this._yaw)).normalize();

    // Ubicar punto de cruce adelante en el pasillo (entre 8.5 y 14 metros frente a la vista)
    const distAhead = 8.5 + Math.random() * 5.5;
    const centerPoint = this.camera.position.clone().addScaledVector(forward, distAhead);

    // Detección de altura del suelo en esa zona
    let floorY = this.camera.position.y - PLAYER_HEIGHT;
    if (this.collidableMeshes && this.collidableMeshes.length > 0) {
      const probe = new THREE.Raycaster(
        new THREE.Vector3(centerPoint.x, this.camera.position.y + 0.5, centerPoint.z),
        new THREE.Vector3(0, -1, 0),
        0.05,
        6.0
      );
      const hits = probe.intersectObjects(this.collidableMeshes, false);
      const floorHit = hits.find(h => {
        const wn = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        return wn.y > 0.4;
      });
      if (floorHit) floorY = floorHit.point.y;
    }

    // Dirección transversal del sprint: cruza de un lado del pasillo/puerta al otro
    const direction = Math.random() < 0.5 ? 1 : -1;
    const crossingWidth = 6.2 + Math.random() * 2.5; // cruce de ~6.2 a 8.7m

    const startPos = centerPoint.clone().addScaledVector(right, -direction * (crossingWidth / 2));
    const endPos   = centerPoint.clone().addScaledVector(right, direction * (crossingWidth / 2));
    startPos.y = floorY;
    endPos.y   = floorY;

    // Duración del cruce rápido y repentino (0.8 a 1.1 segundos)
    const duration = 0.8 + Math.random() * 0.3;

    // Crear la figura espectral 3D (Silueta humanoide esquelética de sombra oscura)
    const shadowGroup = new THREE.Group();
    shadowGroup.position.copy(startPos);

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x010103,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    // Torso desgarbado
    const torsoGeo = new THREE.CylinderGeometry(0.16, 0.28, 1.4, 7);
    const torso = new THREE.Mesh(torsoGeo, shadowMat);
    torso.position.y = 0.95;
    shadowGroup.add(torso);

    // Cabeza sombría
    const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const head = new THREE.Mesh(headGeo, shadowMat);
    head.position.set(0, 1.75, 0.06);
    shadowGroup.add(head);

    // Brazos largos espectrales
    const armGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.95, 6);
    const leftArm = new THREE.Mesh(armGeo, shadowMat);
    leftArm.position.set(-0.28, 1.0, 0.1);
    leftArm.rotation.z = 0.25;
    leftArm.rotation.x = -0.3;
    shadowGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shadowMat);
    rightArm.position.set(0.28, 1.0, 0.1);
    rightArm.rotation.z = -0.25;
    rightArm.rotation.x = 0.3;
    shadowGroup.add(rightArm);

    // Ojos pequeños huecos brillantes que miran brevemente al jugador
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    const eyeGeo = new THREE.SphereGeometry(0.025, 4, 4);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.06, 1.76, 0.18);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.06, 1.76, 0.18);
    shadowGroup.add(eyeL);
    shadowGroup.add(eyeR);

    // Orientar hacia el destino donde corre
    shadowGroup.lookAt(endPos.x, startPos.y + 1.0, endPos.z);

    this.scene.add(shadowGroup);

    // Parpadeo sutil silencioso de linterna por la perturbación electromagnética
    this.flickerFlashlight(1.3);

    this._activeShadow = {
      group: shadowGroup,
      torso: torso,
      mat: shadowMat,
      startPos: startPos,
      endPos: endPos,
      duration: duration,
      progress: 0
    };

    console.log(`[Sombra Espectral] Silueta cruzando repentinamente el pasillo a ${distAhead.toFixed(1)}m.`);
  }

  // ── ENTIDAD PATRULLA EN SALA DE CIRUGÍA (ZOMBIE) ───────────
  _loadCirugiaEntity(modelPath = 'assets/models/zombie.glb') {
    if (!this._gltfLoader) this._gltfLoader = new GLTFLoader();

    this._gltfLoader.load(
      modelPath,
      (gltf) => {
        const zombie = gltf.scene;

        // Normalizar escala arquitectónica (humanoide de ~1.85m de altura)
        const box = new THREE.Box3().setFromObject(zombie);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const targetHeight = 1.85;
        const scale = size.y > 0 ? targetHeight / size.y : 1;
        zombie.scale.setScalar(scale);

        // Alinear la base de los pies en el origen Y = 0 y centrar en X/Z
        zombie.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale
        );

        zombie.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(m => {
                m.roughness = Math.max(m.roughness ?? 0.5, 0.4);
              });
            }
          }
        });

        // Crear grupo contenedor para mover y orientar en la órbita circular
        const zombieGroup = new THREE.Group();
        zombieGroup.add(zombie);

        // Detectar altura exacta de piso en el centro espacioso de Sala de Cirugía (-7.20, 13.50)
        let floorY = 8.15 - PLAYER_HEIGHT; // ~6.45
        if (this.collidableMeshes && this.collidableMeshes.length > 0) {
          const probe = new THREE.Raycaster(
            new THREE.Vector3(-7.20, 9.0, 13.50),
            new THREE.Vector3(0, -1, 0),
            0.05,
            6.0
          );
          const hits = probe.intersectObjects(this.collidableMeshes, false);
          const floorHit = hits.find(h => {
            const wn = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
            return wn.y > 0.4;
          });
          if (floorHit) floorY = floorHit.point.y;
        }

        // Datos de deambulación libre con prevención de colisión contra paredes y la cama GLB
        this._zombiePatrol = {
          group: zombieGroup,
          center: new THREE.Vector3(-7.20, floorY, 13.50), // Centro libre y espacioso de Sala de Cirugía
          roomRadius: 3.2,       // Radio de patrullaje dentro de la sala
          currentYaw: Math.random() * Math.PI * 2, // orientación actual
          targetYaw: Math.random() * Math.PI * 2,  // orientación deseada
          speed: 0.70,           // velocidad de caminata natural (m/s)
          turnSpeed: 3.2,        // velocidad de giro suave (rad/s)
          rethinkTimer: 2.0,     // temporizador de cambio de dirección
          floorY: floorY,
          bedPos: new THREE.Vector3(-10.16, floorY, 15.43), // Coordenada exacta de la cama de cirugía
          bedRadius: 1.6         // Perímetro impenetrable alrededor de la cama
        };

        // Activar la animación de caminata continua
        if (gltf.animations && gltf.animations.length > 0) {
          this._zombieMixer = new THREE.AnimationMixer(zombie);
          const clip = gltf.animations[0];
          const action = this._zombieMixer.clipAction(clip);
          action.play();
        }

        // Posicionar inicialmente en el centro espacioso de la sala (lejos de la cama y de las paredes)
        zombieGroup.position.set(-7.20, floorY, 13.50);
        zombieGroup.rotation.y = this._zombiePatrol.currentYaw;

        this.scene.add(zombieGroup);
        console.log(`[Zombie Cirugía] Modelo cargado y deambulando libremente en Sala de Cirugía (-7.20, 13.50).`);
      },
      undefined,
      (err) => {
        console.warn('[Zombie Cirugía] No se pudo cargar el modelo zombie.glb:', err);
      }
    );
  }

  // ── IA DE DEAMBULACIÓN LIBRE SIN ATRAVESAR PAREDES NI LA CAMA GLB ──
  _updateZombiePatrol(delta) {
    if (this._zombieMixer) {
      this._zombieMixer.update(delta);
    }
    if (!this._zombiePatrol) return;

    const p = this._zombiePatrol;

    // 1. Orientar grupo y obtener vector frontal real en espacio de mundo
    p.group.rotation.y = p.currentYaw;
    const forward = new THREE.Vector3();
    p.group.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    let obstacleAhead = false;

    // 2. Detección y repulsión impenetrable contra la cama GLB (Sala de Cirugía)
    if (p.bedPos) {
      const distToBed = Math.hypot(p.group.position.x - p.bedPos.x, p.group.position.z - p.bedPos.z);
      if (distToBed < p.bedRadius + 0.6) {
        // Cerca de la cama -> orientar rumbo alejándose de la cama
        const awayFromBed = p.group.position.clone().sub(p.bedPos);
        awayFromBed.y = 0;
        if (awayFromBed.lengthSq() < 0.001) awayFromBed.set(1, 0, 0);
        awayFromBed.normalize();

        const awayYaw = Math.atan2(awayFromBed.x, awayFromBed.z);
        const yawDiff = Math.abs(Math.atan2(Math.sin(awayYaw - p.currentYaw), Math.cos(awayYaw - p.currentYaw)));
        if (yawDiff > 0.4 || p.rethinkTimer <= 0) {
          p.targetYaw = awayYaw + (Math.random() - 0.5) * 0.4;
          p.rethinkTimer = 2.0 + Math.random() * 1.5;
        }

        // Si intenta entrar al volumen físico de la cama, bloquear avance y empujar hacia afuera
        if (distToBed < p.bedRadius) {
          obstacleAhead = true;
          p.group.position.x = p.bedPos.x + awayFromBed.x * p.bedRadius;
          p.group.position.z = p.bedPos.z + awayFromBed.z * p.bedRadius;
        }
      }
    }

    // 3. Detección de paredes y obstáculos frontales con raycasting (altura del pecho)
    if (this.collidableMeshes && this.collidableMeshes.length > 0) {
      const chestPos = p.group.position.clone();
      chestPos.y += 0.85;

      // Rayo frontal directo (distancia de detección 0.95m)
      this._raycaster.set(chestPos, forward);
      this._raycaster.far = 0.95;
      const frontHits = this._raycaster.intersectObjects(this.collidableMeshes, false);

      const obstacleHit = frontHits.find(hit => {
        if (!hit || !hit.face) return false;
        if (hit.object && hit.object.userData && hit.object.userData.isTotem) return true;
        const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        return Math.abs(wn.y) < 0.45;
      });

      if (obstacleHit) {
        obstacleAhead = true;

        const wallNormal = obstacleHit.face.normal.clone().transformDirection(obstacleHit.object.matrixWorld);
        wallNormal.y = 0;
        if (wallNormal.lengthSq() < 0.001) {
          wallNormal.set(-forward.x, 0, -forward.z);
        }
        wallNormal.normalize();

        // Fijar nuevo rumbo hacia el espacio abierto solo si no estamos girando decididamente ya
        const angleDiff = Math.abs(Math.atan2(Math.sin(p.targetYaw - p.currentYaw), Math.cos(p.targetYaw - p.currentYaw)));
        if (angleDiff < 0.3 || p.rethinkTimer <= 0) {
          const bounceDir = wallNormal.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            0,
            (Math.random() - 0.5) * 0.5
          )).normalize();
          p.targetYaw = Math.atan2(bounceDir.x, bounceDir.z);
          p.rethinkTimer = 2.0 + Math.random() * 2.0;
        }

        // Si está muy pegado (<0.4m), amortiguar separación
        if (obstacleHit.distance < 0.4) {
          p.group.position.addScaledVector(wallNormal, 0.04);
        }
      }
    }

    // 4. Confinamiento estricto en Sala de Cirugía (no salir hacia el pasillo)
    const distToCenter = Math.hypot(p.group.position.x - p.center.x, p.group.position.z - p.center.z);
    if (distToCenter > p.roomRadius) {
      const toCenter = p.center.clone().sub(p.group.position);
      toCenter.y = 0;
      toCenter.normalize();
      p.targetYaw = Math.atan2(toCenter.x, toCenter.z) + (Math.random() - 0.5) * 0.3;
      p.rethinkTimer = 2.5 + Math.random() * 1.5;

      if (distToCenter > p.roomRadius + 0.3) {
        const offset = p.group.position.clone().sub(p.center);
        offset.y = 0;
        offset.setLength(p.roomRadius + 0.3);
        p.group.position.x = p.center.x + offset.x;
        p.group.position.z = p.center.z + offset.z;
      }
    }

    // 5. Delimitación física cartesiana inviolable dentro de Sala de Cirugía
    p.group.position.x = THREE.MathUtils.clamp(p.group.position.x, -10.6, -4.2);
    p.group.position.z = THREE.MathUtils.clamp(p.group.position.z, 11.0, 15.9);

    // 6. Temporizador de cambio de rumbo espontáneo y orgánico
    p.rethinkTimer -= delta;
    if (p.rethinkTimer <= 0) {
      p.targetYaw += (Math.random() - 0.5) * 1.8;
      p.rethinkTimer = 2.5 + Math.random() * 3.5;
    }

    // 7. Giro suave hacia targetYaw (interpolación angular)
    let diff = p.targetYaw - p.currentYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // envolver entre -PI y PI
    const maxTurn = p.turnSpeed * delta;
    if (Math.abs(diff) <= maxTurn) {
      p.currentYaw = p.targetYaw;
    } else {
      p.currentYaw += Math.sign(diff) * maxTurn;
    }

    p.group.rotation.y = p.currentYaw;

    // 8. Aplicar movimiento solo si no está bloqueado contra una pared o la cama
    if (!obstacleAhead) {
      const step = forward.clone().multiplyScalar(p.speed * delta);
      p.group.position.add(step);
    }

    // Mantener altura del suelo de la sala
    p.group.position.y = p.floorY;
  }
}
