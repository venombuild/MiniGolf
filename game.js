"use strict";

// ---------------------------------------------------------------------------
// Forest Mini Golf — Babylon.js
// 18-hole fixed course with a forest theme. Static site, custom physics.
// ---------------------------------------------------------------------------

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const BALL_RADIUS = 0.35;
const HOLE_RADIUS = 0.6;
const FRICTION = 0.985;
const STOP_SPEED = 0.02;
const MAX_POWER = 0.9;
const WALL_HEIGHT = 1.1;
const WALL_THICK = 0.5;
const BOUNCE = 0.7;

// ---------------------------------------------------------------------------
// Course: 18 fixed holes.
//   bounds: playable rectangle (XZ)
//   tee/cup: positions
//   walls:  axis-aligned box obstacles { x, z, w (x-size), d (z-size) }
//   rocks:  circular obstacles { x, z, r }
// ---------------------------------------------------------------------------
const HOLES = [
  { par: 2, bounds: { minX: -6, maxX: 6, minZ: -9, maxZ: 9 }, tee: { x: 0, z: -6 }, cup: { x: 0, z: 6 }, walls: [], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11 }, tee: { x: -4, z: -8 }, cup: { x: 4, z: 8 }, walls: [{ x: -1.5, z: 0, w: 9, d: WALL_THICK }], rocks: [] },
  { par: 3, bounds: { minX: -8, maxX: 8, minZ: -11, maxZ: 11 }, tee: { x: 0, z: -8 }, cup: { x: 0, z: 8 }, walls: [{ x: -3.5, z: 0, w: WALL_THICK, d: 10 }, { x: 3.5, z: 0, w: WALL_THICK, d: 10 }], rocks: [] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -10, maxZ: 10 }, tee: { x: 0, z: -7 }, cup: { x: 0, z: 7 }, walls: [], rocks: [{ x: 0, z: 0, r: 1.2 }] },
  { par: 2, bounds: { minX: -6, maxX: 6, minZ: -9, maxZ: 9 }, tee: { x: 0, z: -6 }, cup: { x: 0, z: 6 }, walls: [], rocks: [{ x: -1.8, z: 1, r: 0.8 }, { x: 1.8, z: -1, r: 0.8 }] },
  { par: 3, bounds: { minX: -7, maxX: 7, minZ: -12, maxZ: 12 }, tee: { x: -4, z: -9 }, cup: { x: 4, z: 9 }, walls: [{ x: 2, z: -4, w: 8, d: WALL_THICK }, { x: -2, z: 4, w: 8, d: WALL_THICK }], rocks: [] },
  { par: 4, bounds: { minX: -7, maxX: 7, minZ: -14, maxZ: 14 }, tee: { x: 0, z: -12 }, cup: { x: 0, z: 12 }, walls: [{ x: -3, z: -3, w: WALL_THICK, d: 8 }, { x: 3, z: 3, w: WALL_THICK, d: 8 }], rocks: [] },
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
scene.clearColor = new BABYLON.Color3(0.42, 0.55, 0.45); // misty forest sky
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogColor = new BABYLON.Color3(0.42, 0.55, 0.45);
scene.fogDensity = 0.018;

const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, 0.82, 30, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.lowerBetaLimit = 0.15;
camera.upperBetaLimit = 1.35;
camera.lowerRadiusLimit = 12;
camera.upperRadiusLimit = 70;
camera.wheelPrecision = 18;
camera.panningSensibility = 0;

const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
hemi.intensity = 0.7;
hemi.groundColor = new BABYLON.Color3(0.2, 0.28, 0.2);

const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, 0.4), scene);
sun.position = new BABYLON.Vector3(30, 50, -30);
sun.intensity = 0.85;

const shadowGen = new BABYLON.ShadowGenerator(1024, sun);
shadowGen.useBlurExponentialShadowMap = true;
shadowGen.blurScale = 2;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
function mat(name, r, g, b, spec) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor = new BABYLON.Color3(r, g, b);
  m.specularColor = spec ? new BABYLON.Color3(spec, spec, spec) : new BABYLON.Color3(0.04, 0.04, 0.04);
  return m;
}

const grassMat = mat("grass", 0.22, 0.5, 0.24);
const fairwayMat = mat("fairway", 0.28, 0.58, 0.3);
const floorMat = mat("floor", 0.13, 0.2, 0.12);
const woodMat = mat("wood", 0.42, 0.28, 0.16);
const trunkMat = mat("trunk", 0.32, 0.2, 0.11);
const leafMat = mat("leaf", 0.13, 0.36, 0.17);
const leafMat2 = mat("leaf2", 0.17, 0.44, 0.2);
const rockMat = mat("rock", 0.45, 0.46, 0.48, 0.12);
const ballMat = mat("ball", 0.96, 0.97, 0.98, 0.6);
const cupMat = mat("cup", 0.02, 0.02, 0.02);
const flagMat = mat("flag", 0.9, 0.2, 0.25);
flagMat.emissiveColor = new BABYLON.Color3(0.35, 0.05, 0.07);

// ---------------------------------------------------------------------------
// Persistent meshes
// ---------------------------------------------------------------------------
const ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: BALL_RADIUS * 2, segments: 16 }, scene);
ball.material = ballMat;
ball.position.y = BALL_RADIUS;
shadowGen.addShadowCaster(ball);

const ballVel = { x: 0, z: 0 };
let ballMoving = false;
let holeComplete = false;
let aimLine = null;

let courseMeshes = [];
let cupCenter = { x: 0, z: 0 };
let bounds = null;
let walls = [];
let rocks = [];

// Deterministic RNG so the "set course" looks identical every play.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

function addWall(x, z, w, d) {
  const wall = BABYLON.MeshBuilder.CreateBox("wall", { width: w, height: WALL_HEIGHT, depth: d }, scene);
  wall.position.set(x, WALL_HEIGHT / 2, z);
  wall.material = woodMat;
  wall.receiveShadows = true;
  shadowGen.addShadowCaster(wall);
  courseMeshes.push(wall);
  walls.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

function addRock(x, z, r) {
  const rock = BABYLON.MeshBuilder.CreateSphere("rock", { diameter: r * 2, segments: 10 }, scene);
  rock.position.set(x, r * 0.55, z);
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
    const cone = BABYLON.MeshBuilder.CreateCylinder("foliage", {
      height: 1.6 * s, diameterTop: 0, diameterBottom: (2.2 - i * 0.5) * s, tessellation: 8,
    }, scene);
    cone.position.set(x, (1.7 + i * 1.0) * s, z);
    cone.material = i % 2 === 0 ? leafMat : leafMat2;
    shadowGen.addShadowCaster(cone);
    courseMeshes.push(cone);
  }
}

function buildHole(index) {
  clearCourse();
  const h = HOLES[index];
  bounds = h.bounds;
  cupCenter = { x: h.cup.x, z: h.cup.z };
  const rng = makeRng(index * 7919 + 17);

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  // Forest floor (large, beneath everything) for depth
  const floor = BABYLON.MeshBuilder.CreateGround("forestFloor", { width: width + 40, height: depth + 40 }, scene);
  floor.position.set(cx, -0.08, cz);
  floor.material = floorMat;
  courseMeshes.push(floor);

  // Playable green
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width, height: depth }, scene);
  ground.position.set(cx, 0, cz);
  ground.material = grassMat;
  ground.receiveShadows = true;
  courseMeshes.push(ground);

  // A lighter fairway strip from tee to cup
  const fdx = h.cup.x - h.tee.x;
  const fdz = h.cup.z - h.tee.z;
  const fairway = BABYLON.MeshBuilder.CreateGround("fairwayStrip", { width: 2.4, height: Math.hypot(fdx, fdz) }, scene);
  fairway.position.set((h.tee.x + h.cup.x) / 2, 0.01, (h.tee.z + h.cup.z) / 2);
  fairway.rotation.y = Math.atan2(fdx, fdz);
  fairway.material = fairwayMat;
  courseMeshes.push(fairway);

  // Perimeter log walls
  addWall(cx, bounds.minZ - WALL_THICK / 2, width + WALL_THICK * 2, WALL_THICK);
  addWall(cx, bounds.maxZ + WALL_THICK / 2, width + WALL_THICK * 2, WALL_THICK);
  addWall(bounds.minX - WALL_THICK / 2, cz, WALL_THICK, depth);
  addWall(bounds.maxX + WALL_THICK / 2, cz, WALL_THICK, depth);

  h.walls.forEach((w) => addWall(w.x, w.z, w.w, w.d));
  h.rocks.forEach((r) => addRock(r.x, r.z, r.r));

  // Cup + flag
  const cup = BABYLON.MeshBuilder.CreateDisc("cup", { radius: HOLE_RADIUS, tessellation: 24 }, scene);
  cup.rotation.x = Math.PI / 2;
  cup.position.set(cupCenter.x, 0.03, cupCenter.z);
  cup.material = cupMat;
  courseMeshes.push(cup);

  const pole = BABYLON.MeshBuilder.CreateCylinder("pole", { height: 3, diameter: 0.08 }, scene);
  pole.position.set(cupCenter.x, 1.5, cupCenter.z);
  pole.material = woodMat;
  courseMeshes.push(pole);

  const flag = BABYLON.MeshBuilder.CreatePlane("flag", { width: 1, height: 0.6 }, scene);
  flag.position.set(cupCenter.x + 0.5, 2.6, cupCenter.z);
  flag.material = flagMat;
  flag.rotation.y = Math.PI / 2;
  flag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  courseMeshes.push(flag);

  // Decorative forest ring of trees just outside the walls
  placeTrees(cx, cz, width, depth, rng);

  // Reset ball
  ball.position.set(h.tee.x, BALL_RADIUS, h.tee.z);
  ball.scaling.set(1, 1, 1);
  ballVel.x = 0;
  ballVel.z = 0;
  ballMoving = false;
  holeComplete = false;

  // Frame the whole course
  camera.setTarget(new BABYLON.Vector3(cx, 0, cz));
  camera.radius = Math.min(Math.max(Math.max(width, depth) * 1.35, 18), 62);

  document.getElementById("hole").textContent = String(index + 1);
  document.getElementById("par").textContent = String(h.par);
  document.getElementById("strokes").textContent = "0";
  document.getElementById("total").textContent = String(totalStrokes);
}

function placeTrees(cx, cz, width, depth, rng) {
  const halfW = width / 2 + 1.5;
  const halfD = depth / 2 + 1.5;
  const ring = 3.5;
  const stepX = 3.0;
  const stepZ = 3.4;
  // top & bottom rows
  for (let x = cx - halfW - ring; x <= cx + halfW + ring; x += stepX) {
    placeJittered(x, cz - halfD - ring * (0.6 + rng()), rng);
    placeJittered(x, cz + halfD + ring * (0.6 + rng()), rng);
  }
  // left & right columns
  for (let z = cz - halfD; z <= cz + halfD; z += stepZ) {
    placeJittered(cx - halfW - ring * (0.6 + rng()), z, rng);
    placeJittered(cx + halfW + ring * (0.6 + rng()), z, rng);
  }
}

function placeJittered(x, z, rng) {
  const jx = (rng() - 0.5) * 2.2;
  const jz = (rng() - 0.5) * 2.2;
  const s = 0.8 + rng() * 0.9;
  makeTree(x + jx, z + jz, s, rng);
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------
function updateBall() {
  if (!ballMoving || holeComplete) return;

  let nx = ball.position.x + ballVel.x;
  let nz = ball.position.z + ballVel.z;

  const minX = bounds.minX + BALL_RADIUS;
  const maxX = bounds.maxX - BALL_RADIUS;
  const minZ = bounds.minZ + BALL_RADIUS;
  const maxZ = bounds.maxZ - BALL_RADIUS;

  if (nx < minX) { nx = minX; ballVel.x *= -BOUNCE; }
  if (nx > maxX) { nx = maxX; ballVel.x *= -BOUNCE; }
  if (nz < minZ) { nz = minZ; ballVel.z *= -BOUNCE; }
  if (nz > maxZ) { nz = maxZ; ballVel.z *= -BOUNCE; }

  // Box wall collisions
  for (const w of walls) {
    const exMinX = w.minX - BALL_RADIUS;
    const exMaxX = w.maxX + BALL_RADIUS;
    const exMinZ = w.minZ - BALL_RADIUS;
    const exMaxZ = w.maxZ + BALL_RADIUS;
    if (nx > exMinX && nx < exMaxX && nz > exMinZ && nz < exMaxZ) {
      const overlapX = Math.min(nx - exMinX, exMaxX - nx);
      const overlapZ = Math.min(nz - exMinZ, exMaxZ - nz);
      if (overlapX < overlapZ) {
        nx = nx < (w.minX + w.maxX) / 2 ? exMinX : exMaxX;
        ballVel.x *= -BOUNCE;
      } else {
        nz = nz < (w.minZ + w.maxZ) / 2 ? exMinZ : exMaxZ;
        ballVel.z *= -BOUNCE;
      }
    }
  }

  // Circular rock collisions (reflect along normal)
  for (const c of rocks) {
    const dx = nx - c.x;
    const dz = nz - c.z;
    const minD = c.r + BALL_RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD * minD) {
      const d = Math.sqrt(d2) || 0.0001;
      const nrx = dx / d;
      const nrz = dz / d;
      nx = c.x + nrx * minD;
      nz = c.z + nrz * minD;
      const dot = ballVel.x * nrx + ballVel.z * nrz;
      ballVel.x -= 2 * dot * nrx;
      ballVel.z -= 2 * dot * nrz;
      ballVel.x *= BOUNCE;
      ballVel.z *= BOUNCE;
    }
  }

  ball.position.x = nx;
  ball.position.z = nz;

  ballVel.x *= FRICTION;
  ballVel.z *= FRICTION;

  const dx = ball.position.x - cupCenter.x;
  const dz = ball.position.z - cupCenter.z;
  const distToCup = Math.sqrt(dx * dx + dz * dz);
  const speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.z * ballVel.z);

  if (distToCup < HOLE_RADIUS && speed < MAX_POWER * 0.6) {
    sinkBall();
    return;
  }

  if (speed < STOP_SPEED) {
    ballVel.x = 0;
    ballVel.z = 0;
    ballMoving = false;
  }
}

function sinkBall() {
  holeComplete = true;
  ballMoving = false;
  ballVel.x = 0;
  ballVel.z = 0;
  ball.position.x = cupCenter.x;
  ball.position.z = cupCenter.z;

  const anim = new BABYLON.Animation("drop", "position.y", 30, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
  anim.setKeys([{ frame: 0, value: BALL_RADIUS }, { frame: 12, value: -BALL_RADIUS }]);
  ball.animations = [anim];
  scene.beginAnimation(ball, 0, 12, false, 1, () => recordAndAdvance());
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
  aimLine = BABYLON.MeshBuilder.CreateLines("aim", {
    points: [new BABYLON.Vector3(from.x, 0.12, from.z), new BABYLON.Vector3(to.x, 0.12, to.z)],
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

    let vx = -(p.x - aimStart.x);
    let vz = -(p.z - aimStart.z);
    const len = Math.sqrt(vx * vx + vz * vz);
    if (len < 0.3) return;

    const power = Math.min(len / 8, 1) * MAX_POWER;
    vx = (vx / len) * power;
    vz = (vz / len) * power;

    ballVel.x = vx;
    ballVel.z = vz;
    ballMoving = true;
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

  const isLast = currentHole === HOLES.length - 1;
  if (isLast) showScorecard();
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
    const s = holeScores[i];
    const p = HOLES[i].par;
    const cls = s < p ? "under" : s > p ? "over" : "";
    rows += `<tr><td>${i + 1}</td><td>${p}</td><td class="${cls}">${s}</td></tr>`;
  }
  const sc = document.getElementById("scorecard");
  sc.innerHTML = `<table><thead><tr><th>Hole</th><th>Par</th><th>You</th></tr></thead><tbody>${rows}
    <tr class="total"><td>Total</td><td>${totalPar}</td><td>${totalStrokes}</td></tr></tbody></table>`;
  sc.classList.remove("hidden");

  const btn = document.getElementById("msg-btn");
  btn.textContent = "Play Again";
  document.getElementById("message").classList.remove("hidden");

  btn.onclick = () => {
    document.getElementById("message").classList.add("hidden");
    sc.classList.add("hidden");
    currentHole = 0;
    strokes = 0;
    totalStrokes = 0;
    holeScores.fill(null);
    buildHole(currentHole);
  };
}

// ---------------------------------------------------------------------------
// Boot — show overview behind the title screen
// ---------------------------------------------------------------------------
let gameStarted = false;
buildHole(0);

document.getElementById("start-btn").onclick = () => {
  document.getElementById("start").classList.add("hidden");
  gameStarted = true;
};

scene.onBeforeRenderObservable.add(updateBall);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
