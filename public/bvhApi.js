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

const SB = {
  params: { speed: 1.0, pause: false, showSkeleton: true, globalScale: 1.0, rotSpeed: 0.0, reverse: false, color: null, trail: 0, delay: 0 },

  grid(size = 400, div = 10) { scene.add(new THREE.GridHelper(size, div)); return SB; },
  cam(x = 0, y = 200, z = 450, lx = 0, ly = 120, lz = 0) { camera.position.set(x, y, z); controls.target.set(lx, ly, lz); return SB; },
  background(color) { scene.background = new THREE.Color(color); return SB; },
  bg(color) { return this.background(color); },

  clear() {
    for (const r of rigs) {
      if (r.mixer) r.mixer.stopAllAction(); // Limpieza optimizada
      if (r.helper) scene.remove(r.helper);
      if (r.group) scene.remove(r.group);
    }
    for (const t of activeTrails) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    activeTrails.length = 0; rigs.length = 0; mixers.length = 0;
    return SB;
  },

  bvh(fileOrUrl) {
    const url = fileOrUrl.startsWith("http") ? fileOrUrl : "/assets/" + fileOrUrl + ".bvh";
    const handle = {
      _rawFile: fileOrUrl, _url: url, _x: 0, _y: 0, _z: 0, _scale: null, _rotY: 0, _showSkeleton: null, _speed: null, _reverse: null, _color: null, _trail: null, _delay: null,
      x(v) { this._x = v; return this; }, y(v) { this._y = v; return this; }, z(v) { this._z = v; return this; },
      pos(x, y, z) { this._x = x; this._y = y; this._z = z; return this; }, scale(s) { this._scale = s; return this; },
      rotY(r) { this._rotY = r; return this; }, skeleton(v) { this._showSkeleton = v; return this; },
      speed(v) { this._speed = v; return this; }, reverse(v = true) { this._reverse = v; return this; },
      color(c) { this._color = c; return this; }, trail(length) { this._trail = length; return this; }, delay(s) { this._delay = s; return this; },

      play() {
        const loader = new BVHLoader();
        loader.load(this._url, (result) => {
          const root = result.skeleton.bones[0];

          // 1. Grupo maestro para posición
          const group = new THREE.Group();
          group.position.set(this._x, this._y, this._z);

          // 2. Pivot para rotación exclusiva
          const pivot = new THREE.Group();
          pivot.rotation.y = this._rotY;

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
            opts: { rotY: this._rotY, speed: (this._speed ?? 1.0), showSkeleton: (this._showSkeleton ?? null), scale: (this._scale ?? null), reverse: this._reverse, color: this._color, trail: this._trail, delay: this._delay }
          });
          mixers.push(mixer);
        }, undefined, (err) => { throw new Error("BVH load error (" + this._url + "): " + (err?.message || err)); });
        return this;
      }
    };
    return handle;
  },

  duplicate(originalHandle) {
    if (!originalHandle || !originalHandle._rawFile) throw new Error("duplicate() necesita una variable.");
    const newHandle = this.bvh(originalHandle._rawFile);
    // Optimización: Copiamos todos los datos privados de un solo golpe
    const keys = ["_x", "_y", "_z", "_scale", "_rotY", "_showSkeleton", "_speed", "_reverse", "_color", "_trail", "_delay"];
    keys.forEach(k => newHandle[k] = originalHandle[k]);
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
      if (r.group) {
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

function resize() {
  const w = canvas.clientWidth; const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

function animate() { resize(); controls.update(); SB._tick(); renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();