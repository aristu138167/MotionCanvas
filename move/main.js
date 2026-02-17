import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";

const clock = new THREE.Clock();
let camera, scene, renderer, mixer;

init();

const loader = new BVHLoader();
loader.load("/models/bvh/pirouette.bvh", (result) => {
  const root = result.skeleton.bones[0];
  const helper = new THREE.SkeletonHelper(root);

  scene.add(root);
  scene.add(helper);

  mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(result.clip).play();
}, undefined, (err) => {
  console.error("BVH load error:", err);
});

function init() {
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 200, 300);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeee);
  scene.add(new THREE.GridHelper(400, 10));

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 300;
  controls.maxDistance = 700;

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}