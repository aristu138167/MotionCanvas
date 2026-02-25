import { examples } from './examples.js';
function buildPreviewHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin:0; height:100%; overflow:hidden; background:#111; }
    canvas { width:100%; height:100%; display:block; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <canvas id="c"></canvas>
  <script type="module" src="./bvhApi.js"></script>
</body>
</html>`;
}

// --- REFERENCIAS AL DOM ---
const iframe = document.getElementById("preview");
const codeEl = document.getElementById("code");
const runBtn = document.getElementById("run");
const toggleBtn = document.getElementById("toggle");
const overlay = document.getElementById("overlay");
const bar = document.getElementById("bar");
const resizeHandle = document.getElementById("resizeHandle");
const randomBtn = document.getElementById("randomBtn");
const errBox = document.getElementById("err");

// --- SISTEMA DE COMUNICACIÓN ---
let engineReady = false;
let pendingCode = null;

// Escuchamos lo que nos dice el motor (bvhApi.js)
window.addEventListener('message', (e) => {
  if (e.data.type === 'ready') {
    engineReady = true;
    console.log("Motor 3D conectado y listo.");
    // Si el usuario le dio a Run antes de que el motor cargara, lo ejecutamos ahora
    if (pendingCode) {
      runCode(pendingCode);
      pendingCode = null;
    }
  } else if (e.data.type === 'error') {
    mostrarError(e.data.message);
  }
});

function mostrarError(msg) {
  if (errBox) {
    errBox.style.display = "block";
    errBox.textContent = msg;
  } else {
    console.error(msg);
  }
}

// --- EJECUCIÓN VÍA POSTMESSAGE ---
function run() {
  if (!engineReady) {
    pendingCode = codeEl.value; // Guardamos el código para cuando esté listo
  } else {
    runCode(codeEl.value);
  }
}

function runCode(code) {
  if (errBox) errBox.style.display = 'none'; // Limpiamos errores anteriores
  // Le mandamos el código al motor sin recargar la página
  iframe.contentWindow.postMessage({ type: 'execute', code: code }, '*');
}

runBtn.addEventListener("click", run);
window.addEventListener("keydown", (e) => {
  if (((e.ctrlKey || e.metaKey) && e.key === "Enter") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) {
    e.preventDefault();
    run();
  }
});

// --- BOTÓN RANDOM --- 
const loader = document.getElementById("loader");
let currentExampleIndex = 0;
let debounceTimer = null; // El reloj de cuenta atrás

if (randomBtn) {
  randomBtn.addEventListener("click", () => {
    // 1. Elegir un código nuevo que no sea el actual ni el default
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * examples.length);
    } while (randomIndex === currentExampleIndex || randomIndex === 0);

    currentExampleIndex = randomIndex;
    const selected = examples[currentExampleIndex];

    // 2. Actualizar el texto en pantalla inmediatamente
    codeEl.value = `///// ${selected.name} /////\n${selected.code}`;

    // 3. Mostrar el letrero de carga
    if (loader) loader.style.display = "block";

    // 4. Cancelar la ejecución si el usuario machaca el botón rápido
    clearTimeout(debounceTimer);

    // 5. Cuenta atrás de 3s antes de ejecutar el motor 3D
    debounceTimer = setTimeout(() => {
      run();
      if (loader) loader.style.display = "none"; // Ocultar el letrero al terminar
    }, 3000);
  });
}

// --- MINIMIZAR / MAXIMIZAR ---
let prevSize = null;
toggleBtn.addEventListener("click", () => {
  const minimized = overlay.classList.toggle("minimized");
  if (minimized) {
    prevSize = { width: overlay.style.width || "", height: overlay.style.height || "" };
    overlay.style.height = bar.offsetHeight + "px";
    toggleBtn.textContent = "Show";
  } else {
    if (prevSize) { overlay.style.width = prevSize.width; overlay.style.height = prevSize.height; }
    else { overlay.style.width = ""; overlay.style.height = ""; }
    toggleBtn.textContent = "Hide";
  }
});

// --- DRAG ---
let dragging = false; let startX = 0, startY = 0; let startLeft = 0, startTop = 0;
bar.addEventListener("pointerdown", (e) => {
  if (e.target && e.target.tagName === "BUTTON") return;
  dragging = true; bar.setPointerCapture(e.pointerId);
  const rect = overlay.getBoundingClientRect();
  startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - startX; const dy = e.clientY - startY;
  const left = Math.max(8, Math.min(window.innerWidth - overlay.offsetWidth - 8, startLeft + dx));
  const top = Math.max(8, Math.min(window.innerHeight - overlay.offsetHeight - 8, startTop + dy));
  overlay.style.left = `${left}px`; overlay.style.top = `${top}px`;
});
window.addEventListener("pointerup", () => { dragging = false; });
// --- RESIZE ---
let resizing = false; let startW = 0, startH = 0, startRX = 0, startRY = 0;
resizeHandle.addEventListener("pointerdown", (e) => {
  resizing = true; resizeHandle.setPointerCapture(e.pointerId);
  startW = overlay.offsetWidth; startH = overlay.offsetHeight;
  startRX = e.clientX; startRY = e.clientY; e.preventDefault();
});
window.addEventListener("pointermove", (e) => {
  if (!resizing) return;
  const newW = startW + (e.clientX - startRX); const newH = startH + (e.clientY - startRY);
  const w = Math.max(320, Math.min(window.innerWidth - 16, newW));
  const h = Math.max(220, Math.min(window.innerHeight - 16, newH));
  overlay.style.width = `${w}px`; overlay.style.height = `${h}px`;
});
window.addEventListener("pointerup", () => { resizing = false; });

// --- SECUESTRAR EL TABULADOR EN EL EDITOR ---
codeEl.addEventListener("keydown", function (e) {
  if (e.key === "Tab") {
    e.preventDefault(); // Evitamos que el navegador salte al siguiente botón

    // Cogemos la posición actual del cursor
    const start = this.selectionStart;
    const end = this.selectionEnd;

    // Insertamos 2 espacios (el estándar en JavaScript)
    const spaces = "  ";

    // Partimos el texto en dos y metemos los espacios en medio
    this.value = this.value.substring(0, start) + spaces + this.value.substring(end);

    // Volvemos a colocar el cursor justo después de los espacios
    this.selectionStart = this.selectionEnd = start + spaces.length;
  }
});

// --- ARRANQUE INICIAL ---
function init() {
  // 1. Cargar el HTML del motor en el iframe UNA SOLA VEZ
  iframe.srcdoc = buildPreviewHtml();

  // 2. Preparar el código inicial
  const defaultExample = examples[0];
  codeEl.value = `///// ${defaultExample.name} /////\n${defaultExample.code}`;

  // 3. Run automático (el código se quedará en pendingCode hasta que el motor avise de que está listo)
  run();
}

init();