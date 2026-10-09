// ════════════════════════════════════════════════════════
//  HOSPITAL OLVIDADO — Motor 3D (Three.js + WebXR + WebGPU)
//  Carga el modelo GLB, gestiona colisiones, escaleras y VR
// ════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader }        from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
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
    this._nearItem         = null;        // ítem interactuable cercano
    this.collidableMeshes  = [];          // mallas para colisiones horizontales y suelo
    this.doorMeshes        = [];          // mallas de puertas
    this.controllers       = [];          // mandos WebXR
    this._totemGroups      = [];          // grupos de tótems 3D rotatorios

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
    this.camera.position.set(0, PLAYER_HEIGHT, 0);
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

  // ── CONTROLES (PointerLock para PC) ───────────────────────
  _initControls() {
    this.controls = new PointerLockControls(this.camera, document.body);
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
              child.userData = { workId: point.workId, label: point.label };
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
    // Probar candidatos de pasillo interior en planta baja (el pasillo central corre a lo largo de Z con X=0)
    const candidatePoints = [
      { x: 0, z: -2 },
      { x: 0, z: 0 },
      { x: 0, z: -5 },
      { x: 0, z: 2 },
      { x: 1, z: -2 },
      { x: -1, z: -2 }
    ];

    const probeRay = new THREE.Raycaster();
    let selectedSpawn = null;

    for (const cand of candidatePoints) {
      probeRay.set(new THREE.Vector3(cand.x, 16.0, cand.z), new THREE.Vector3(0, -1, 0));
      probeRay.far = 25.0;
      const hits = probeRay.intersectObjects(this.collidableMeshes, false);

      if (hits.length > 0) {
        // Encontrar el piso de la planta principal (suelo a Y ~ 6.44)
        const floorHit = hits.find(h => {
          const worldNormal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
          return worldNormal.y > 0.5 && h.point.y >= 5.0 && h.point.y <= 8.0;
        });
        if (floorHit) {
          selectedSpawn = new THREE.Vector3(cand.x, floorHit.point.y + PLAYER_HEIGHT, cand.z);
          break;
        }
      }
    }

    if (selectedSpawn) {
      this.camera.position.copy(selectedSpawn);
      console.log(`[Spawn] Jugador ubicado en el interior del hospital: (${selectedSpawn.x.toFixed(2)}, ${selectedSpawn.y.toFixed(2)}, ${selectedSpawn.z.toFixed(2)})`);
    } else {
      // Fallback exacto verificado sobre el suelo interior del pasillo (Y = 6.44 + 1.7 = 8.14)
      this.camera.position.set(0, 8.14, -2);
      console.log(`[Spawn] Usando fallback interior verificado: (0.00, 8.14, -2.00)`);
    }

    // Mirar hacia el fondo del pasillo (-Z)
    this.camera.rotation.set(0, 0, 0);
  }

  // ── INTERACCIÓN ──────────────────────────────────────────
  _tryInteract() {
    if (this._nearItem) {
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
      if (text) text.innerHTML = `<kbd>E</kbd> ${closest.label}`;
    } else {
      prompt?.classList.add('hidden');
    }
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

    this.renderer.render(this.scene, this.camera);
  }

  // ── MOVIMIENTO CON COLISIÓN DE PAREDES (Wall Sliding) ─────
  _updateMovement(delta) {
    if (!this.controls.isLocked && !this.renderer.xr.isPresenting) return;

    const speed = MOVE_SPEED * delta;
    const forward  = new THREE.Vector3();
    const right    = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const moveVel = new THREE.Vector3();

    if (this._keys['KeyW'] || this._keys['ArrowUp'])    moveVel.addScaledVector(forward, speed);
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  moveVel.addScaledVector(forward, -speed);
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  moveVel.addScaledVector(right, -speed);
    if (this._keys['KeyD'] || this._keys['ArrowRight']) moveVel.addScaledVector(right, speed);

    if (moveVel.lengthSq() > 0) {
      // Resolver colisiones con paredes antes de mover
      const allowedMove = this._resolveWallCollisions(moveVel);
      this.camera.position.add(allowedMove);

      // Sonido de pasos periódicos
      this._distWalked += allowedMove.length();
      if (this._distWalked >= FOOTSTEP_DIST) {
        this._distWalked = 0;
        audioManager.playFootstep();
      }
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

    // Rotación rígida continua de 360° en bucle infinito sobre su eje central vertical (eje Y)
    this._totemGroups?.forEach(totem => {
      totem.rotation.y += 0.012;
    });
  }

  /** Bloquea el puntero del mouse para el control de cámara */
  lockPointer() { this.controls.lock(); }
  unlockPointer() { this.controls.unlock(); }

  get isPointerLocked() { return this.controls.isLocked; }

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
}
