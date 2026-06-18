"use strict";

// ---------------------------------------------------------------------------
// Forest Mini Golf — Babylon.js
// 18-hole fixed course, forest theme.
//
// Physics: custom, time-based (fixed sub-steps) with full 3D velocity.
//   - Gravity pulls the ball down each step.
//   - The green is a height field (flat + ramps + a funnel around each cup).
//   - Contact with the surface is resolved against the surface NORMAL, so the
//     ball rolls down slopes, climbs ramps, and slows via rolling friction.
//   - Each cup is a real pit: the mesh is depressed and there's no floor over
//     the opening, so the ball loses support and falls in naturally. A fast
//     ball keeps enough height to skip the rim (lip-out); a slow one drops.
// ---------------------------------------------------------------------------

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(
  canvas,
  true,
  { preserveDrawingBuffer: true, stencil: true, antialias: true },
  true // adaptToDeviceRatio -> render at full device resolution (crisper)
);

// --- Tunable constants (units are roughly "meters") -----------------------
const BALL_RADIUS = 0.32;
const HOLE_RADIUS = 0.55;
const CUP_DEPTH = 0.7;
const GRAVITY = 20;            // units / s^2
const GROUND_RESTITUTION = 0.25;
const WALL_RESTITUTION = 0.55;
const FRICTION_DECEL = 6.5;    // rolling friction as constant deceleration (units/s^2)
const STOP_SPEED = 0.25;       // below this horizontal speed on the ground, the ball stops
const MAX_SPEED = 24;          // strongest putt
const CAPTURE_SPEED = 6.5;     // max speed over the cup that still drops in (else lip-out)
const WALL_HEIGHT = 1.1;
const WALL_THICK = 0.5;
const FIXED_DT = 1 / 120;      // physics sub-step

// ---------------------------------------------------------------------------
// Course definition. Each hole:
//   bounds: playable rectangle (XZ)
//   tee/cup: positions
//   walls:  box obstacles { x, z, w (x-size), d (z-size) }
//   rocks:  circular obstacles { x, z, r }
//   ramps:  raised terrain { axis: 'x'|'z', from, to, height }  (full-width slope)
// ---------------------------------------------------------------------------
const HOLES = [
  { par: 2, bounds: { minX: -6, maxX: 6, minZ: -9, maxZ: 9 }, tee: { x: 0, z: -6 }, cup: { x: 0, z: 6 }, walls: [], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11 }, tee: { x: -4, z: -8 }, cup: { x: 4, z: 8 }, walls: [{ x: -1.5, z: 0, w: 9, d: WALL_THICK }], rocks: [] },
  { par: 3, bounds: { minX: -8, maxX: 8, minZ: -11, maxZ: 11 }, tee: { x: 0, z: -8 }, cup: { x: 0, z: 8 }, walls: [{ x: -3.5, z: 0, w: WALL_THICK, d: 10 }, { x: 3.5, z: 0, w: WALL_THICK, d: 10 }], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -10, maxZ: 10 }, tee: { x: 0, z: -7 }, cup: { x: 0, z: 7 }, walls: [], rocks: [{ x: 0, z: 0, r: 1.2 }] },
  { par: 2, bounds: { minX: -6, maxX: 6, minZ: -9, maxZ: 9 }, tee: { x: 0, z: -6 }, cup: { x: 0, z: 6 }, walls: [], rocks: [{ x: -1.8, z: 1, r: 0.8 }, { x: 1.8, z: -1, r: 0.8 }] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -12, maxZ: 12 }, tee: { x: -4, z: -9 }, cup: { x: 4, z: 9 }, walls: [{ x: 2, z: -4, w: 8, d: WALL_THICK }, { x: -2, z: 4, w: 8, d: WALL_THICK }], rocks: [] },
  // Hole 7: a ramp up to a raised green where the cup sits.
  { par: 4, bounds: { minX: -7, maxX: 7, minZ: -13, maxZ: 13 }, tee: { x: 0, z: -9 }, cup: { x: 0, z: 9 }, walls: [], rocks: [], ramps: [{ axis: "z", from: -4, to: 0, height: 1.3 }] },
  { par: 3, bounds: { minX: -8, maxX: 8, minZ: -11, maxZ: 11 }, tee: { x: 0, z: -8 }, cup: { x: 0, z: 8 }, walls: [{ x: -5.25, z: 0, w: 5.5, d: WALL_THICK }, { x: 5.25, z: 0, w: 5.5, d: WALL_THICK }], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11 }, tee: { x: 0, z: -8 }, cup: { x: 0, z: 8 }, walls: [], rocks: [{ x: -1.5, z: 0, r: 0.9 }, { x: 1.5, z: 0, r: 0.9 }, { x: 0, z: 3.5, r: 0.9 }] },
  { par: 4, bounds: { minX: -8, maxX: 8, minZ: -13, maxZ: 13 }, tee: { x: -5, z: -10 }, cup: { x: 5, z: 10 }, walls: [{ x: -2, z: -4, w: 9, d: WALL_THICK }, { x: 2, z: 4, w: 9, d: WALL_THICK }], rocks: [] },
  { par: 2, bounds: { minX: -6, maxX: 6, minZ: -9, maxZ: 9 }, tee: { x: 0, z: -6 }, cup: { x: 0, z: 6 }, walls: [], rocks: [{ x: -1.3, z: 2.5, r: 0.7 }, { x: 1.3, z: 2.5, r: 0.7 }] },
  { par: 3, bounds: { minX: -8, maxX: 8, minZ: -11, maxZ: 11 }, tee: { x: 0, z: -8 }, cup: { x: 0, z: 8 }, walls: [{ x: -3.5, z: 1, w: 5, d: WALL_THICK }, { x: 3.5, z: 1, w: 5, d: WALL_THICK }], rocks: [] },
  { par: 4, bounds: { minX: -9, maxX: 9, minZ: -12, maxZ: 12 }, tee: { x: -6, z: -9 }, cup: { x: 6, z: 9 }, walls: [{ x: -2, z: -3, w: 9, d: WALL_THICK }, { x: 2, z: 3, w: 9, d: WALL_THICK }], rocks: [{ x: 0, z: 0, r: 0.9 }] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11 }, tee: { x: -3, z: -8 }, cup: { x: 3, z: 8 }, walls: [{ x: 0, z: 0, w: WALL_THICK, d: 9 }], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11 }, tee: { x: 0, z: -8 }, cup: { x: 0, z: 8 }, walls: [], rocks: [{ x: -1.6, z: 5, r: 0.8 }, { x: 1.6, z: 5, r: 0.8 }] },
  { par: 4, bounds: { minX: -8, maxX: 8, minZ: -14, maxZ: 14 }, tee: { x: -5, z: -11 }, cup: { x: 5, z: 11 }, walls: [{ x: 2, z: -5, w: 9, d: WALL_THICK }, { x: -2, z: 0, w: 9, d: WALL_THICK }, { x: 2, z: 5, w: 9, d: WALL_THICK }], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -12, maxZ: 12 }, tee: { x: 0, z: -9 }, cup: { x: 0, z: 9 }, walls: [{ x: -2.5, z: -2, w: 6, d: WALL_THICK }, { x: 2.5, z: 2, w: 6, d: WALL_THICK }], rocks: [{ x: 0, z: 6, r: 0.8 }] },
  { par: 4, bounds: { minX: -9, maxX: 9, minZ: -15, maxZ: 15 }, tee: { x: 0, z: -12 }, cup: { x: 0, z: 12 }, walls: [{ x: -4, z: -4, w: WALL_THICK, d: 9 }, { x: 4, z: 4, w: WALL_THICK, d: 9 }], rocks: [{ x: 0, z: 0, r: 1.3 }, { x: -2.5, z: 7, r: 0.8 }, { x: 2.5, z: 7, r: 0.8 }] },
];

let currentHole = 0;
let strokes = 0;
let totalStrokes = 0;
const holeScores = new Array(HOLES.length).fill(null);

// ---------------------------------------------------------------------------
// Scene + atmosphere
// ---------------------------------------------------------------------------
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color3(0.55, 0.74, 0.92);
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogColor = new BABYLON.Color3(0.72, 0.84, 0.93);
scene.fogDensity = 0.006;

const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, 0.82, 30, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.lowerBetaLimit = 0.15;
camera.upperBetaLimit = 1.35;
camera.lowerRadiusLimit = 12;
camera.upperRadiusLimit = 75;
camera.wheelPrecision = 18;
camera.panningSensibility = 0;

// --- Gradient sky dome (self-contained, no external assets) ---------------
(function buildSky() {
  const sky = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 600, sideOrientation: BABYLON.Mesh.BACKSIDE, segments: 24 }, scene);
  const tex = new BABYLON.DynamicTexture("skyTex", { width: 8, height: 512 }, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, "#3d7fd6");
  grad.addColorStop(0.45, "#83b9ef");
  grad.addColorStop(0.78, "#cfe8f7");
  grad.addColorStop(1.0, "#e9f4ec");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 512);
  tex.update();
  const m = new BABYLON.StandardMaterial("skyMat", scene);
  m.disableLighting = true;
  m.emissiveTexture = tex;
  m.backFaceCulling = false;
  sky.material = m;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.applyFog = false;
})();

const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0.2, 1, 0.1), scene);
hemi.intensity = 0.55;
hemi.diffuse = new BABYLON.Color3(0.9, 0.95, 1.0);
hemi.groundColor = new BABYLON.Color3(0.32, 0.42, 0.3);

const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.55, -1, 0.4), scene);
sun.position = new BABYLON.Vector3(40, 70, -40);
sun.intensity = 1.5;
sun.diffuse = new BABYLON.Color3(1.0, 0.98, 0.9);

const shadowGen = new BABYLON.ShadowGenerator(2048, sun);
shadowGen.useBlurExponentialShadowMap = true;
shadowGen.blurScale = 2;
shadowGen.darkness = 0.55;

// --- Post-processing for a richer image -----------------------------------
const pipeline = new BABYLON.DefaultRenderingPipeline("pipe", true, scene, [camera]);
pipeline.samples = 4;                 // hardware MSAA
pipeline.fxaaEnabled = true;
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.85;
pipeline.bloomWeight = 0.18;
pipeline.bloomKernel = 48;
pipeline.sharpenEnabled = true;
pipeline.sharpen.edgeAmount = 0.25;
pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.exposure = 1.15;
pipeline.imageProcessing.contrast = 1.12;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 1.6;
pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
function mat(name, r, g, b, spec) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor = new BABYLON.Color3(r, g, b);
  m.specularColor = spec ? new BABYLON.Color3(spec, spec, spec) : new BABYLON.Color3(0.04, 0.04, 0.04);
  return m;
}

const grassMat = mat("grass", 0.28, 0.62, 0.27);
const floorMat = mat("floor", 0.16, 0.24, 0.14);
const woodMat = mat("wood", 0.5, 0.34, 0.19);
const trunkMat = mat("trunk", 0.34, 0.21, 0.12);
const leafMat = mat("leaf", 0.15, 0.42, 0.19);
const leafMat2 = mat("leaf2", 0.2, 0.52, 0.24);
const rockMat = mat("rock", 0.5, 0.51, 0.53, 0.18);
const ballMat = mat("ball", 0.97, 0.98, 1.0, 0.9);
ballMat.specularPower = 64;
const cupMat = mat("cup", 0.01, 0.012, 0.01);
cupMat.backFaceCulling = false; // so the inside walls of the open cup render
const flagMat = mat("flag", 0.92, 0.18, 0.24);
flagMat.emissiveColor = new BABYLON.Color3(0.3, 0.04, 0.06);

// ---------------------------------------------------------------------------
// Persistent meshes / state
// ---------------------------------------------------------------------------
const ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: BALL_RADIUS * 2, segments: 16 }, scene);
ball.material = ballMat;
shadowGen.addShadowCaster(ball);

const vel = { x: 0, y: 0, z: 0 };  // 3D velocity (units / s)
let ballMoving = false;
let holeComplete = false;
let aimLine = null;

let courseMeshes = [];
let bounds = null;
let walls = [];
let rocks = [];
let features = [];     // terrain height contributors (ramps)
let baseMax = 0;       // tallest base terrain on this hole

let cupX = 0, cupZ = 0;
let cupBaseY = 0, cupRimY = 0, cupFloorY = 0;

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Terrain model (shared by mesh generation and physics)
// ---------------------------------------------------------------------------
function baseHeight(x, z) {
  let h = 0;
  for (const f of features) h += f(x, z);
  return h;
}

// Green surface height (ramps only -> smooth, even surface).
function terrainHeight(x, z) {
  return baseHeight(x, z);
}

function terrainNormal(x, z) {
  if (features.length === 0) return { x: 0, y: 1, z: 0 };
  const e = 0.08;
  const hL = terrainHeight(x - e, z);
  const hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e);
  const hU = terrainHeight(x, z + e);
  let nx = -(hR - hL) / (2 * e);
  let nz = -(hU - hD) / (2 * e);
  let ny = 1;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

// Where the ball's CENTER is supported at (x, z), plus the surface normal.
function supportAt(x, z) {
  const dc = Math.hypot(x - cupX, z - cupZ);
  if (dc >= HOLE_RADIUS) {
    return { y: terrainHeight(x, z) + BALL_RADIUS, n: terrainNormal(x, z) };
  }
  const edge = HOLE_RADIUS - dc; // how far inside the rim
  if (edge < BALL_RADIUS && !holeComplete) {
    // resting on the rim lip (ignored once the ball is captured so it drops in)
    return { y: cupRimY + Math.sqrt(BALL_RADIUS * BALL_RADIUS - edge * edge), n: { x: 0, y: 1, z: 0 } };
  }
  // fully over the opening -> only the pit floor supports it
  return { y: cupFloorY + BALL_RADIUS, n: { x: 0, y: 1, z: 0 } };
}

// ---------------------------------------------------------------------------
// Building a hole
// ---------------------------------------------------------------------------
function clearCourse() {
  courseMeshes.forEach((m) => m.dispose());
  courseMeshes = [];
  walls = [];
  rocks = [];
}

function addWall(x, z, w, d, wh) {
  const height = wh || WALL_HEIGHT;
  const wall = BABYLON.MeshBuilder.CreateBox("wall", { width: w, height, depth: d }, scene);
  wall.position.set(x, height / 2, z);
  wall.material = woodMat;
  wall.receiveShadows = true;
  shadowGen.addShadowCaster(wall);
  courseMeshes.push(wall);
  walls.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

function addRock(x, z, r) {
  const rock = BABYLON.MeshBuilder.CreateSphere("rock", { diameter: r * 2, segments: 10 }, scene);
  rock.position.set(x, baseHeight(x, z) + r * 0.55, z);
  rock.scaling.y = 0.7;
  rock.material = rockMat;
  rock.receiveShadows = true;
  shadowGen.addShadowCaster(rock);
  courseMeshes.push(rock);
  rocks.push({ x, z, r });
}

function makeTree(x, z, s, rng) {
  const trunk = BABYLON.MeshBuilder.CreateCylinder("trunk", { height: 1.6 * s, diameterTop: 0.25 * s, diameterBottom: 0.4 * s }, scene);
  trunk.position.set(x, 0.8 * s, z);
  trunk.material = trunkMat;
  courseMeshes.push(trunk);
  const tiers = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < tiers; i++) {
    const cone = BABYLON.MeshBuilder.CreateCylinder("foliage", { height: 1.6 * s, diameterTop: 0, diameterBottom: (2.2 - i * 0.5) * s, tessellation: 8 }, scene);
    cone.position.set(x, (1.7 + i * 1.0) * s, z);
    cone.material = i % 2 === 0 ? leafMat : leafMat2;
    shadowGen.addShadowCaster(cone);
    courseMeshes.push(cone);
  }
}

function buildGreen(cx, cz, width, depth) {
  // Moderate subdivisions: enough to render ramps smoothly, light enough for CSG.
  const subs = Math.min(Math.max(Math.round(Math.max(width, depth) / 0.5), 24, baseMax > 0 ? 48 : 24), 90);
  let green = BABYLON.MeshBuilder.CreateGround("greenBase", { width, height: depth, subdivisions: subs, updatable: true }, scene);
  green.position.set(cx, 0, cz);

  // Displace only for ramps so the surface stays smooth and even.
  if (features.length > 0) {
    const positions = green.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = baseHeight(positions[i] + cx, positions[i + 2] + cz);
    }
    const normals = [];
    BABYLON.VertexData.ComputeNormals(positions, green.getIndices(), normals);
    green.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    green.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  }

  // Cut a clean circular hole at the cup using CSG.
  const cutter = BABYLON.MeshBuilder.CreateCylinder("cutter", { height: baseMax + CUP_DEPTH + 6, diameter: HOLE_RADIUS * 2, tessellation: 40 }, scene);
  cutter.position.set(cupX, cupBaseY, cupZ);
  const result = BABYLON.CSG.FromMesh(green).subtract(BABYLON.CSG.FromMesh(cutter)).toMesh("ground", grassMat, scene);
  green.dispose();
  cutter.dispose();
  result.receiveShadows = true;
  courseMeshes.push(result);
}

function buildHole(index) {
  clearCourse();
  const h = HOLES[index];
  bounds = h.bounds;
  cupX = h.cup.x;
  cupZ = h.cup.z;
  const rng = makeRng(index * 7919 + 17);

  // terrain features (ramps)
  features = [];
  baseMax = 0;
  (h.ramps || []).forEach((r) => {
    const from = r.from, to = r.to, height = r.height, axis = r.axis;
    features.push((x, z) => {
      const u = axis === "z" ? z : x;
      if (u <= from) return 0;
      if (u >= to) return height;
      return height * (u - from) / (to - from);
    });
    baseMax = Math.max(baseMax, Math.max(0, height));
  });

  // cup vertical metrics
  cupBaseY = baseHeight(cupX, cupZ);
  cupRimY = cupBaseY;
  cupFloorY = cupBaseY - CUP_DEPTH;

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  // Forest floor for depth
  const floor = BABYLON.MeshBuilder.CreateGround("forestFloor", { width: width + 44, height: depth + 44 }, scene);
  floor.position.set(cx, -0.6, cz);
  floor.material = floorMat;
  courseMeshes.push(floor);

  // Even green with a clean CSG-cut hole at the cup
  buildGreen(cx, cz, width, depth);

  // Dark cup interior: walls lining the cut + a floor disc, so you see down
  // into a clean round hole.
  const wall = BABYLON.MeshBuilder.CreateCylinder("cupWall", { height: CUP_DEPTH, diameter: HOLE_RADIUS * 2 * 0.995, tessellation: 40, cap: BABYLON.Mesh.NO_CAP }, scene);
  wall.position.set(cupX, cupBaseY - CUP_DEPTH / 2, cupZ);
  wall.material = cupMat;
  courseMeshes.push(wall);

  const cupBottom = BABYLON.MeshBuilder.CreateDisc("cupBottom", { radius: HOLE_RADIUS * 0.995, tessellation: 40 }, scene);
  cupBottom.rotation.x = Math.PI / 2;
  cupBottom.position.set(cupX, cupFloorY + 0.005, cupZ);
  cupBottom.material = cupMat;
  courseMeshes.push(cupBottom);

  // Thin dark rim ring to crisp up the edge of the hole
  const rim = BABYLON.MeshBuilder.CreateTorus("cupRim", { diameter: HOLE_RADIUS * 2, thickness: 0.07, tessellation: 40 }, scene);
  rim.position.set(cupX, cupBaseY + 0.005, cupZ);
  rim.material = cupMat;
  courseMeshes.push(rim);

  // Perimeter walls (raised to cover any plateau)
  const pwh = WALL_HEIGHT + baseMax;
  addWall(cx, bounds.minZ - WALL_THICK / 2, width + WALL_THICK * 2, WALL_THICK, pwh);
  addWall(cx, bounds.maxZ + WALL_THICK / 2, width + WALL_THICK * 2, WALL_THICK, pwh);
  addWall(bounds.minX - WALL_THICK / 2, cz, WALL_THICK, depth, pwh);
  addWall(bounds.maxX + WALL_THICK / 2, cz, WALL_THICK, depth, pwh);

  h.walls.forEach((w) => addWall(w.x, w.z, w.w, w.d));
  (h.rocks || []).forEach((r) => addRock(r.x, r.z, r.r));

  // Flag
  const pole = BABYLON.MeshBuilder.CreateCylinder("pole", { height: 3, diameter: 0.08 }, scene);
  pole.position.set(cupX, cupBaseY + 1.5, cupZ);
  pole.material = woodMat;
  courseMeshes.push(pole);

  const flag = BABYLON.MeshBuilder.CreatePlane("flag", { width: 1, height: 0.6 }, scene);
  flag.position.set(cupX + 0.5, cupBaseY + 2.6, cupZ);
  flag.material = flagMat;
  flag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  courseMeshes.push(flag);

  // Surrounding forest
  placeTrees(cx, cz, width, depth, rng);

  // Reset ball onto the tee surface
  ball.position.set(h.tee.x, terrainHeight(h.tee.x, h.tee.z) + BALL_RADIUS, h.tee.z);
  vel.x = vel.y = vel.z = 0;
  ballMoving = false;
  holeComplete = false;

  camera.setTarget(new BABYLON.Vector3(cx, 0, cz));
  camera.radius = Math.min(Math.max(Math.max(width, depth) * 1.35, 18), 66);

  document.getElementById("hole").textContent = String(index + 1);
  document.getElementById("par").textContent = String(h.par);
  document.getElementById("strokes").textContent = "0";
  document.getElementById("total").textContent = String(totalStrokes);
}

function placeTrees(cx, cz, width, depth, rng) {
  const halfW = width / 2 + 1.5;
  const halfD = depth / 2 + 1.5;
  const ring = 3.5;
  for (let x = cx - halfW - ring; x <= cx + halfW + ring; x += 3.0) {
    placeJittered(x, cz - halfD - ring * (0.6 + rng()), rng);
    placeJittered(x, cz + halfD + ring * (0.6 + rng()), rng);
  }
  for (let z = cz - halfD; z <= cz + halfD; z += 3.4) {
    placeJittered(cx - halfW - ring * (0.6 + rng()), z, rng);
    placeJittered(cx + halfW + ring * (0.6 + rng()), z, rng);
  }
}

function placeJittered(x, z, rng) {
  makeTree(x + (rng() - 0.5) * 2.2, z + (rng() - 0.5) * 2.2, 0.8 + rng() * 0.9, rng);
}

// ---------------------------------------------------------------------------
// Physics — fixed sub-step integrator
// ---------------------------------------------------------------------------
function physicsStep(dt) {
  // gravity
  vel.y -= GRAVITY * dt;

  // once captured, gently pull the ball to the cup center so it settles in
  if (holeComplete) {
    vel.x += (cupX - ball.position.x) * 10 * dt;
    vel.z += (cupZ - ball.position.z) * 10 * dt;
  }

  // integrate
  ball.position.x += vel.x * dt;
  ball.position.y += vel.y * dt;
  ball.position.z += vel.z * dt;

  resolveWalls();
  resolveRocks();
  resolveGround(dt);
  checkCapture();
  checkStop();
}

function resolveWalls() {
  for (const w of walls) {
    const exMinX = w.minX - BALL_RADIUS;
    const exMaxX = w.maxX + BALL_RADIUS;
    const exMinZ = w.minZ - BALL_RADIUS;
    const exMaxZ = w.maxZ + BALL_RADIUS;
    let x = ball.position.x, z = ball.position.z;
    if (x > exMinX && x < exMaxX && z > exMinZ && z < exMaxZ) {
      const overlapX = Math.min(x - exMinX, exMaxX - x);
      const overlapZ = Math.min(z - exMinZ, exMaxZ - z);
      if (overlapX < overlapZ) {
        ball.position.x = x < (w.minX + w.maxX) / 2 ? exMinX : exMaxX;
        vel.x *= -WALL_RESTITUTION;
      } else {
        ball.position.z = z < (w.minZ + w.maxZ) / 2 ? exMinZ : exMaxZ;
        vel.z *= -WALL_RESTITUTION;
      }
    }
  }

  // outer bounds (in case the ball slips past)
  const minX = bounds.minX + BALL_RADIUS, maxX = bounds.maxX - BALL_RADIUS;
  const minZ = bounds.minZ + BALL_RADIUS, maxZ = bounds.maxZ - BALL_RADIUS;
  if (ball.position.x < minX) { ball.position.x = minX; vel.x *= -WALL_RESTITUTION; }
  if (ball.position.x > maxX) { ball.position.x = maxX; vel.x *= -WALL_RESTITUTION; }
  if (ball.position.z < minZ) { ball.position.z = minZ; vel.z *= -WALL_RESTITUTION; }
  if (ball.position.z > maxZ) { ball.position.z = maxZ; vel.z *= -WALL_RESTITUTION; }
}

function resolveRocks() {
  for (const c of rocks) {
    const dx = ball.position.x - c.x;
    const dz = ball.position.z - c.z;
    const minD = c.r + BALL_RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD * minD) {
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d, nz = dz / d;
      ball.position.x = c.x + nx * minD;
      ball.position.z = c.z + nz * minD;
      const dot = vel.x * nx + vel.z * nz;
      vel.x -= (1 + WALL_RESTITUTION) * dot * nx;
      vel.z -= (1 + WALL_RESTITUTION) * dot * nz;
    }
  }
}

function resolveGround(dt) {
  const s = supportAt(ball.position.x, ball.position.z);
  if (ball.position.y <= s.y + 1e-3) {
    ball.position.y = s.y;
    const n = s.n;
    const vDotN = vel.x * n.x + vel.y * n.y + vel.z * n.z;
    if (vDotN < 0) {
      const j = (1 + GROUND_RESTITUTION) * vDotN;
      vel.x -= j * n.x;
      vel.y -= j * n.y;
      vel.z -= j * n.z;
    }
    // rolling friction: constant deceleration so the ball slows and stops
    // decisively (grass), instead of creeping forever.
    const sp = Math.hypot(vel.x, vel.z);
    if (sp > 1e-5) {
      const f = Math.max(0, sp - FRICTION_DECEL * dt) / sp;
      vel.x *= f;
      vel.z *= f;
    }
    if (Math.abs(vel.y) < 0.5) vel.y = 0;
  }
}

function checkCapture() {
  if (holeComplete) return;
  const dc = Math.hypot(ball.position.x - cupX, ball.position.z - cupZ);
  const speed = Math.hypot(vel.x, vel.z);
  // The ball drops in if any of:
  //  - its center is over the opening and it isn't flying past too fast, or
  //  - it has already dipped below the rim, or
  //  - its center is well inside the hole (regardless of speed).
  const overHole = dc < HOLE_RADIUS;
  const wellInside = dc < HOLE_RADIUS - BALL_RADIUS * 0.5;
  if ((overHole && speed < CAPTURE_SPEED) || (overHole && ball.position.y < cupRimY - 0.01) || wellInside) {
    holeComplete = true;
    // bleed off momentum so the ball drops into the cup instead of skating out
    const hs = Math.hypot(vel.x, vel.z);
    if (hs > 1.5) {
      const f = 1.5 / hs;
      vel.x *= f;
      vel.z *= f;
    }
    setTimeout(recordAndAdvance, 650);
  }
}

const STATIC_FRICTION = 0.27; // max slope (sin) the ball can rest on before rolling (~15deg)

function checkStop() {
  if (holeComplete) return;
  // Never allow the ball to rest while it overlaps the hole opening — it must
  // either drop in (capture) or roll back off, never perch on the rim.
  const dc = Math.hypot(ball.position.x - cupX, ball.position.z - cupZ);
  if (dc < HOLE_RADIUS) return;
  const s = supportAt(ball.position.x, ball.position.z);
  const onGround = ball.position.y <= s.y + 1e-2;
  if (!onGround) return;
  const horiz = Math.hypot(vel.x, vel.z);
  // Gravity component along the surface; if it exceeds static friction the
  // ball can't rest here and must keep rolling downhill.
  const slopeAccel = Math.sqrt(Math.max(0, 1 - s.n.y * s.n.y));
  const canRest = slopeAccel < STATIC_FRICTION;
  if (canRest && horiz < STOP_SPEED && Math.abs(vel.y) < 0.4) {
    vel.x = vel.y = vel.z = 0;
    ballMoving = false;
  }
}

let accumulator = 0;
function updatePhysics() {
  if (!ballMoving) return;
  let dt = engine.getDeltaTime() / 1000;
  if (dt > 0.05) dt = 0.05; // clamp big frame gaps
  accumulator += dt;
  let guard = 0;
  while (accumulator >= FIXED_DT && guard < 600) {
    physicsStep(FIXED_DT);
    accumulator -= FIXED_DT;
    guard++;
    if (!ballMoving) break;
  }
}

// ---------------------------------------------------------------------------
// Aiming + input
// ---------------------------------------------------------------------------
let isAiming = false;
let aimStart = null;

function groundPointFromPointer() {
  const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === "ground");
  if (pick && pick.hit) return pick.pickedPoint;
  const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
  const t = -ray.origin.y / ray.direction.y;
  return ray.origin.add(ray.direction.scale(t));
}

function updateAimLine(from, to) {
  if (aimLine) { aimLine.dispose(); aimLine = null; }
  if (!from || !to) return;
  const y = ball.position.y + 0.05;
  aimLine = BABYLON.MeshBuilder.CreateLines("aim", {
    points: [new BABYLON.Vector3(from.x, y, from.z), new BABYLON.Vector3(to.x, y, to.z)],
  }, scene);
  aimLine.color = new BABYLON.Color3(1, 1, 0.4);
}

scene.onPointerObservable.add((info) => {
  if (holeComplete || ballMoving || !gameStarted) return;

  if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
    const p = groundPointFromPointer();
    if (!p) return;
    const dx = p.x - ball.position.x;
    const dz = p.z - ball.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < 4) {
      isAiming = true;
      aimStart = { x: ball.position.x, z: ball.position.z };
      camera.detachControl();
    }
  } else if (info.type === BABYLON.PointerEventTypes.POINTERMOVE && isAiming) {
    const p = groundPointFromPointer();
    if (p) {
      const aimEnd = { x: ball.position.x - (p.x - aimStart.x), z: ball.position.z - (p.z - aimStart.z) };
      updateAimLine(ball.position, aimEnd);
    }
  } else if (info.type === BABYLON.PointerEventTypes.POINTERUP && isAiming) {
    isAiming = false;
    camera.attachControl(canvas, true);
    const p = groundPointFromPointer();
    updateAimLine(null, null);
    if (!p) return;

    let dx = -(p.x - aimStart.x);
    let dz = -(p.z - aimStart.z);
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.3) return;

    const speed = Math.min(len / 5.5, 1) * MAX_SPEED;
    vel.x = (dx / len) * speed;
    vel.z = (dz / len) * speed;
    vel.y = 0;
    ballMoving = true;
    accumulator = 0;
    strokes += 1;
    document.getElementById("strokes").textContent = String(strokes);
  }
});

// ---------------------------------------------------------------------------
// Progression + scorecard
// ---------------------------------------------------------------------------
function recordAndAdvance() {
  holeScores[currentHole] = strokes;
  totalStrokes += strokes;
  document.getElementById("total").textContent = String(totalStrokes);

  if (currentHole === HOLES.length - 1) showScorecard();
  else showHoleComplete();
}

function termFor(s, par) {
  const diff = s - par;
  if (s === 1) return "Hole in one!";
  if (diff <= -2) return "Eagle!";
  if (diff === -1) return "Birdie!";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  return "+" + diff;
}

function showHoleComplete() {
  const h = HOLES[currentHole];
  document.getElementById("scorecard").classList.add("hidden");
  document.getElementById("msg-title").textContent = termFor(strokes, h.par);
  document.getElementById("msg-body").textContent =
    `Hole ${currentHole + 1} done in ${strokes} stroke${strokes === 1 ? "" : "s"} (par ${h.par}).`;
  const btn = document.getElementById("msg-btn");
  btn.textContent = "Next Hole";
  document.getElementById("message").classList.remove("hidden");
  btn.onclick = () => {
    document.getElementById("message").classList.add("hidden");
    currentHole += 1;
    strokes = 0;
    buildHole(currentHole);
  };
}

function showScorecard() {
  const totalPar = HOLES.reduce((a, h) => a + h.par, 0);
  const diff = totalStrokes - totalPar;
  const diffTxt = diff === 0 ? "even par" : diff > 0 ? `+${diff}` : `${diff}`;
  document.getElementById("msg-title").textContent = "Round Complete!";
  document.getElementById("msg-body").textContent = `Total ${totalStrokes} · par ${totalPar} · ${diffTxt}`;

  let rows = "";
  for (let i = 0; i < HOLES.length; i++) {
    const sc = holeScores[i], p = HOLES[i].par;
    const cls = sc < p ? "under" : sc > p ? "over" : "";
    rows += `<tr><td>${i + 1}</td><td>${p}</td><td class="${cls}">${sc}</td></tr>`;
  }
  const card = document.getElementById("scorecard");
  card.innerHTML = `<table><thead><tr><th>Hole</th><th>Par</th><th>You</th></tr></thead><tbody>${rows}
    <tr class="total"><td>Total</td><td>${totalPar}</td><td>${totalStrokes}</td></tr></tbody></table>`;
  card.classList.remove("hidden");

  const btn = document.getElementById("msg-btn");
  btn.textContent = "Play Again";
  document.getElementById("message").classList.remove("hidden");
  btn.onclick = () => {
    document.getElementById("message").classList.add("hidden");
    card.classList.add("hidden");
    currentHole = 0; strokes = 0; totalStrokes = 0;
    holeScores.fill(null);
    buildHole(currentHole);
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
let gameStarted = false;
buildHole(0);

document.getElementById("start-btn").onclick = () => {
  document.getElementById("start").classList.add("hidden");
  gameStarted = true;
};

scene.onBeforeRenderObservable.add(updatePhysics);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
