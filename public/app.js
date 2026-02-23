function escapeForScript(code) {
  let safeCode = code.replace(/<\/script>/gi, "<\\/script>");
  const lines = safeCode.split('\n');
  const processed = lines.map(line => {
    if (/^\s*(const|let|var)\s/.test(line)) return line;
    return line.replace(/^\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=(?!=)/, 'window.$1 =');
  });
  return processed.join('\n');
}

function buildPreviewHtml(userCode) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin:0; height:100%; overflow:hidden; background:#111; }
    canvas { width:100%; height:100%; display:block; }
    #err { position:fixed; left:0; right:0; bottom:0; max-height:40%; overflow:auto; font:12px Consolas; color:#ffb4b4; background:rgba(0,0,0,0.70); padding:10px; white-space:pre-wrap; display:none; }
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
  <div id="err"></div>
  <script type="module" src="./bvhApi.js"></script>
  <script type="module">
    const errBox = document.getElementById("err");
    function showErr(msg) { errBox.style.display = "block"; errBox.textContent += "\\n" + msg; }
    window.addEventListener("error", (e) => showErr(e.error?.stack || e.message || e.type));
    
    // Pequeño retardo para asegurar que bvhApi.js está cargado
    setTimeout(() => {
      try {
        ${escapeForScript(userCode)}
      } catch (e) {
        showErr(e?.stack || e);
      }
    }, 50);
  </script>
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

// --- EJECUCIÓN ---
function run() {
  iframe.srcdoc = buildPreviewHtml(codeEl.value);
}

runBtn.addEventListener("click", run);
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    run();
  }
});

// --- MINIMIZAR / MAXIMIZAR ---
let prevSize = null;
toggleBtn.addEventListener("click", () => {
  const minimized = overlay.classList.toggle("minimized");

  if (minimized) {
    prevSize = {
      width: overlay.style.width || "",
      height: overlay.style.height || "",
    };
    overlay.style.height = bar.offsetHeight + "px";
    toggleBtn.textContent = "Show";
  } else {
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

// --- DRAG (ARRASTRAR) ---
let dragging = false;
let startX = 0, startY = 0;
let startLeft = 0, startTop = 0;

bar.addEventListener("pointerdown", (e) => {
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
  const top = Math.max(8, Math.min(window.innerHeight - overlay.offsetHeight - 8, startTop + dy));
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
});

window.addEventListener("pointerup", () => {
  dragging = false;
});

// --- RESIZE (REDIMENSIONAR) ---
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

// --- INICIO: LEER ARCHIVO Y EJECUTAR ---
async function init() {
  try {
    const response = await fetch('./defaultCode.js');
    const codeText = await response.text();
    codeEl.value = codeText;
  } catch (err) {
    console.warn("No se pudo cargar el archivo defaultCode.js. Revisa si estás usando un servidor local (Live Server).", err);
  }
  run();
}

init();