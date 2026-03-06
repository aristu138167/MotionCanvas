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

const SB = {
  params: { speed: 1.0, pause: false, showSkeleton: true, globalScale: 1.0, rotSpeed: 0.0, reverse: false, color: null, color2: null, trail: 0, delay: 0 },

  grid(size = 400, div = 10) { scene.add(new THREE.GridHelper(size, div)); return SB; },
  cam(x = 0, y = 200, z = 450, lx = 0, ly = 120, lz = 0) { camera.position.set(x, y, z); controls.target.set(lx, ly, lz); return SB; },
  background(color) { scene.background = new THREE.Color(color); return SB; },
  bg(color) { return this.background(color); },

  clear() {
    runId++;

    for (const r of rigs) {
      if (r.mixer) r.mixer.stopAllAction();
      if (r.helper) scene.remove(r.helper);
      if (r.group) scene.remove(r.group);
    }

    for (const t of activeTrails) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
    activeTrails.length = 0; rigs.length = 0; mixers.length = 0;

    const grids = scene.children.filter(obj => obj.type === "GridHelper");
    for (const g of grids) {
      scene.remove(g);
      g.geometry.dispose();
      g.material.dispose();
    }

    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    scene.background = new THREE.Color(0x111111);

    return SB;
  },

  bvh(fileOrUrl) {
    const url = fileOrUrl.startsWith("http") ? fileOrUrl : "./assets/" + fileOrUrl + ".bvh";

    const handle = {
      _rawFile: fileOrUrl, _url: url, _x: 0, _y: 0, _z: 0, _rotX: 0, _rotY: 0, _rotZ: 0, _scale: null, _showSkeleton: null, _speed: null, _reverse: null, _color: null, _color2: null, _trail: null, _delay: null, _dummy: null,

      _isPlaying: false,

      _isChained: false,
      _isHead: true,
      _chainHead: null,
      _nextHandle: null,

      x(v) { this._x = v; return this; }, y(v) { this._y = v; return this; }, z(v) { this._z = v; return this; },
      pos(x, y, z) { this._x = x; this._y = y; this._z = z; return this; },
      rotX(r) { this._rotX = r; return this; }, rotY(r) { this._rotY = r; return this; }, rotZ(r) { this._rotZ = r; return this; },
      scale(s) { this._scale = s; return this; }, skeleton(v) { this._showSkeleton = v; return this; },
      speed(v) { this._speed = v; return this; }, reverse(v = true) { this._reverse = v; return this; },
      color(c1, c2) { this._color = c1; this._color2 = c2; return this; }, trail(length) { this._trail = length; return this; },
      delay(s) { this._delay = s; return this; }, dummy(num) { this._dummy = num; return this; },

      play() {
        this._isPlaying = true;
        const rig = rigs.find(r => r.handle === this);
        if (rig && rig.action) rig.action.paused = false;
        return this;
      },

      nextBvh(nextFile) {
        const nextHandle = SB.bvh(nextFile);
        nextHandle._isHead = false;
        nextHandle._isPlaying = this._isPlaying;

        // El nuevo bailarín hereda el aspecto y configuración del anterior
        nextHandle._color = this._color;
        nextHandle._color2 = this._color2;
        nextHandle._scale = this._scale;
        nextHandle._speed = this._speed;
        nextHandle._trail = this._trail;
        nextHandle._showSkeleton = this._showSkeleton;
        nextHandle._dummy = this._dummy;
        // También hereda la rotación inicial para mantener la orientación
        nextHandle._rotX = this._rotX;
        nextHandle._rotY = this._rotY;
        nextHandle._rotZ = this._rotZ;

        this._isChained = true;
        nextHandle._isChained = true;

        nextHandle._chainHead = this._chainHead || this;
        nextHandle._nextHandle = nextHandle._chainHead;
        this._nextHandle = nextHandle;

        return nextHandle;
      }
    };

    const myRunId = runId;

    setTimeout(() => {
      const loader = new BVHLoader();
      loader.load(handle._url, (result) => {
        if (myRunId !== runId) return;

        const root = result.skeleton.bones[0];

        const group = new THREE.Group();
        group.position.set(handle._x, handle._y, handle._z);

        const pivot = new THREE.Group();
        pivot.rotation.set(handle._rotX, handle._rotY, handle._rotZ);
        pivot.add(root); group.add(pivot);

        const sc = (handle._scale ?? SB.params.globalScale);
        group.scale.setScalar(sc); scene.add(group);

        const helper = new THREE.SkeletonHelper(root);
        helper.skeleton = result.skeleton;

        const col1 = handle._color ?? SB.params.color;
        const col2 = handle._color2 ?? SB.params.color2;

        if (col1 && !col2) {
          // Si solo hay un color, pintamos sólido normal
          helper.material.vertexColors = false;
          helper.material.color.set(col1);
        } else {
          // Si hay dos colores (o ninguno), activamos el DEGRADADO DE LÍNEAS
          helper.material.vertexColors = true;
          helper.material.color.set(0xffffff);

          // Si no nos pasan colores, usamos verde y azul por defecto
          const colorInicio = new THREE.Color(col1 || "#00ffcc"); // Base
          const colorFin = new THREE.Color(col2 || "#0055ff");    // Punta

          const geometry = helper.geometry;
          const positions = geometry.attributes.position;
          const colors = new Float32Array(positions.count * 3);

          for (let i = 0; i < positions.count; i += 2) {
            // Vértice base
            colors[i * 3] = colorInicio.r;
            colors[i * 3 + 1] = colorInicio.g;
            colors[i * 3 + 2] = colorInicio.b;

            // Vértice punta
            colors[(i + 1) * 3] = colorFin.r;
            colors[(i + 1) * 3 + 1] = colorFin.g;
            colors[(i + 1) * 3 + 2] = colorFin.b;
          }

          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        if (handle._isChained && !handle._isHead) {
          helper.visible = false;
        } else {
          helper.visible = (handle._showSkeleton ?? SB.params.showSkeleton);
        }

        scene.add(helper);

        if (handle._dummy !== null && handle._dummy > 0) {
          helper.visible = false;

          // Comprobamos los colores exactos
          const col1 = handle._color ?? SB.params.color;
          const col2 = handle._color2 ?? SB.params.color2;

          let useGradient = false;
          let colorInicio, colorFin;

          if (col1 && !col2) {
            // CASO A: Solo hay un color -> Color sólido
            useGradient = false;
            colorInicio = new THREE.Color(col1);
          } else {
            // CASO B: Hay dos colores o ninguno -> Degradado
            useGradient = true;
            colorInicio = new THREE.Color(col1 || "#00ffcc");
            colorFin = new THREE.Color(col2 || "#0055ff");
          }

          // 1. MATERIAL DEL DUMMY
          const dummyMat = new THREE.MeshStandardMaterial({
            color: useGradient ? 0xffffff : colorInicio, // Blanco si hay degradado, color sólido si no
            vertexColors: useGradient, // Solo activamos colores por vértice si hay degradado
            roughness: 0.5,
            metalness: 0.2
          });

          // 2. GEOMETRÍAS BASE
          const baseSphereGeom = new THREE.SphereGeometry(1, 12, 12);
          const baseCylGeom = new THREE.CylinderGeometry(0.4, 1, 1, 8);
          baseCylGeom.translate(0, 0.5, 0);

          // 3. MAGIA DEL DEGRADADO (Solo se ejecuta si useGradient es true)
          if (useGradient) {
            const cylPos = baseCylGeom.attributes.position;
            const cylColors = [];
            for (let i = 0; i < cylPos.count; i++) {
              const y = cylPos.getY(i);
              const mixedColor = colorInicio.clone().lerp(colorFin, y);
              cylColors.push(mixedColor.r, mixedColor.g, mixedColor.b);
            }
            baseCylGeom.setAttribute('color', new THREE.Float32BufferAttribute(cylColors, 3));

            const spherePos = baseSphereGeom.attributes.position;
            const sphereColors = [];
            for (let i = 0; i < spherePos.count; i++) {
              sphereColors.push(colorInicio.r, colorInicio.g, colorInicio.b);
            }
            baseSphereGeom.setAttribute('color', new THREE.Float32BufferAttribute(sphereColors, 3));
          }

          root.traverse((bone) => {
            if (bone.isBone) {

              let hasChildren = false;
              let maxChildLength = 0;

              // 1. Trazamos los cilindros hacia los siguientes huesos
              if (bone.children.length > 0) {
                bone.children.forEach((child) => {
                  if (child.isBone) {
                    hasChildren = true;
                    const length = child.position.length();
                    maxChildLength = Math.max(maxChildLength, length);

                    if (length > 0.01) {
                      const boneThickness = Math.min(handle._dummy, length * 0.25);
                      const mesh = new THREE.Mesh(baseCylGeom, dummyMat);
                      mesh.scale.set(boneThickness, length, boneThickness);
                      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), child.position.clone().normalize());
                      bone.add(mesh);
                    }
                  }
                });
              }

              // 2. Colocamos la Rótula exacta para esta articulación
              let jointSize = 0;
              if (hasChildren) {
                // Es una articulación central (codo, muñeca, nudillo base). 
                // La hacemos un 20% más grande que el hueso para que tape la unión perfectamente.
                const boneThickness = Math.min(handle._dummy, maxChildLength * 0.25);
                jointSize = boneThickness * 1.2;
              } else {
                // Es una punta final (yema del dedo, cabeza).
                // Como el cilindro acababa estrechándose al 40%, hacemos esta esfera suave para rematar.
                const length = bone.position.length();
                const boneThickness = Math.min(handle._dummy, length * 0.25);
                jointSize = boneThickness * 0.45;
              }

              if (jointSize > 0) {
                const jointMesh = new THREE.Mesh(baseSphereGeom, dummyMat);
                jointMesh.scale.setScalar(jointSize);
                bone.add(jointMesh);
              }
            }
          });

          root.visible = !(handle._isChained && !handle._isHead);
        }

        const mixer = new THREE.AnimationMixer(root);
        const action = mixer.clipAction(result.clip);

        if (handle._isChained) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }

        action.play();

        // Si el usuario no le dio a play, o si es un relevo en espera, NACE PAUSADO.
        if (!handle._isPlaying || (handle._isChained && !handle._isHead)) {
          action.paused = true;
        }

        const isReversed = handle._reverse ?? SB.params.reverse;
        if (isReversed) { action.time = result.clip.duration; }

        mixer.addEventListener('finished', (e) => {
          if (handle._isChained && handle._nextHandle) {
            helper.visible = false;
            if (handle._dummy) root.visible = false;

            // Función interna para ejecutar el relevo
            const ejecutarRelevo = (nextRig) => {
              const currentPos = new THREE.Vector3();
              root.getWorldPosition(currentPos);

              nextRig.action.reset();
              nextRig.action.paused = false;
              nextRig.mixer.update(0);

              const nextRootStartPos = new THREE.Vector3();
              nextRig.root.getWorldPosition(nextRootStartPos);

              const deltaX = currentPos.x - nextRootStartPos.x;
              const deltaZ = currentPos.z - nextRootStartPos.z;

              nextRig.group.position.x += deltaX;
              nextRig.group.position.z += deltaZ;

              if (handle._nextHandle._dummy) {
                nextRig.root.visible = true; // Enciende al cuerpo sólido
              } else {
                nextRig.helper.visible = (handle._nextHandle._showSkeleton ?? SB.params.showSkeleton); // Enciende palitos
              }
              nextRig.timeAlive = 0; // RESET DEL RELOJ
              nextRig.action.play();
            };

            // Buscamos al siguiente
            const nextRig = rigs.find(r => r.handle === handle._nextHandle);

            if (nextRig) {
              ejecutarRelevo(nextRig);
            } else {
              // CORRECCIÓN: Si el archivo es muy pesado y aún no ha cargado, esperamos.
              const waitInterval = setInterval(() => {
                const delayedRig = rigs.find(r => r.handle === handle._nextHandle);
                if (delayedRig) {
                  clearInterval(waitInterval);
                  ejecutarRelevo(delayedRig);
                }
              }, 50); // Comprueba cada 50 milisegundos si ya llegó
            }
          }
        });

        rigs.push({
          handle, group, pivot, root, helper, mixer, action, clip: result.clip, timeAlive: 0,
          opts: { rotX: handle._rotX, rotY: handle._rotY, rotZ: handle._rotZ, speed: (handle._speed ?? 1.0), showSkeleton: (handle._showSkeleton ?? null), scale: (handle._scale ?? null), reverse: handle._reverse, color: handle._color, trail: handle._trail, delay: handle._delay }
        });
        mixers.push(mixer);
      }, undefined, (err) => { throw new Error("BVH load error (" + handle._url + "): " + (err?.message || err)); });
    }, 0);

    return handle;
  },

  duplicate(originalHandle) {
    if (!originalHandle || !originalHandle._rawFile) throw new Error("duplicate() necesita una variable.");

    // 1. Buscamos la "locomotora" (el primer movimiento de la cadena original)
    const startOrig = originalHandle._chainHead || originalHandle;

    // 2. Creamos la nueva locomotora
    let newCurrent = this.bvh(startOrig._rawFile);
    const keysToCopy = ["_x", "_y", "_z", "_scale", "_rotX", "_rotY", "_rotZ", "_showSkeleton", "_speed", "_reverse", "_color", "_color2", "_trail", "_delay", "_dummy"];

    keysToCopy.forEach(k => newCurrent[k] = startOrig[k]);
    const newHead = newCurrent; // Guardamos el inicio para devolverlo al final

    // 3. Si era una cadena, recorremos todos los vagones copiándolos uno a uno
    if (startOrig._isChained) {
      let currentOrig = startOrig._nextHandle;

      // Damos la vuelta al círculo hasta volver al inicio
      while (currentOrig && currentOrig !== startOrig) {
        newCurrent = newCurrent.nextBvh(currentOrig._rawFile);
        keysToCopy.forEach(k => newCurrent[k] = currentOrig[k]);
        currentOrig = currentOrig._nextHandle;
      }
    }

    if (startOrig._isPlaying) newHead.play();

    // 4. Devolvemos la nueva locomotora
    // Así, al hacer duplicate(a).x(20), estás moviendo el punto de partida de toda la cadena
    return newHead;
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
  color(c1, c2) { SB.params.color = c1; SB.params.color2 = c2; return SB; }, trail(v) { SB.params.trail = v; return SB; }, delay(s) { SB.params.delay = s; return SB; },

  _tick() {
    const dt = clock.getDelta(); frameCount++;
    for (const r of rigs) {
      if (r.group) {
        const s = (r.opts.scale ?? SB.params.globalScale);
        r.group.scale.setScalar(s);
      }

      const trailLen = r.opts.trail ?? SB.params.trail;
      const delayTime = r.opts.delay ?? SB.params.delay;

      // Control de trails
      const isVisible = r.handle._dummy ? r.root.visible : (r.helper && r.helper.visible);
      if (!SB.params.pause && trailLen > 0 && frameCount % 6 === 0 && isVisible && r.timeAlive >= delayTime) {
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

        // Comprobamos la visibilidad real (si tiene dummy, miramos el root; si no, el helper)
        const isVisible = r.handle._dummy ? r.root.visible : (r.helper && r.helper.visible);

        // Si está esperando su relevo (invisible de verdad), no envejece.
        if (r.handle._isChained && r.handle !== r.handle._chainHead && !isVisible && r.timeAlive === 0) {
          continue;
        }

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
window.color = (c1, c2) => SB.color(c1, c2);; window.trail = (l) => SB.trail(l);
window.delay = (s) => SB.delay(s); window.duplicate = (h) => SB.duplicate(h);
window.background = (c) => SB.background(c); window.bg = (c) => SB.bg(c);

function resize() {
  const w = canvas.clientWidth; const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

function animate() { resize(); controls.update(); SB._tick(); renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'execute') {
    try {
      const ejecutar = new Function(event.data.code);
      ejecutar();
    } catch (error) {
      window.parent.postMessage({ type: 'error', message: error.stack || error.message }, '*');
    }
  }
});

window.parent.postMessage({ type: 'ready' }, '*');