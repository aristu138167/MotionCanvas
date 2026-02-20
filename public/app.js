function escapeForScript(code) {
  let safeCode = code.replace(/<\/script>/gi, "<\\/script>");
  
  // Truco para el Live-Coding: Convertir asignaciones directas en variables globales
  // Ej: "bailarin1 = bvh()" se transforma internamente en "window.bailarin1 = bvh()"
  const lines = safeCode.split('\n');
  const processed = lines.map(line => {
    // Si la línea ya empieza por const, let o var, no la tocamos
    if (/^\s*(const|let|var)\s/.test(line)) return line;
    
    // Si la línea es una asignación (variable = valor), le ponemos "window." delante
    return line.replace(/^\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=(?!=)/, 'window.$1 =');
  });
  
  return processed.join('\n');
}

function buildPreviewHtml(userCode) {
  const threeVersion = "0.159.0";
  const threeModule = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/build/three.module.js`;
  const orbitControls = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/controls/OrbitControls.js`;
  const bvhLoader = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/loaders/BVHLoader.js`;

  const prelude = `
import * as THREE from "three";
import { OrbitControls } from "${orbitControls}";
import { BVHLoader } from "${bvhLoader}";

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 2000);
camera.position.set(0, 200, 450);
camera.lookAt(0, 120, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 2);
scene.add(light);

// ================= HYDRA-LIKE BVH API (globals) =================
${bvhApi}
// ================================================================

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  resize();
  controls.update();
  SB._tick();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html, body { margin:0; height:100%; overflow:hidden; background:#111; }
    canvas { width:100%; height:100%; display:block; }
    #err {
      position:fixed; left:0; right:0; bottom:0;
      max-height:40%;
      overflow:auto;
      font:12px/1.4 Consolas, monospace;
      color:#ffb4b4;
      background:rgba(0,0,0,0.70);
      padding:10px;
      white-space:pre-wrap;
      display:none;
    }
  </style>

  <script type="importmap">
    {
      "imports": {
        "three": "${threeModule}"
      }
    }
  </script>
</head>
<body>
  <canvas id="c"></canvas>
  <div id="err"></div>

  <script type="module">
    const errBox = document.getElementById("err");
    function showErr(msg) {
      errBox.style.display = "block";
      errBox.textContent += "\\n" + msg;
    }
    window.addEventListener("error", (e) => showErr(e.error?.stack || e.message || e.type));
    window.addEventListener("unhandledrejection", (e) => showErr(e.reason?.stack || e.reason || "Unhandled rejection"));

    ${prelude}

    try {
      ${escapeForScript(userCode)}
    } catch (e) {
      showErr(e?.stack || e);
    }

    animate();
  </script>
</body>
</html>`;
}

const defaultCode = `clear();
grid(400, 10);
cam(0, 200, 450, 0, 100, 0);

bailarin1 = bvh("pirouette").x(-80).color("#ff0000").trail(100000).play();
duplicate(bailarin1).x(0).color("#ffffff").play();
duplicate(bailarin1).x(80).color("#0000ff").play();
duplicate(bailarin1).x(-80).z(-80).color("#00ffff").play();
duplicate(bailarin1).x(0).z(-80).color("#00ff00").play();
duplicate(bailarin1).x(80).z(-80).color("#ffff00").play();
`;
const bvhApi = `
  const clock = new THREE.Clock();
  const rigs = [];   
  const mixers = []; 
  const activeTrails = []; 
  let frameCount = 0;      

  const SB = {
    params: {
      speed: 1.0,
      pause: false,
      showSkeleton: true,
      globalScale: 1.0,
      rotSpeed: 0.0,
      reverse: false,
      color: null,
      trail: 0,
      delay: 0
    },

    grid(size=400, div=10) {
      scene.add(new THREE.GridHelper(size, div));
      return SB;
    },

    cam(x=0, y=200, z=450, lx=0, ly=120, lz=0) {
      camera.position.set(x, y, z);
      camera.lookAt(lx, ly, lz);
      return SB;
    },

    clear() {
      for (const r of rigs) {
        if (r.action) r.action.stop();
        if (r.mixer) r.mixer.stopAllAction();
        if (r.helper) scene.remove(r.helper);
        if (r.root) scene.remove(r.root);
      }
      for (const t of activeTrails) {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
      }
      activeTrails.length = 0;
      rigs.length = 0;
      mixers.length = 0;
      return SB;
    },

    bvh(fileOrUrl) {
      const url = fileOrUrl.startsWith("http") ? fileOrUrl : "/assets/" + fileOrUrl + ".bvh";

      const handle = {
        _rawFile: fileOrUrl,
        _url: url,
        _x: 0, _y: 0, _z: 0,
        _scale: null,
        _rotY: 0,
        _showSkeleton: null,
        _speed: null,
        _reverse: null,
        _color: null,
        _trail: null,
        _delay: null,

        x(v){ this._x=v; return this; },
        y(v){ this._y=v; return this; },
        z(v){ this._z=v; return this; },
        pos(x,y,z){ this._x=x; this._y=y; this._z=z; return this; },
        scale(s){ this._scale=s; return this; },
        rotY(r){ this._rotY=r; return this; },
        skeleton(v){ this._showSkeleton=v; return this; },
        speed(v){ this._speed=v; return this; },
        reverse(v=true){ this._reverse=v; return this; },
        color(c){ this._color=c; return this; },
        trail(length){ this._trail=length; return this; },
        delay(s){ this._delay=s; return this; },

        play() {
          const loader = new BVHLoader();
          loader.load(
            this._url,
            (result) => {
              const root = result.skeleton.bones[0];

              const group = new THREE.Group();
              group.position.set(this._x, this._y, this._z);
              group.rotation.y = this._rotY;

              const helper = new THREE.SkeletonHelper(root);
              helper.skeleton = result.skeleton;

              const col = this._color ?? SB.params.color;
              if (col) {
                helper.material.vertexColors = false;
                helper.material.color.set(col);
              }

              group.add(root);
              group.add(helper);

              const sc = (this._scale ?? SB.params.globalScale);
              group.scale.setScalar(sc);

              helper.visible = (this._showSkeleton ?? SB.params.showSkeleton);

              scene.add(group);

              const mixer = new THREE.AnimationMixer(root);
              const action = mixer.clipAction(result.clip);
              action.play();
              
              const isReversed = this._reverse ?? SB.params.reverse;
              if (isReversed) {
                action.time = result.clip.duration;
              }

              rigs.push({
                root, helper, mixer, action,
                clip: result.clip,
                timeAlive: 0, 
                opts: {
                  speed: (this._speed ?? 1.0),
                  showSkeleton: (this._showSkeleton ?? null),
                  scale: (this._scale ?? null),
                  reverse: this._reverse,
                  color: this._color,
                  trail: this._trail,
                  delay: this._delay 
                }
              });
              mixers.push(mixer);
            },
            undefined,
            (err) => { throw new Error("BVH load error (" + this._url + "): " + (err?.message || err)); }
          );
          return this;
        }
      };

      return handle;
    },

    duplicate(originalHandle) {
      if (!originalHandle || !originalHandle._rawFile) {
        throw new Error("duplicate() necesita una variable BVH válida (ej: bailarin1).");
      }
      const newHandle = this.bvh(originalHandle._rawFile);
      newHandle._x = originalHandle._x;
      newHandle._y = originalHandle._y;
      newHandle._z = originalHandle._z;
      newHandle._scale = originalHandle._scale;
      newHandle._rotY = originalHandle._rotY;
      newHandle._showSkeleton = originalHandle._showSkeleton;
      newHandle._speed = originalHandle._speed;
      newHandle._reverse = originalHandle._reverse;
      newHandle._color = originalHandle._color;
      newHandle._trail = originalHandle._trail;
      newHandle._delay = originalHandle._delay; 
      return newHandle;
    },

    speed(v){ SB.params.speed = v; return SB; },
    pause(v=true){ SB.params.pause = v; return SB; },
    skeleton(v=true){ SB.params.showSkeleton = v; return SB; },
    scale(v){ SB.params.globalScale = v; return SB; },
    rot(v){ SB.params.rotSpeed = v; return SB; },
    reverse(v=true){ SB.params.reverse = v; return SB; },
    color(c){ SB.params.color = c; return SB; },
    trail(v){ SB.params.trail = v; return SB; },
    delay(s){ SB.params.delay = s; return SB; }, 

    _tick() {
      const dt = clock.getDelta();
      frameCount++;

      for (const r of rigs) {
        if (r.root) {
          r.root.rotation.y += dt * SB.params.rotSpeed;
          const s = (r.opts.scale ?? SB.params.globalScale);
          r.root.scale.setScalar(s);
        }
        if (r.helper) {
          const vis = (r.opts.showSkeleton ?? SB.params.showSkeleton);
          r.helper.visible = vis;
        }

        const trailLen = r.opts.trail ?? SB.params.trail;
        const delayTime = r.opts.delay ?? SB.params.delay;

        if (!SB.params.pause && trailLen > 0 && frameCount % 3 === 0 && r.helper && r.timeAlive >= delayTime) {
          const snapGeom = r.helper.geometry.clone();
          snapGeom.applyMatrix4(r.helper.matrixWorld); 

          const snapMat = r.helper.material.clone();
          snapMat.transparent = true;
          snapMat.opacity = 0.6; 

          const snapLine = new THREE.LineSegments(snapGeom, snapMat);
          scene.add(snapLine); 

          activeTrails.push({
            mesh: snapLine,
            life: 0.6,
            decay: 0.6 / trailLen
          });
        }
      }

      for (let i = activeTrails.length - 1; i >= 0; i--) {
        const t = activeTrails[i];
        t.life -= t.decay;
        t.mesh.material.opacity = t.life;

        if (t.life <= 0) {
          scene.remove(t.mesh);
          t.mesh.geometry.dispose(); 
          t.mesh.material.dispose();
          activeTrails.splice(i, 1);
        }
      }

      if (!SB.params.pause) {
        for (let i=0;i<mixers.length;i++){
          const r = rigs[i];
          const delayTime = r.opts?.delay ?? SB.params.delay;

          r.timeAlive += dt;

          if (r.timeAlive < delayTime) continue;

          const localSpeed = r?.opts?.speed ?? 1.0;
          const isReversed = r.opts?.reverse ?? SB.params.reverse;
          const dir = isReversed ? -1 : 1;
          
          mixers[i].timeScale = SB.params.speed * localSpeed * dir;
          
          if (isReversed && r.action && r.clip) {
            const dur = r.clip.duration;
            if (r.action.time <= 0.0001) r.action.time = dur;
          }
          
          mixers[i].update(dt);
        }
      }
    }
  };

  window.clear = () => SB.clear();
  window.grid = (a,b) => SB.grid(a,b);
  window.cam = (x,y,z,lx,ly,lz) => SB.cam(x,y,z,lx,ly,lz);
  window.bvh = (fileOrUrl) => SB.bvh(fileOrUrl);
  window.speed = (v) => SB.speed(v);
  window.pause = (v=true) => SB.pause(v);
  window.skeleton = (v=true) => SB.skeleton(v);
  window.scale = (v) => SB.scale(v);
  window.rot = (v) => SB.rot(v);
  window.reverse = (v) => SB.reverse(v);
  window.color = (c) => SB.color(c);
  window.trail = (l) => SB.trail(l);
  window.delay = (s) => SB.delay(s);
  window.duplicate = (h) => SB.duplicate(h);
`;

const iframe = document.getElementById("preview");
const codeEl = document.getElementById("code");
const runBtn = document.getElementById("run");
const toggleBtn = document.getElementById("toggle");
const overlay = document.getElementById("overlay");

// codeEl.value = localStorage.getItem("sbcode_lite_code") || defaultCode;
localStorage.removeItem("sbcode_lite_code");
codeEl.value = defaultCode;

function run() {
  localStorage.setItem("sbcode_lite_code", codeEl.value);
  iframe.srcdoc = buildPreviewHtml(codeEl.value);
}

runBtn.addEventListener("click", run);

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    run();
  }
});

let prevSize = null; // { width, height }

toggleBtn.addEventListener("click", () => {
  const minimized = overlay.classList.toggle("minimized");

  if (minimized) {
    // guarda tamaño actual (incluye el que vino de resize)
    prevSize = {
      width: overlay.style.width || "",
      height: overlay.style.height || "",
    };

    // mantener el ancho actual, pero colapsar altura a la cabecera
    overlay.style.height = bar.offsetHeight + "px";

    // (opcional) si quieres fijar también el ancho actual por si estaba en %
    // overlay.style.width = overlay.offsetWidth + "px";

    toggleBtn.textContent = "Show";
  } else {
    // restaurar tamaño previo
    if (prevSize) {
      overlay.style.width = prevSize.width;
      overlay.style.height = prevSize.height;
    } else {
      overlay.style.width = "";
      overlay.style.height = "";
    }

    toggleBtn.textContent = "Hide";
  }
});

// --- DRAG del overlay---
let dragging = false;
let startX = 0, startY = 0;
let startLeft = 0, startTop = 0;

const bar = document.getElementById("bar");

bar.addEventListener("pointerdown", (e) => {
  // Si pinchas un botón, no arrastres
  const t = e.target;
  if (t && t.tagName === "BUTTON") return;

  dragging = true;
  bar.setPointerCapture(e.pointerId);

  const rect = overlay.getBoundingClientRect();
  startX = e.clientX;
  startY = e.clientY;
  startLeft = rect.left;
  startTop = rect.top;
});

window.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  const left = Math.max(8, Math.min(window.innerWidth - overlay.offsetWidth - 8, startLeft + dx));
  const top  = Math.max(8, Math.min(window.innerHeight - overlay.offsetHeight - 8, startTop + dy));

  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
});

window.addEventListener("pointerup", () => {
  dragging = false;
});

// --- RESIZE del overlay (esquina) ---
const resizeHandle = document.getElementById("resizeHandle");

let resizing = false;
let startW = 0, startH = 0, startRX = 0, startRY = 0;

resizeHandle.addEventListener("pointerdown", (e) => {
  resizing = true;
  resizeHandle.setPointerCapture(e.pointerId);

  startW = overlay.offsetWidth;
  startH = overlay.offsetHeight;
  startRX = e.clientX;
  startRY = e.clientY;

  e.preventDefault();
});

window.addEventListener("pointermove", (e) => {
  if (!resizing) return;

  const newW = startW + (e.clientX - startRX);
  const newH = startH + (e.clientY - startRY);

  const w = Math.max(320, Math.min(window.innerWidth - 16, newW));
  const h = Math.max(220, Math.min(window.innerHeight - 16, newH));

  overlay.style.width = `${w}px`;
  overlay.style.height = `${h}px`;
});

window.addEventListener("pointerup", () => {
  resizing = false;
});

run();