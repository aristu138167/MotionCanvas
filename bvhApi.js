import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";

// --- CONFIGURACIÓN DE ESCENA ---
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 20000);
camera.position.set(0, 200, 450);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 120, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 2);
scene.add(light);

THREE.Cache.enabled = true;

// --- MOTOR BVH ---
const clock = new THREE.Clock();
const rigs = [];
const mixers = [];
const activeTrails = [];
let frameCount = 0;
let runId = 0;
// --- MOTOR DE IA EN TIEMPO REAL (MEDIAPIPE) ---
const videoElement = document.getElementById('videoElement');
window.liveLandmarks = null; // Aquí guardaremos tus coordenadas 3D en vivo

// Añadimos window. delante de Pose
const pose = new window.Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 1, smoothLandmarks: true,
  minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
});

pose.onResults((results) => {
  if (results.poseWorldLandmarks) {
    window.liveLandmarks = results.poseWorldLandmarks;
  }
});

// Añadimos window. delante de Camera
const cameraAI = new window.Camera(videoElement, {
  onFrame: async () => { await pose.send({ image: videoElement }); },
  width: 640, height: 480
});
cameraAI.start();

// Definimos qué puntos se conectan con cuáles para dibujar el monigote
const POSE_CONNECTIONS = [
  // ESTRUCTURA CENTRAL (Torso)
  [11, 12], // Hombros
  [23, 24], // Caderas
  [11, 23], // Lateral Izquierdo
  [12, 24], // Lateral Derecho

  // BRAZO IZQUIERDO
  [11, 13], // Hombro a Codo
  [13, 15], // Codo a Muñeca
  [15, 17], [17, 19], [19, 15], // Palma/Nudillos
  [15, 21], // Pulgar

  // BRAZO DERECHO
  [12, 14], // Hombro a Codo
  [14, 16], // Codo a Muñeca
  [16, 18], [18, 20], [20, 16], // Palma/Nudillos
  [16, 22], // Pulgar

  // PIERNA IZQUIERDA
  [23, 25], // Cadera a Rodilla
  [25, 27], // Rodilla a Tobillo
  [27, 29], [29, 31], [31, 27], // Pie (Triángulo de apoyo)

  // PIERNA DERECHA
  [24, 26], // Cadera a Rodilla
  [26, 28], // Rodilla a Tobillo
  [28, 30], [30, 32], [32, 28], // Pie (Triángulo de apoyo)

  // CABEZA (Simplificada para que no distraiga pero dé dirección)
  [0, 11], [0, 12], // Nariz conectada a hombros para ver cuello
  [7, 8]    // Conexión entre orejas para dar ancho a la cabeza
];

const SB = {
  params: { speed: 1.0, pause: false, showSkeleton: true, globalScale: 1.0, rotSpeed: 0.0, reverse: false, color: null, trail: 0, delay: 0 },

  grid(size = 400, div = 10) { scene.add(new THREE.GridHelper(size, div)); return SB; },
  cam(x = 0, y = 200, z = 450, lx = 0, ly = 120, lz = 0) { camera.position.set(x, y, z); controls.target.set(lx, ly, lz); return SB; },
  background(color) { scene.background = new THREE.Color(color); return SB; },
  bg(color) { return this.background(color); },

  clear() {
    runId++; // Avanzamos el turno

    // 1. Limpiamos bailarines y animaciones
    for (const r of rigs) {
      if (r.mixer) r.mixer.stopAllAction();
      if (r.helper) scene.remove(r.helper);
      if (r.group) scene.remove(r.group);
    }

    // 2. Limpiamos rastros (Trails)
    for (const t of activeTrails) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    activeTrails.length = 0; rigs.length = 0; mixers.length = 0;

    // 3. Buscamos y destruimos TODAS las cuadrículas (Grids)
    const grids = scene.children.filter(obj => obj.type === "GridHelper");
    for (const g of grids) {
      scene.remove(g);
      g.geometry.dispose();
      g.material.dispose();
    }

    // 4. Paramos la rotación de la cámara (por si el código anterior tenía rot())
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;

    // 5. Devolvemos el fondo a su color gris oscuro por defecto
    scene.background = new THREE.Color(0x111111);

    return SB;
  },

  bvh(fileOrUrl) {
    const url = fileOrUrl.startsWith("http") ? fileOrUrl : "./assets/" + fileOrUrl + ".bvh";
    const handle = {
      _rawFile: fileOrUrl, _url: url, _x: 0, _y: 0, _z: 0, _rotX: 0, _rotY: 0, _rotZ: 0, _scale: null, _showSkeleton: null, _speed: null, _reverse: null, _color: null, _trail: null, _delay: null,
      x(v) { this._x = v; return this; }, y(v) { this._y = v; return this; }, z(v) { this._z = v; return this; },
      pos(x, y, z) { this._x = x; this._y = y; this._z = z; return this; },
      rotX(r) { this._rotX = r; return this; }, rotY(r) { this._rotY = r; return this; }, rotZ(r) { this._rotZ = r; return this; },
      scale(s) { this._scale = s; return this; }, skeleton(v) { this._showSkeleton = v; return this; },
      speed(v) { this._speed = v; return this; }, reverse(v = true) { this._reverse = v; return this; },
      color(c) { this._color = c; return this; }, trail(length) { this._trail = length; return this; }, delay(s) { this._delay = s; return this; },

      play() {
        const myRunId = runId;

        const loader = new BVHLoader();
        loader.load(this._url, (result) => {
          if (myRunId !== runId) return;

          const root = result.skeleton.bones[0];

          // 1. Grupo maestro para posición
          const group = new THREE.Group();
          group.position.set(this._x, this._y, this._z);

          // 2. Pivot para rotación exclusiva
          const pivot = new THREE.Group();
          pivot.rotation.x = this._rotX;
          pivot.rotation.y = this._rotY;
          pivot.rotation.z = this._rotZ;

          pivot.add(root);
          group.add(pivot);

          const sc = (this._scale ?? SB.params.globalScale);
          group.scale.setScalar(sc);
          scene.add(group);

          // 3. El helper a la escena para evitar bugs
          const helper = new THREE.SkeletonHelper(root);
          helper.skeleton = result.skeleton;
          const col = this._color ?? SB.params.color;
          if (col) { helper.material.vertexColors = false; helper.material.color.set(col); }
          helper.visible = (this._showSkeleton ?? SB.params.showSkeleton);
          scene.add(helper);

          const mixer = new THREE.AnimationMixer(root);
          const action = mixer.clipAction(result.clip); action.play();

          const isReversed = this._reverse ?? SB.params.reverse;
          if (isReversed) { action.time = result.clip.duration; }

          rigs.push({
            group, pivot, root, helper, mixer, action, clip: result.clip, timeAlive: 0,
            opts: { rotX: this._rotX, rotY: this._rotY, rotZ: this._rotZ, speed: (this._speed ?? 1.0), showSkeleton: (this._showSkeleton ?? null), scale: (this._scale ?? null), reverse: this._reverse, color: this._color, trail: this._trail, delay: this._delay }
          });
          mixers.push(mixer);
        }, undefined, (err) => { throw new Error("BVH load error (" + this._url + "): " + (err?.message || err)); });
        return this;
      }
    };
    return handle;
  },

  live() {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });

    const positions = new Float32Array(POSE_CONNECTIONS.length * 6);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const helper = new THREE.LineSegments(geometry, material);

    const rig = {
      isLive: true,
      isOld: false,
      visitedThisRun: true,
      timeAlive: 0,
      group: new THREE.Group(),
      helper: helper,
      opts: { scale: 100, color: null, trail: 0, delay: 0 }
    };

    rig.group.add(helper);
    scene.add(rig.group);
    rigs.push(rig);

    // EL PROXY COMPLETO: Ahora tiene .pos, .rotY, .z, etc.
    const p = {
      _isLive: true, // Etiqueta secreta para que duplicate() sepa qué es
      x(v) { rig.group.position.x = v; return p; },
      y(v) { rig.group.position.y = v; return p; },
      z(v) { rig.group.position.z = v; return p; },
      pos(x, y, z) { rig.group.position.set(x, y, z); return p; },
      rotX(v) { rig.group.rotation.x = v; return p; },
      rotY(v) { rig.group.rotation.y = v; return p; },
      rotZ(v) { rig.group.rotation.z = v; return p; },
      scale(v) { rig.opts.scale = v * 100; return p; },
      color(c) { rig.helper.material.color.set(c); return p; },
      trail(v) { rig.opts.trail = v; return p; },
      delay(v) { rig.opts.delay = v; return p; },
      play() { return p; }
    };
    return p;
  },

  duplicate(originalHandle) {
    if (!originalHandle) throw new Error("duplicate() necesita una variable.");

    let newHandle;

    // 1. ¿Es un clon de la webcam o de un archivo .bvh?
    if (originalHandle._isLive) {
      newHandle = this.live(); // Creamos un nuevo clon de la cámara
    } else if (originalHandle._rawFile) {
      newHandle = this.bvh(originalHandle._rawFile); // Creamos un clon del archivo
    } else {
      throw new Error("Objeto no válido para duplicar.");
    }

    // 2. Tu Optimización: Copiamos todos los datos privados de un solo golpe
    const keys = ["_x", "_y", "_z", "_scale", "_rotY", "_showSkeleton", "_speed", "_reverse", "_color", "_trail", "_delay"];
    keys.forEach(k => {
      // Solo copiamos si la propiedad existe en el original (por si al Live le falta alguna)
      if (originalHandle[k] !== undefined) {
        newHandle[k] = originalHandle[k];
      }
    });

    return newHandle;
  },

  speed(v) { SB.params.speed = v; return SB; }, pause(v = true) { SB.params.pause = v; return SB; },
  skeleton(v = true) { SB.params.showSkeleton = v; return SB; }, scale(v) { SB.params.globalScale = v; return SB; },
  rot(v) {
    SB.params.rotSpeed = v;
    if (v !== 0) { controls.autoRotate = true; controls.autoRotateSpeed = v * 20; }
    else { controls.autoRotate = false; }
    return SB;
  },
  reverse(v = true) { SB.params.reverse = v; return SB; },
  color(c) { SB.params.color = c; return SB; }, trail(v) { SB.params.trail = v; return SB; }, delay(s) { SB.params.delay = s; return SB; },

  _tick() {
    const dt = clock.getDelta(); frameCount++;
    for (const r of rigs) {
      // --- MAGIA LIVE (AÑADIDO PARA LA WEBCAM) ---
      if (r.isLive && window.liveLandmarks && r.helper) {
        const positions = r.helper.geometry.attributes.position.array;
        let index = 0;
        const scale = (r.opts.scale ?? SB.params.globalScale); // Quitamos el *100 de aquí porque ya lo hace el proxy

        // Actualizamos las líneas de tu cuerpo 3D
        for (const [p1, p2] of POSE_CONNECTIONS) {
          const lm1 = window.liveLandmarks[p1];
          const lm2 = window.liveLandmarks[p2];

          positions[index++] = lm1.x * scale;
          positions[index++] = -lm1.y * scale;
          positions[index++] = -lm1.z * scale;

          positions[index++] = lm2.x * scale;
          positions[index++] = -lm2.y * scale;
          positions[index++] = -lm2.z * scale;
        }
        r.helper.geometry.attributes.position.needsUpdate = true;
      }
      // ------------------------------------------
      if (r.group && !r.isLive) {
        const s = (r.opts.scale ?? SB.params.globalScale);
        r.group.scale.setScalar(s);
      }

      if (r.helper) { r.helper.visible = (r.opts.showSkeleton ?? SB.params.showSkeleton); }

      const trailLen = r.opts.trail ?? SB.params.trail;
      const delayTime = r.opts.delay ?? SB.params.delay;
      if (!SB.params.pause && trailLen > 0 && frameCount % 6 === 0 && r.helper && r.timeAlive >= delayTime) {
        const snapGeom = r.helper.geometry.clone(); snapGeom.applyMatrix4(r.helper.matrixWorld);
        const snapMat = r.helper.material.clone(); snapMat.transparent = true; snapMat.opacity = 0.6;
        const snapLine = new THREE.LineSegments(snapGeom, snapMat); scene.add(snapLine);
        activeTrails.push({ mesh: snapLine, life: 0.6, decay: 0.6 / trailLen });
      }
    }

    for (let i = activeTrails.length - 1; i >= 0; i--) {
      const t = activeTrails[i]; t.life -= t.decay; t.mesh.material.opacity = t.life;
      if (t.life <= 0) { scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); activeTrails.splice(i, 1); }
    }

    if (!SB.params.pause) {
      for (let i = 0; i < mixers.length; i++) {
        const r = rigs[i]; const delayTime = r.opts?.delay ?? SB.params.delay;

        const tiempoAnterior = r.timeAlive;
        r.timeAlive += dt;

        if (r.timeAlive < delayTime) continue;

        let tiempoActivo = dt;
        if (tiempoAnterior < delayTime) {
          tiempoActivo = r.timeAlive - delayTime;
        }

        const localSpeed = r?.opts?.speed ?? 1.0; const isReversed = r.opts?.reverse ?? SB.params.reverse;
        mixers[i].timeScale = SB.params.speed * localSpeed * (isReversed ? -1 : 1);
        if (isReversed && r.action && r.clip) { if (r.action.time <= 0.0001) r.action.time = r.clip.duration; }

        mixers[i].update(tiempoActivo);
      }
    }
  }
};

window.clear = () => SB.clear(); window.grid = (a, b) => SB.grid(a, b);
window.cam = (x, y, z, lx, ly, lz) => SB.cam(x, y, z, lx, ly, lz); window.bvh = (fileOrUrl) => SB.bvh(fileOrUrl);
window.speed = (v) => SB.speed(v); window.pause = (v = true) => SB.pause(v);
window.skeleton = (v = true) => SB.skeleton(v); window.scale = (v) => SB.scale(v);
window.rot = (v) => SB.rot(v); window.reverse = (v) => SB.reverse(v);
window.color = (c) => SB.color(c); window.trail = (l) => SB.trail(l);
window.delay = (s) => SB.delay(s); window.duplicate = (h) => SB.duplicate(h);
window.background = (c) => SB.background(c); window.bg = (c) => SB.bg(c);
window.live = () => SB.live();

function resize() {
  const w = canvas.clientWidth; const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

function animate() { resize(); controls.update(); SB._tick(); renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

// --- SISTEMA LIVE CODING (GIBBER STYLE) ---
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'execute') {
    try {
      // Ejecutamos el código que nos manda el editor al vuelo
      const ejecutar = new Function(event.data.code);
      ejecutar();
    } catch (error) {
      // Si hay un error (ej. escribes mal una variable), le avisamos a app.js
      window.parent.postMessage({ type: 'error', message: error.stack || error.message }, '*');
    }
  }
});

// Avisamos a la ventana principal de que el motor ya ha arrancado y está listo
window.parent.postMessage({ type: 'ready' }, '*');