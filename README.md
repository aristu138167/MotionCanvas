# MotionCanvas: Creative Coding Environment for the Artistic Exploration of Motion Capture

This tool is a web-based creative coding environment designed to transform human movement into video art. The core concept is based on a specific workflow: the user records a video of themselves performing a movement, converts it into a motion capture file (`.bvh`), and imports it into the software. 

From that moment on, their own body becomes the raw material for the artwork. Through live coding, the creator can multiply their figure, alter time, add light trails, and apply mathematical patterns to create abstract visual compositions. The goal of this project is to bridge the physical world and code, offering a space where anyone can experiment and turn their own dance or everyday gesture into a unique piece of digital art.

## Key Features

- **From Body to Code:** A unique workflow where physical movements become digital raw material. Record, convert, and instantly inject your own gestures into a generative universe.
- **Fluent Choreographic API:** A high-level, chainable language designed for live performance. Sculpt complex 3D scenes with zero boilerplate, turning technical logic into expressive commands.
- **Skeletal & Ghost Manipulation:** Total control over body representation. Work with solid skeletons, hide them to focus on pure geometry, or create temporal echoes with dynamic light trails.
- **Algorithmic Multiplication:** Clone and distribute a single movement into advanced mathematical formations. From Fibonacci spheres to circular arrays, one gesture becomes the seed for infinite visual structures.
- **Spatiotemporal Control:** Precise manipulation of the performance's fabric. Create "wave effects" with individual delays, reverse choreographies, or alter speed independently for each clone.

## Installation

```bash
git clone https://github.com/aristu138167/MotionCanvas.git
cd MotionCanvas
npm install
npm start
```
Then visit http://127.0.0.1:3000

## Quick Start & Usage

Instead of writing verbose standard Three.js code, this environment uses a declarative approach. You can sculpt movement with just a few lines of code.

![Default Editor View](docs/default.jpg) 

```javascript
// Example: Creating a glowing trail effect with a single motion capture file
clear();
bg("#000105"); 
cam(0, 0, 500);

let amount = 12;

for(let i = 0; i < amount; i++) {
  let angle = (i / amount) * Math.PI * 2;
  
  bvh("pirouette")
    .pos(Math.cos(angle) * 100, -100, Math.sin(angle) * 100)
    .rotY(angle)
    .color(`hsl(${i * 20}, 100%, 50%)`)
    .trail(40)
    .delay(i * 0.1)
    .play();
}

rot(0.01);
```
## Editor Controls (UI)
The editor is designed for a seamless live performance experience:
* **Drag & Resize:** The code editor is a floating window. You can drag it from the header or resize it from the corners to fit your workspace.
* **Random Button:** Click the "Random" button to instantly swap your current code for a curated generative example.
* **Show/Hide:** Use the interface buttons to toggle the editor visibility for a clean view of your artwork.

## API Reference (The Language)

### Global Functions (Environment & Scene)
These functions control the virtual world and the creation of the dancers:
* **`clear()`**: Instantly clears the entire scene. Removes all skeletons and trails.
* **`grid(size, divisions)`**: Creates the floor grid. Defaults to `400, 10` if left empty.
* **`cam(x, y, z, lookX, lookY, lookZ)`**: Positions the camera at specific coordinates and sets its look-at target.
* **`background(color)`** or **`bg(color)`**: Paints the background with a specific color (e.g., `bg("#000105")`).
* **`bvh("name")`**: Loads a `.bvh` file from the assets folder and prepares a new dancer (e.g., `let dancer1 = bvh("pirouette")`).
* **`duplicate(variable)`**: Clones an already created dancer (e.g., `duplicate(dancer1)`).

### Global Modifiers
If used on their own, these functions affect all dancers in the scene that don't have their own specific settings:
* **`speed(value)`**: Global speed multiplier (1 is normal, 2 is double, 0.5 is slow motion).
* **`pause(boolean)`**: Freezes or resumes all animations (`true`/`false`).
* **`scale(value)`**: Changes the overall size of everything.
* **`rot(speed)`**: Constantly rotates the scene, as if the dancers were on a spinning platform.
* **`reverse(boolean)`**: Makes all dancers perform the choreography backwards.
* **`color(color)`**: Applies a default color to all skeletons.
* **`trail(length)`**: Activates ghost trails for everyone (try values between 10 and 50).
* **`delay(seconds)`**: Adds a global wait time before the choreography starts.
* **`skeleton(boolean)`**: Shows or hides the bones globally (useful if you only want to see the trails).

### Individual Modifiers (Chainable)
Add these directly after a `bvh()` or `duplicate()` using a dot (`.`) to customize that specific dancer. 
* **`.play()`**: **Essential!** This must always be the last method in the chain to apply the changes and spawn the dancer in the scene.
* **`.pos(x, y, z)`**: Moves the dancer across all three axes at once.
* **`.x(v)`, `.y(v)`, `.z(v)`**: Moves the dancer on a specific axis.
* **`.rotX(rad)`, `.rotY(rad)`, `.rotZ(rad)`**: Rotates the dancer to face another direction on the X, Y, or Z axis (use `Math.PI` or decimals).
* **`.scale(s)`**: Changes the size of this specific clone.
* **`.speed(v)`**: Modifies the speed for this dancer only.
* **`.reverse(boolean)`**: Makes only this clone move backwards.
* **`.color(color)`**: Paints its bones/trails a specific color.
* **`.trail(length)`**: Configures a unique trail for this dancer (or `0` to disable).
* **`.delay(seconds)`**: Creates a wave effect: makes this dancer wait X seconds before moving.
* **`.skeleton(boolean)`**: Turns the main dancer invisible, leaving only the effects.

## Standard Three.js Support
Under the hood, the environment still has full access to the standard `THREE` namespace. You can always mix generative BVH animations with custom geometries, custom shaders, and traditional lighting if your artwork requires it.

## Advanced Example: Mathematical Patterns

This example demonstrates how to use the Golden Ratio (Fibonacci) to distribute 80 dancers into a perfect sphere, creating a complex, generative, and synchronized 3D structure.
![Fibonacci Sphere Choreography](docs/fibonacci_sphere.jpg) 

```javascript
// Mathematical Pattern: Fibonacci Sphere Choreography
clear();
bg("#020205"); 
cam(0, 0, 800);

let points = 80;
let radius = 250;
const phi = Math.PI * (3 - Math.sqrt(5)); // The Golden Angle

// We load a base dancer, but hide the skeleton so only the trails remain
let baseDancer = bvh("pirouette").pos(0,-5000,0).skeleton(false).play();

for (let i = 0; i < points; i++) {
  // 1. Calculate the Y position and the radius at that height
  let y = 1 - (i / (points - 1)) * 2; 
  let radiusAtY = Math.sqrt(1 - y * y); 
  
  // 2. Calculate the rotation angle based on the Golden Ratio
  let theta = phi * i; 

  // 3. Convert to 3D Cartesian coordinates
  let x = Math.cos(theta) * radiusAtY * radius;
  let z = Math.sin(theta) * radiusAtY * radius;

  // 4. Clone and place the dancer
  duplicate(baseDancer)
    .pos(x, y * radius, z)
    .rotY(theta)               // Orient to follow the sphere's curve
    .color(`hsl(${i * 4.5}, 100%, 60%)`) // Rainbow gradient
    .trail(35)                 // Long geometric trails
    .delay(i * 0.03)           // Ripple effect delay
    .speed(0.6)
    .play();
}

// Slowly rotate the entire universe
rot(0.005);
```