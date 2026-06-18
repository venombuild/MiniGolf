"use strict";

// ---------------------------------------------------------------------------
// Mini Golf — Babylon.js
// Simple, dependency-light putt-putt with custom top-down-ish physics.
// ---------------------------------------------------------------------------

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const BALL_RADIUS = 0.35;
const HOLE_RADIUS = 0.6;
const FRICTION = 0.985;        // velocity multiplier per frame-step
const STOP_SPEED = 0.02;       // below this speed the ball is "stopped"
const MAX_POWER = 0.85;        // max launch speed
const WALL_HEIGHT = 1.2;
const WALL_THICK = 0.5;

// ---------------------------------------------------------------------------
// Course definition. Each hole: tee position, cup position, arena bounds,
// optional interior wall obstacles, and par.
// ---------------------------------------------------------------------------
const HOLES = [
  {
    par: 2,
    bounds: { minX: -6, maxX: 6, minZ: -10, maxZ: 10 },
    tee: { x: 0, z: -7 },
    cup: { x: 0, z: 7 },
    walls: [],
  },
  {
    par: 3,
    bounds: { minX: -7, maxX: 7, minZ: -11, maxZ: 11 },
    tee: { x: -4, z: -8 },
    cup: { x: 4, z: 8 },
    // a staggered barrier in the middle to force a dog-leg
    walls: [
      { x: -1.5, z: 0, w: 9, d: WALL_THICK },
    ],
  },
  {
    par: 3,
    bounds: { minX: -8, maxX: 8, minZ: -11, maxZ: 11 },
    tee: { x: 0, z: -8 },
    cup: { x: 0, z: 8 },
    walls: [
      { x: -3.5, z: 0, w: WALL_THICK, d: 10 },
      { x: 3.5, z: 0, w: WALL_THICK, d: 10 },
    ],
  },
];

let currentHole = 0;
let strokes = 0;

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color3(0.043, 0.063, 0.125);

const camera = new BABYLON.ArcRotateCamera(
  "camera",
  -Math.PI / 2,
  0.85,
  28,
  new BABYLON.Vector3(0, 0, 0),
  scene
);
camera.attachControl(canvas, true);
camera.lowerBetaLimit = 0.2;
camera.upperBetaLimit = 1.3;
camera.lowerRadiusLimit = 14;
camera.upperRadiusLimit = 45;
camera.wheelPrecision = 20;
camera.panningSensibility = 0;

const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
hemi.intensity = 0.75;

const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, 0.4), scene);
sun.position = new BABYLON.Vector3(20, 40, -20);
sun.intensity = 0.8;

const shadowGen = new BABYLON.ShadowGenerator(1024, sun);
shadowGen.useBlurExponentialShadowMap = true;
shadowGen.blurScale = 2;

// ---------------------------------------------------------------------------
// Materials (created once, reused)
// ---------------------------------------------------------------------------
const greenMat = new BABYLON.StandardMaterial("green", scene);
greenMat.diffuseColor = new BABYLON.Color3(0.18, 0.55, 0.28);
greenMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

const wallMat = new BABYLON.StandardMaterial("wall", scene);
wallMat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.9);
wallMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

const ballMat = new BABYLON.StandardMaterial("ball", scene);
ballMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.98);
ballMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);

const cupMat = new BABYLON.StandardMaterial("cup", scene);
cupMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.02);
cupMat.specularColor = new BABYLON.Color3(0, 0, 0);

const flagMat = new BABYLON.StandardMaterial("flag", scene);
flagMat.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.25);
flagMat.emissiveColor = new BABYLON.Color3(0.4, 0.05, 0.08);

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

// Aim line (rendered as a dynamic line system)
let aimLine = null;

// Course-specific meshes that get rebuilt each hole
let courseMeshes = [];
let cupCenter = { x: 0, z: 0 };
let bounds = null;
let walls = [];

// ---------------------------------------------------------------------------
// Build a hole
// ---------------------------------------------------------------------------
function clearCourse() {
  courseMeshes.forEach((m) => m.dispose());
  courseMeshes = [];
  walls = [];
}

function buildHole(index) {
  clearCourse();
  const h = HOLES[index];
  bounds = h.bounds;
  cupCenter = { x: h.cup.x, z: h.cup.z };

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  // Ground
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width, height: depth }, scene);
  ground.position.x = cx;
  ground.position.z = cz;
  ground.material = greenMat;
  ground.receiveShadows = true;
  courseMeshes.push(ground);

  // Perimeter walls (4)
  addWall(cx, bounds.minZ - WALL_THICK / 2, width + WALL_THICK * 2, WALL_THICK); // back
  addWall(cx, bounds.maxZ + WALL_THICK / 2, width + WALL_THICK * 2, WALL_THICK); // front
  addWall(bounds.minX - WALL_THICK / 2, cz, WALL_THICK, depth);                  // left
  addWall(bounds.maxX + WALL_THICK / 2, cz, WALL_THICK, depth);                  // right

  // Interior obstacle walls
  h.walls.forEach((w) => addWall(w.x, w.z, w.w, w.d));

  // Cup (a dark disc) + flag
  const cup = BABYLON.MeshBuilder.CreateDisc("cup", { radius: HOLE_RADIUS, tessellation: 24 }, scene);
  cup.rotation.x = Math.PI / 2;
  cup.position.set(cupCenter.x, 0.02, cupCenter.z);
  cup.material = cupMat;
  courseMeshes.push(cup);

  const pole = BABYLON.MeshBuilder.CreateCylinder("pole", { height: 3, diameter: 0.08 }, scene);
  pole.position.set(cupCenter.x, 1.5, cupCenter.z);
  pole.material = wallMat;
  courseMeshes.push(pole);

  const flag = BABYLON.MeshBuilder.CreatePlane("flag", { width: 1, height: 0.6 }, scene);
  flag.position.set(cupCenter.x + 0.5, 2.6, cupCenter.z);
  flag.material = flagMat;
  flag.rotation.y = Math.PI / 2;
  courseMeshes.push(flag);

  // Place ball on the tee
  ball.position.set(h.tee.x, BALL_RADIUS, h.tee.z);
  ballVel.x = 0;
  ballVel.z = 0;
  ballMoving = false;
  holeComplete = false;

  // Aim camera at the middle of the playable area
  camera.setTarget(new BABYLON.Vector3(cx, 0, cz));

  // Update HUD
  document.getElementById("hole").textContent = String(index + 1);
  document.getElementById("par").textContent = String(h.par);
}

function addWall(x, z, w, d) {
  const wall = BABYLON.MeshBuilder.CreateBox("wall", { width: w, height: WALL_HEIGHT, depth: d }, scene);
  wall.position.set(x, WALL_HEIGHT / 2, z);
  wall.material = wallMat;
  wall.receiveShadows = true;
  shadowGen.addShadowCaster(wall);
  courseMeshes.push(wall);
  // store AABB (in XZ) expanded later by ball radius during collision test
  walls.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

// ---------------------------------------------------------------------------
// Physics step (custom, runs each render frame)
// ---------------------------------------------------------------------------
function updateBall() {
  if (!ballMoving || holeComplete) return;

  let nx = ball.position.x + ballVel.x;
  let nz = ball.position.z + ballVel.z;

  // Perimeter bounce
  const minX = bounds.minX + BALL_RADIUS;
  const maxX = bounds.maxX - BALL_RADIUS;
  const minZ = bounds.minZ + BALL_RADIUS;
  const maxZ = bounds.maxZ - BALL_RADIUS;

  if (nx < minX) { nx = minX; ballVel.x *= -0.7; }
  if (nx > maxX) { nx = maxX; ballVel.x *= -0.7; }
  if (nz < minZ) { nz = minZ; ballVel.z *= -0.7; }
  if (nz > maxZ) { nz = maxZ; ballVel.z *= -0.7; }

  // Interior wall collisions (AABB vs circle, axis-resolved)
  for (const w of walls) {
    // skip the perimeter-derived large walls outside bounds; they won't be hit
    const exMinX = w.minX - BALL_RADIUS;
    const exMaxX = w.maxX + BALL_RADIUS;
    const exMinZ = w.minZ - BALL_RADIUS;
    const exMaxZ = w.maxZ + BALL_RADIUS;
    if (nx > exMinX && nx < exMaxX && nz > exMinZ && nz < exMaxZ) {
      // Resolve along the axis of least penetration
      const overlapX = Math.min(nx - exMinX, exMaxX - nx);
      const overlapZ = Math.min(nz - exMinZ, exMaxZ - nz);
      if (overlapX < overlapZ) {
        nx = nx < (w.minX + w.maxX) / 2 ? exMinX : exMaxX;
        ballVel.x *= -0.7;
      } else {
        nz = nz < (w.minZ + w.maxZ) / 2 ? exMinZ : exMaxZ;
        ballVel.z *= -0.7;
      }
    }
  }

  ball.position.x = nx;
  ball.position.z = nz;

  // Friction
  ballVel.x *= FRICTION;
  ballVel.z *= FRICTION;

  // Cup capture: if near the hole and slow enough, sink it
  const dx = ball.position.x - cupCenter.x;
  const dz = ball.position.z - cupCenter.z;
  const distToCup = Math.sqrt(dx * dx + dz * dz);
  const speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.z * ballVel.z);

  if (distToCup < HOLE_RADIUS && speed < MAX_POWER * 0.6) {
    sinkBall();
    return;
  }

  // Stop when slow
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

  // little drop animation into the cup
  const anim = new BABYLON.Animation(
    "drop", "position.y", 30,
    BABYLON.Animation.ANIMATIONTYPE_FLOAT,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  anim.setKeys([
    { frame: 0, value: BALL_RADIUS },
    { frame: 12, value: -BALL_RADIUS },
  ]);
  ball.animations = [anim];
  scene.beginAnimation(ball, 0, 12, false, 1, () => showHoleComplete());
}

// ---------------------------------------------------------------------------
// Aiming + input
// ---------------------------------------------------------------------------
let isAiming = false;
let aimStart = null; // ground point where drag began (near ball)

function groundPointFromPointer() {
  const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.name === "ground");
  if (pick && pick.hit) return pick.pickedPoint;
  // fallback: intersect with y=0 plane
  const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
  const t = -ray.origin.y / ray.direction.y;
  return ray.origin.add(ray.direction.scale(t));
}

function updateAimLine(from, to) {
  if (aimLine) {
    aimLine.dispose();
    aimLine = null;
  }
  if (!from || !to) return;
  aimLine = BABYLON.MeshBuilder.CreateLines("aim", {
    points: [
      new BABYLON.Vector3(from.x, 0.1, from.z),
      new BABYLON.Vector3(to.x, 0.1, to.z),
    ],
  }, scene);
  aimLine.color = new BABYLON.Color3(1, 1, 0.3);
}

scene.onPointerObservable.add((info) => {
  if (holeComplete || ballMoving) return;

  if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
    const p = groundPointFromPointer();
    if (!p) return;
    const dx = p.x - ball.position.x;
    const dz = p.z - ball.position.z;
    // Only start aiming if the click is reasonably near the ball
    if (Math.sqrt(dx * dx + dz * dz) < 4) {
      isAiming = true;
      aimStart = { x: ball.position.x, z: ball.position.z };
      camera.detachControl();
    }
  } else if (info.type === BABYLON.PointerEventTypes.POINTERMOVE && isAiming) {
    const p = groundPointFromPointer();
    if (p) {
      // aim shows opposite of drag (pull back to shoot forward, slingshot style)
      const aimEnd = { x: ball.position.x - (p.x - aimStart.x), z: ball.position.z - (p.z - aimStart.z) };
      updateAimLine(ball.position, aimEnd);
    }
  } else if (info.type === BABYLON.PointerEventTypes.POINTERUP && isAiming) {
    isAiming = false;
    camera.attachControl(canvas, true);
    const p = groundPointFromPointer();
    updateAimLine(null, null);
    if (!p) return;

    // Drag vector -> launch impulse (slingshot: pull back to shoot forward)
    let vx = -(p.x - aimStart.x);
    let vz = -(p.z - aimStart.z);
    const len = Math.sqrt(vx * vx + vz * vz);
    if (len < 0.3) return; // tiny drag, ignore

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
// Hole complete / progression
// ---------------------------------------------------------------------------
function showHoleComplete() {
  const h = HOLES[currentHole];
  const msg = document.getElementById("message");
  const title = document.getElementById("msg-title");
  const body = document.getElementById("msg-body");
  const btn = document.getElementById("msg-btn");

  const diff = strokes - h.par;
  let term = "Par";
  if (strokes === 1) term = "Hole in one!";
  else if (diff <= -2) term = "Eagle!";
  else if (diff === -1) term = "Birdie!";
  else if (diff === 1) term = "Bogey";
  else if (diff >= 2) term = "+" + diff;

  title.textContent = term;
  body.textContent = `You finished hole ${currentHole + 1} in ${strokes} stroke${strokes === 1 ? "" : "s"} (par ${h.par}).`;

  const isLast = currentHole === HOLES.length - 1;
  btn.textContent = isLast ? "Play Again" : "Next Hole";
  msg.classList.remove("hidden");

  btn.onclick = () => {
    msg.classList.add("hidden");
    if (isLast) {
      currentHole = 0;
    } else {
      currentHole += 1;
    }
    strokes = 0;
    document.getElementById("strokes").textContent = "0";
    buildHole(currentHole);
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildHole(currentHole);

scene.onBeforeRenderObservable.add(updateBall);

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
