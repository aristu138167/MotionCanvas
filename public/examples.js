export const examples = [
  {
    name: "Animación Base (Default)",
    code: `clear();
grid(400, 10);
cam(0, 200, 450, 0, 120, 0);

/// Archivos de Captura de Movimiento
bvh("A_test").x(0).scale(1).speed(1).play();
bvh("B_test").x(-60).scale(1).speed(1).play();
bvh("C_test").x(60).scale(1).speed(1).play();
bvh("pirouette").x(100).scale(1).speed(1).play();
bvh("ejercicios_rehabilitacion").x(-100).z(-160).scale(1).speed(1).play();

/// Controles Globales
speed(1.0);
skeleton(true);
scale(1.0);
// rot(0.05);`
  },
  {
    name: "Color Movements",
    code: `clear();
cam(0, 200, 450, 0, 100, 0);

bailarin1 = bvh("pirouette").x(-160).color("#ff0000").trail(100).play();
bailarin2 = duplicate(bailarin1).x(0).color("#ffffff").play();
bailarin3 = duplicate(bailarin1).x(160).color("#0000ff").play();
bailarin4 = duplicate(bailarin1).x(-160).z(-160).color("#00ffff").play();
bailarin5 = duplicate(bailarin1).x(0).z(-160).color("#00ff00").play();
bailarin6 = duplicate(bailarin1).x(160).z(-160).color("#ffff00").play();

duplicate(bailarin1).reverse().play();
duplicate(bailarin2).reverse().play();
duplicate(bailarin3).reverse().play();
duplicate(bailarin4).reverse().play();
duplicate(bailarin5).reverse().play();
duplicate(bailarin6).reverse().play();
rot(0.1)`
  },
  {
    name: "El Hiperboloide de Neón",
    code: `clear();
bg("#020005");
cam(0, 400, 1100, 0, 200, 0);

let molde = bvh("A_test").pos(0, -2000, 0).skeleton(false).play();
let cantidad = 100;
let radio = 400;
let alturaMaxima = 600;

for (let i = 0; i < cantidad; i++) {
  let t = (i / cantidad) * Math.PI * 2;
  let x = Math.cos(t) * radio;
  let z = Math.sin(t) * radio;
  let y = (i / cantidad) * alturaMaxima;

  let r = Math.floor((i / cantidad) * 255);
  let b = 255 - r;
  
  duplicate(molde)
    .pos(x, y, z)
    .color(\`rgb(\${r}, 50, \${b})\`)
    .trail(80)
    .speed(0.3)
    .delay(i * 0.05)
    .play();
}
rot(0.04);`
  },
  {
    name: "Círculo de Vigilancia",
    code: `clear();
bg("#050505");
cam(0, 400, 600, 0, 100, 0);

let molde = bvh("A_test").pos(0, -1000, 0).skeleton(false).play();
let cantidad = 12;
let radio = 250;

for (let i = 0; i < cantidad; i++) {
  let angulo = (i / cantidad) * Math.PI * 2;
  let x = Math.cos(angulo) * radio;
  let z = Math.sin(angulo) * radio;
  let mirarAlCentro = -angulo + Math.PI / 2;

  duplicate(molde)
    .pos(x, 0, z)
    .rotY(mirarAlCentro)
    .color(\`hsl(\${i * 30}, 100%, 50%)\`)
    .trail(30)
    .delay(i * 0.1)
    .play();
}
rot(0.02);`
  },
  {
    name: "ADN Gigante",
    code: `clear();
bg("#00050a");
cam(600, 400, 600, 0, 300, 0);

let molde = bvh("A_test").pos(0, -1000, 0).skeleton(false).play();
let alturaTotal = 800;
let pasos = 60;
let radio = 150;

for (let i = 0; i < pasos; i++) {
  let y = (i / pasos) * alturaTotal;
  let angulo = (i / pasos) * Math.PI * 4;

  duplicate(molde)
    .pos(Math.cos(angulo) * radio, y, Math.sin(angulo) * radio)
    .color("#00ffff")
    .trail(40)
    .delay(i * 0.1)
    .play();

  duplicate(molde)
    .pos(Math.cos(angulo + Math.PI) * radio, y, Math.sin(angulo + Math.PI) * radio)
    .color("#ff00ff")
    .trail(40)
    .delay(i * 0.1)
    .play();
}
rot(0.05);`
  },
  {
    name: "La Onda de Frecuencia",
    code: `clear();
bg("black");
cam(0, 300, 600, 0, 100, 0);

let molde = bvh("pirouette").pos(0, -1000, 0).skeleton(false).play();

let puntos = 30; // Número de bailarines en la línea
let separacion = 40;
let inicioX = -((puntos - 1) * separacion) / 2; // Para centrarlo

for (let i = 0; i < puntos; i++) {
  let posX = inicioX + (i * separacion);
  
  // La magia de la onda: el eje Z (profundidad) serpentea
  let posZ = Math.sin(i * 0.4) * 150;
  
  // Hacemos un gradiente de color de Rojo a Azul
  let r = Math.floor((i / puntos) * 255);
  let b = 255 - r;
  let colorClon = "rgb(" + r + ", 50, " + b + ")";

  duplicate(molde)
    .pos(posX, 0, posZ)
    .color(colorClon)
    .trail(60) // Rastro muy largo
    .delay(i * 0.1) // Efecto dominó de izquierda a derecha
    .play();
}

rot(0.04);`
  },
  {
    name: "El Hiper-Túnel",
    code: `clear();
bg("black");
// Cámara en el origen (0,0,50), mirando hacia el fondo del túnel (-Z)
cam(0, 0, 50, 0, 0, -1000);

let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let numAnillos = 30;    // Cuántos "cortes" tiene el túnel a lo largo
let gentePorAnillo = 10; // Cuánta gente en cada corte
let radioTunel = 250;
let longitudTunel = 2000; // Profundidad total

for (let i = 0; i < numAnillos; i++) {
  // Calculamos la posición Z (profundidad) de este anillo
  // Los ponemos en negativo para que se alejen de la cámara
  let posZ = - (i * (longitudTunel / numAnillos));

  for (let j = 0; j < gentePorAnillo; j++) {
    // Ángulo dentro del anillo actual
    let angulo = (j / gentePorAnillo) * Math.PI * 2;
    
    let posX = Math.cos(angulo) * radioTunel;
    let posY = Math.sin(angulo) * radioTunel;
    
    // Alternamos colores Neón Cian y Magenta por cada anillo
    let colorClon = (i % 2 === 0) ? "#00ffff" : "#ff00aa";

    duplicate(molde)
      .pos(posX, posY, posZ)
      .rotY(-angulo) // Giran para seguir la curva del túnel
      .color(colorClon)
      .trail(80) // Rastro muy largo para dar sensación de velocidad
      // Delay basado en la profundidad: efecto "viaje en el tiempo"
      .delay(i * 0.15)
      .play();
  }
}

// Aquí el rot() queda genial, hace que las paredes del túnel parezcan vivas
rot(0.2);`
  },
  {
    name: "La Esfera de Fibonacci",
    code: `clear();
bg("#020207");
cam(0, 0, 1200, 0, 0, 0);

// El molde invisible
let molde = bvh("pirouette").pos(0, -2000, 0).skeleton(false).play();

let cantidad = 250; 
let radioEsfera = 400;

// El "Ángulo Áureo" (Golden Angle)
let phi = Math.PI * (3 - Math.sqrt(5)); 

for (let i = 0; i < cantidad; i++) {
  // Calculamos la posición Y (altura)
  let yNorm = 1 - (i / (cantidad - 1)) * 2; 
  let radioEnY = Math.sqrt(1 - yNorm * yNorm);
  let theta = phi * i; 

  // Trigonometría esférica para sacar X, Y, Z
  let posX = Math.cos(theta) * radioEnY * radioEsfera;
  let posY = yNorm * radioEsfera;
  let posZ = Math.sin(theta) * radioEnY * radioEsfera;

  // Gradiente de color basado en la altura (Y)
  let r = Math.floor(((yNorm + 1) / 2) * 255);
  let b = 255 - r;
  
  let colorClon = \`rgb(\${r}, 50, \${b})\`;

  duplicate(molde)
    .pos(posX, posY, posZ)
    .rotY(-theta)
    .color(colorClon)
    .trail(30)
    .delay(i * 0.02)
    .play();
}

rot(0.1);`
  }
];