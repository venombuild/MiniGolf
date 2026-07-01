"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const playBtn = document.getElementById("play-btn");
const leftBtn = document.getElementById("left-btn");
const rightBtn = document.getElementById("right-btn");

const PLAYER_WIDTH = 54;
const PLAYER_HEIGHT = 18;
const PLAYER_Y_OFFSET = 72;
const PLAYER_SPEED = 420;
const SPAWN_INTERVAL = 0.85;
const BEST_KEY = "neon-dodge-best";

let width = 0;
let height = 0;
let dpr = 1;
let running = false;
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let elapsed = 0;
let spawnTimer = 0;
let moveDir = 0;

const player = { x: 0, y: 0 };
const obstacles = [];
const stars = [];

bestEl.textContent = String(best);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  player.y = height - PLAYER_Y_OFFSET;
  if (!running) player.x = width / 2;
}

function resetGame() {
  score = 0;
  elapsed = 0;
  spawnTimer = 0;
  obstacles.length = 0;
  player.x = width / 2;
  scoreEl.textContent = "0";
}

function seedStars() {
  stars.length = 0;
  for (let i = 0; i < 40; i += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 30 + 12,
    });
  }
}

function spawnObstacle() {
  const size = 28 + Math.random() * 34;
  obstacles.push({
    x: size / 2 + Math.random() * (width - size),
    y: -size,
    size,
    speed: 140 + Math.random() * 120 + elapsed * 8,
    hue: Math.random() > 0.5 ? 190 : 320,
  });
}

function drawBackground(dt) {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    star.y += (star.speed * dt) / height;
    if (star.y > 1) {
      star.y = 0;
      star.x = Math.random();
    }
    ctx.fillStyle = "rgba(220, 235, 255, 0.7)";
    ctx.fillRect(star.x * width, star.y * height, star.size, star.size);
  }

  const glow = ctx.createLinearGradient(0, 0, 0, height);
  glow.addColorStop(0, "rgba(92, 240, 255, 0.08)");
  glow.addColorStop(1, "rgba(255, 92, 168, 0.05)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawPlayer() {
  const x = player.x - PLAYER_WIDTH / 2;
  const y = player.y - PLAYER_HEIGHT / 2;

  ctx.save();
  ctx.shadowColor = "#5cf0ff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#5cf0ff";
  ctx.beginPath();
  ctx.roundRect(x, y, PLAYER_WIDTH, PLAYER_HEIGHT, 8);
  ctx.fill();

  ctx.fillStyle = "#041018";
  ctx.beginPath();
  ctx.moveTo(player.x, y - 10);
  ctx.lineTo(player.x - 10, y + 2);
  ctx.lineTo(player.x + 10, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObstacle(obstacle) {
  ctx.save();
  ctx.shadowColor = `hsl(${obstacle.hue}, 90%, 60%)`;
  ctx.shadowBlur = 14;
  ctx.fillStyle = `hsl(${obstacle.hue}, 85%, 58%)`;
  ctx.beginPath();
  ctx.roundRect(
    obstacle.x - obstacle.size / 2,
    obstacle.y - obstacle.size / 2,
    obstacle.size,
    obstacle.size,
    10
  );
  ctx.fill();
  ctx.restore();
}

function collides(a, b, bSize) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx < PLAYER_WIDTH / 2 + bSize / 2 - 4 && dy < PLAYER_HEIGHT / 2 + bSize / 2 - 2;
}

function endGame() {
  running = false;
  overlay.classList.remove("hidden");
  playBtn.textContent = "Try Again";
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = String(best);
  }
}

function update(dt) {
  elapsed += dt;
  score += dt * 10;
  scoreEl.textContent = String(Math.floor(score));

  player.x += moveDir * PLAYER_SPEED * dt;
  player.x = Math.max(PLAYER_WIDTH / 2, Math.min(width - PLAYER_WIDTH / 2, player.x));

  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0;
    spawnObstacle();
  }

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    obstacle.y += obstacle.speed * dt;
    if (obstacle.y - obstacle.size / 2 > height + 20) {
      obstacles.splice(i, 1);
      continue;
    }
    if (collides(player, obstacle, obstacle.size)) {
      endGame();
      return;
    }
  }
}

function render(dt) {
  drawBackground(dt);
  for (const obstacle of obstacles) drawObstacle(obstacle);
  drawPlayer();
}

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  if (running) update(dt);
  render(dt);
  requestAnimationFrame(loop);
}

function startGame() {
  resetGame();
  running = true;
  overlay.classList.add("hidden");
}

function setMove(dir) {
  moveDir = dir;
}

playBtn.addEventListener("click", startGame);
leftBtn.addEventListener("pointerdown", () => setMove(-1));
rightBtn.addEventListener("pointerdown", () => setMove(1));
leftBtn.addEventListener("pointerup", () => setMove(0));
rightBtn.addEventListener("pointerup", () => setMove(0));
leftBtn.addEventListener("pointerleave", () => setMove(0));
rightBtn.addEventListener("pointerleave", () => setMove(0));
leftBtn.addEventListener("pointercancel", () => setMove(0));
rightBtn.addEventListener("pointercancel", () => setMove(0));

canvas.addEventListener("pointerdown", (event) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  setMove(x < rect.width / 2 ? -1 : 1);
});
canvas.addEventListener("pointerup", () => setMove(0));
canvas.addEventListener("pointerleave", () => setMove(0));
canvas.addEventListener("pointercancel", () => setMove(0));

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "a") setMove(-1);
  if (event.key === "ArrowRight" || event.key === "d") setMove(1);
  if (event.key === " " && !running) startGame();
});
window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "ArrowRight" || event.key === "d") {
    setMove(0);
  }
});

seedStars();
resize();
requestAnimationFrame(loop);
