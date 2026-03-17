// ============================================================
//  blockTower.js  —  Block Tower game mode
//  Usage:
//    import { start, stop } from './blockTower.js';
//    start(canvasElement, onExitCallback);   // launch the game
//    stop();                                 // clean up & exit
// ============================================================

const BG           = '#0d0d0d';
const BLOCK_FILL   = '#161616';
const BLOCK_BORDER = '#2a2a2a';
const BLOCK_SHINE  = '#ffffff';
const ACCENT       = '#3ecfb2';
const GROUND_Y     = 100000;

let canvas, ctx, container;
let BS, COLS, W, H, PLAYER_W, PLAYER_H;
let state;
let lowestCamera;
let animFrameId   = null;
let boundKeyDown  = null;
let boundKeyUp    = null;
let onExitCb      = null;
let onScoreCb     = null;

// ── HUD elements created dynamically ─────────────────────────
let hudEl, hudScoreEl, hudHeightEl, hudLevelEl, overlayEl;

function createHUD() {
  // Wrapper that sits around the canvas
  container.style.position = 'relative';
  container.style.background = BG;
  container.style.display    = 'flex';
  container.style.flexDirection = 'column';
  container.style.fontFamily = "'Courier New', monospace";

  // HUD bar
  hudEl = document.createElement('div');
  hudEl.style.cssText = `
    display:flex; justify-content:space-between; align-items:center;
    padding:12px 28px; background:${BG}; border-bottom:1px solid #1a1a1a;
    flex-shrink:0;
  `;

  hudScoreEl = document.createElement('span');
  hudScoreEl.style.cssText = `font-size:20px;font-weight:700;letter-spacing:4px;color:#fff;`;
  hudScoreEl.textContent = '000000';

  const right = document.createElement('div');
  right.style.cssText = 'display:flex;gap:24px;align-items:center;';

  hudHeightEl = document.createElement('span');
  hudHeightEl.style.cssText = 'font-size:11px;letter-spacing:2px;color:#444;text-transform:uppercase;';
  hudHeightEl.textContent = 'HEIGHT 0';

  hudLevelEl = document.createElement('span');
  hudLevelEl.style.cssText = `font-size:11px;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;`;
  hudLevelEl.textContent = 'LV 1';

  right.appendChild(hudHeightEl);
  right.appendChild(hudLevelEl);
  hudEl.appendChild(hudScoreEl);
  hudEl.appendChild(right);
  container.appendChild(hudEl);

  // Canvas wrapper
  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;flex:1;overflow:hidden;';
  canvasWrap.appendChild(canvas);
  container.appendChild(canvasWrap);

  canvas.style.width  = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  // Overlay
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = `
    position:absolute;top:0;left:0;width:100%;height:100%;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(13,13,13,0.93);font-family:'Courier New',monospace;
  `;
  showStartOverlay();
  canvasWrap.appendChild(overlayEl);
}

function removeHUD() {
  if (hudEl    && hudEl.parentNode)    hudEl.parentNode.removeChild(hudEl);
  if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
}

function showStartOverlay() {
  overlayEl.style.display = 'flex';
  overlayEl.innerHTML = `
    <h2 style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#fff;margin:0 0 18px;">Block Tower</h2>
    <p style="font-size:11px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:32px;">Climb. Survive. Don't fall.</p>
    <button id="bt-start" style="${btnStyle()}">Press Start</button>
    <p style="font-size:11px;letter-spacing:2px;color:#2a2a2a;text-transform:uppercase;margin-top:22px;">
      A / D &nbsp;or&nbsp; ← → &nbsp;to move &nbsp;·&nbsp; Space to jump
    </p>
  `;
  overlayEl.querySelector('#bt-start').addEventListener('click', startGame);
}

function showGameOverOverlay(reason) {
  const hs = state.highScore;
  overlayEl.style.display = 'flex';
  overlayEl.innerHTML = `
    <h2 style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#fff;margin:0 0 18px;">
      ${reason === 'VOID' ? 'Into the void' : 'Crushed'}
    </h2>
    <div style="font-size:48px;font-weight:700;letter-spacing:6px;color:#fff;margin-bottom:6px;">${pad(state.score, 6)}</div>
    <div style="font-size:11px;letter-spacing:3px;color:#333;text-transform:uppercase;margin-bottom:24px;">Score</div>
    ${state.score >= hs && state.score > 0
      ? `<div style="font-size:11px;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;margin-bottom:24px;">NEW BEST</div>`
      : `<div style="font-size:11px;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;margin-bottom:24px;">BEST &nbsp; ${pad(hs, 6)}</div>`
    }
    <div style="display:flex;gap:12px;">
      <button id="bt-restart" style="${btnStyle()}">Play Again</button>
      <button id="bt-exit"    style="${btnStyle()}">Exit</button>
    </div>
    <p style="font-size:11px;letter-spacing:2px;color:#2a2a2a;text-transform:uppercase;margin-top:22px;">
      Height: ${Math.max(0, Math.round((GROUND_Y - state.player.y) / BS))} blocks
    </p>
  `;
  overlayEl.querySelector('#bt-restart').addEventListener('click', startGame);
  overlayEl.querySelector('#bt-exit').addEventListener('click', () => {
    stop();
    if (typeof onExitCb === 'function') onExitCb();
  });
}

function btnStyle() {
  return `background:transparent;border:1px solid #333;color:#fff;
    font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;
    text-transform:uppercase;padding:12px 40px;cursor:pointer;border-radius:6px;`;
}

// ── Helpers ───────────────────────────────────────────────────
function pad(n, len) { return String(Math.floor(n)).padStart(len, '0'); }
function colCenterX(col) { return col * BS + BS / 2 - PLAYER_W / 2; }
function getPlayerCol(x) { return Math.round((x + PLAYER_W / 2 - BS / 2) / BS); }

function resize() {
  const rect = canvas.getBoundingClientRect();
  W = Math.floor(rect.width  || canvas.clientWidth  || 800);
  H = Math.floor(rect.height || canvas.clientHeight || 600);
  canvas.width  = W;
  canvas.height = H;
  BS      = Math.max(28, Math.floor(W / 18));
  COLS    = Math.floor(W / BS);
  PLAYER_W = Math.round(BS * 0.44);
  PLAYER_H = Math.round(BS * 0.6);
}

function cameraForY(playerFootY) {
  const byPlayer    = playerFootY - H * 0.72;
  const byBelowRows = playerFootY + BS * 3.5 - H;
  return Math.max(byPlayer, byBelowRows);
}

// ── Difficulty ────────────────────────────────────────────────
function getLevel()          { return Math.floor(state.time / 900) + 1; }
function getSpawnInterval()  { return Math.max(55, 180 - (getLevel() - 1) * 12); }
function getBlocksPerSpawn() { return Math.min(Math.floor(COLS * 0.4), 1 + Math.floor((getLevel() - 1) / 3)); }
function getBlockSpeed()     { return Math.min(4.0, 1.0 + (getLevel() - 1) * 0.18); }

// ── State ─────────────────────────────────────────────────────
function initState() {
  resize();
  const groundBlocks = [];
  for (let i = 0; i < COLS; i++) {
    groundBlocks.push({ x: i * BS, y: GROUND_Y, w: BS, h: BS, settled: true });
  }
  const startCam = GROUND_Y - H + BS * 5;
  lowestCamera = startCam;
  return {
    running: false, dead: false,
    score: 0, time: 0,
    camera: startCam,
    targetCamera: startCam,
    player: {
      x: Math.floor(COLS / 2) * BS + BS / 2 - PLAYER_W / 2,
      y: GROUND_Y - PLAYER_H,
      vx: 0, vy: 0,
      onGround: false, wasOnGround: false,
      touchingWall: false,
      jumpsLeft: 1,
      snapX: null,
    },
    blocks: groundBlocks,
    fallingBlocks: [],
    spawnTimer: 0,
    keys: {},
    highScore: state ? state.highScore : 0,
    lastReportedScore: -1,
  };
}

function spawnBlock() {
  const count = getBlocksPerSpawn();
  const cols  = new Set();
  while (cols.size < count) cols.add(Math.floor(Math.random() * COLS));
  cols.forEach(col => {
    state.fallingBlocks.push({
      x: col * BS, y: state.camera - BS * 2,
      w: BS, h: BS, vy: getBlockSpeed(), settled: false,
    });
  });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Collision ─────────────────────────────────────────────────
function resolveSettled(p) {
  for (const b of state.blocks) {
    if (!b.settled) continue;
    if (!rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H, b.x, b.y, b.w, b.h)) continue;
    const oB = (p.y + PLAYER_H) - b.y;
    const oT = (b.y + b.h) - p.y;
    const oL = (p.x + PLAYER_W) - b.x;
    const oR = (b.x + b.w) - p.x;
    const mn = Math.min(oB, oT, oL, oR);
    if      (mn === oB && p.vy >= 0) { p.y = b.y - PLAYER_H; p.vy = 0; p.onGround = true; p.jumpsLeft = 1; }
    else if (mn === oT && p.vy < 0)  { p.y = b.y + b.h; p.vy = 1; }
    else if (mn === oL)              { p.x = b.x - PLAYER_W; p.vx = 0; if (!p.onGround) p.touchingWall = true; }
    else if (mn === oR)              { p.x = b.x + b.w;      p.vx = 0; if (!p.onGround) p.touchingWall = true; }
  }
}

// Returns true if player was killed
function resolveFalling(p) {
  for (const fb of state.fallingBlocks) {
    if (!rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H, fb.x, fb.y, fb.w, fb.h)) continue;
    const oB = (p.y + PLAYER_H) - fb.y;
    const oT = (fb.y + fb.h) - p.y;
    const oL = (p.x + PLAYER_W) - fb.x;
    const oR = (fb.x + fb.w) - p.x;
    const mn = Math.min(oB, oT, oL, oR);
    if      (mn === oB && p.vy >= 0) { p.y = fb.y - PLAYER_H; p.vy = fb.vy; p.onGround = true; p.jumpsLeft = 1; }
    else if (mn === oT && p.vy < 0)  { die('CRUSHED'); return true; }
    else if (mn === oL)              { p.x = fb.x - PLAYER_W; p.vx = 0; if (!p.onGround) p.touchingWall = true; }
    else if (mn === oR)              { p.x = fb.x + fb.w;     p.vx = 0; if (!p.onGround) p.touchingWall = true; }
  }
  return false;
}

function checkVoidDeath() {
  const p = state.player;
  if (p.onGround || p.vy <= 0) return false;
  if (p.y > lowestCamera + H + 80) return true;
  for (const b of state.blocks) {
    if (!b.settled) continue;
    if (b.y > p.y && b.y < p.y + H * 1.2 &&
        b.x + b.w > p.x + 2 && b.x < p.x + PLAYER_W - 2) return false;
  }
  if (p.y > lowestCamera + H * 0.88) return true;
  return false;
}

// ── Update ────────────────────────────────────────────────────
function update() {
  if (!state.running || state.dead) return;
  state.time++;

  const p       = state.player;
  const speed   = BS * 0.092;
  const gravity = BS * 0.004;
  const SNAP    = BS * 0.13;

  const goLeft  = state.keys['ArrowLeft']  || state.keys['a'] || state.keys['A'];
  const goRight = state.keys['ArrowRight'] || state.keys['d'] || state.keys['D'];

  if (goLeft)       { p.vx = -speed; p.snapX = null; }
  else if (goRight) { p.vx =  speed; p.snapX = null; }
  else {
    if (p.snapX === null) p.snapX = Math.max(0, Math.min(COLS - 1, getPlayerCol(p.x)));
    const tx = colCenterX(p.snapX);
    const dx = tx - p.x;
    if (Math.abs(dx) < 0.8) { p.x = tx; p.vx = 0; }
    else p.vx = Math.sign(dx) * Math.min(SNAP, Math.abs(dx));
  }

  p.wasOnGround  = p.onGround;
  p.onGround     = false;
  p.touchingWall = false;

  p.vy += gravity;
  p.x  += p.vx;
  p.y  += p.vy;
  p.x = Math.max(0, Math.min(W - PLAYER_W, p.x));

  resolveSettled(p);
  if (state.dead) return;
  if (resolveFalling(p)) return;

  // Camera — only update on landing, never scroll down
  if (p.onGround && !p.wasOnGround) {
    const newTarget = cameraForY(p.y + PLAYER_H);
    if (newTarget < state.targetCamera) state.targetCamera = newTarget;
  }
  const newCam = state.camera + (state.targetCamera - state.camera) * 0.07;
  state.camera = Math.min(state.camera, newCam);
  lowestCamera = Math.min(lowestCamera, state.camera);

  // Spawn
  state.spawnTimer++;
  if (state.spawnTimer >= getSpawnInterval()) { spawnBlock(); state.spawnTimer = 0; }

  // Settle falling blocks
  for (let i = state.fallingBlocks.length - 1; i >= 0; i--) {
    const fb = state.fallingBlocks[i];
    fb.y += fb.vy;
    let landed = false, landY = GROUND_Y + BS;
    for (const b of state.blocks) {
      if (!b.settled) continue;
      const xOv = fb.x + fb.w > b.x + 2 && fb.x < b.x + b.w - 2;
      if (xOv && fb.y + fb.h >= b.y && fb.y + fb.h <= b.y + b.h + fb.vy + 2) {
        if (b.y - fb.h < landY) { landY = b.y - fb.h; landed = true; }
      }
    }
    if (landed) {
      fb.y = landY; fb.settled = true;
      state.blocks.push({ x: fb.x, y: fb.y, w: fb.w, h: fb.h, settled: true });
      state.fallingBlocks.splice(i, 1);
    } else if (fb.y > state.camera + H + BS * 2) {
      state.fallingBlocks.splice(i, 1);
    }
  }

  state.blocks = state.blocks.filter(b => b.y < state.camera + H + BS * 5);
  if (checkVoidDeath()) { die('VOID'); return; }

  state.score = Math.floor(state.time / 6);
  if (state.score > state.highScore) state.highScore = state.score;

  if (onScoreCb && state.score !== state.lastReportedScore) {
    state.lastReportedScore = state.score;
    onScoreCb(state.score, state.highScore);
  }

  hudScoreEl.textContent  = pad(state.score, 6);
  hudHeightEl.textContent = 'HEIGHT ' + Math.max(0, Math.round((GROUND_Y - (p.y + PLAYER_H)) / BS));
  hudLevelEl.textContent  = 'LV ' + getLevel();
}

// ── Draw ──────────────────────────────────────────────────────
function drawBlock(x, y, w, h) {
  ctx.fillStyle = BLOCK_FILL;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = BLOCK_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.fillStyle = BLOCK_SHINE;
  ctx.globalAlpha = 0.04;
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const cam = Math.round(state.camera);

  ctx.strokeStyle = 'rgba(255,255,255,0.015)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += BS) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = Math.floor(cam / BS) * BS; gy < cam + H; gy += BS) {
    ctx.beginPath(); ctx.moveTo(0, gy - cam); ctx.lineTo(W, gy - cam); ctx.stroke();
  }

  for (const b of state.blocks) {
    const sy = b.y - cam;
    if (sy > H + BS || sy < -BS * 2) continue;
    drawBlock(b.x, sy, b.w, b.h);
  }

  for (const fb of state.fallingBlocks) {
    const sy = fb.y - cam;
    if (sy > H + BS || sy < -BS * 4) continue;
    drawBlock(fb.x, sy, fb.w, fb.h);
    ctx.strokeStyle = 'rgba(255,68,85,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(fb.x + fb.w / 2, Math.max(0, sy));
    ctx.lineTo(fb.x + fb.w / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const p  = state.player;
  const px = Math.round(p.x);
  const py = Math.round(p.y - cam);

  // Shadow
  ctx.fillStyle = 'rgba(62,207,178,0.06)';
  ctx.fillRect(px - 2, py + PLAYER_H, PLAYER_W + 4, 3);

  // Body
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px, py, PLAYER_W, PLAYER_H);

  // Face
  ctx.fillStyle = BG;
  const ew = Math.max(3, Math.round(PLAYER_W * 0.22));
  const eh = Math.max(3, Math.round(PLAYER_H * 0.18));
  ctx.fillRect(px + Math.round(PLAYER_W * 0.17), py + Math.round(PLAYER_H * 0.22), ew, eh);
  ctx.fillRect(px + Math.round(PLAYER_W * 0.61), py + Math.round(PLAYER_H * 0.22), ew, eh);
  ctx.fillRect(px + Math.round(PLAYER_W * 0.20), py + Math.round(PLAYER_H * 0.58), Math.round(PLAYER_W * 0.6), Math.round(PLAYER_H * 0.12));

  // Legs
  ctx.fillStyle = '#aaa';
  const legW = Math.round(PLAYER_W * 0.28);
  const legH = Math.round(BS * 0.14);
  ctx.fillRect(px,                    py + PLAYER_H, legW, legH);
  ctx.fillRect(px + PLAYER_W - legW, py + PLAYER_H, legW, legH);

  // Teal crown
  ctx.fillStyle = ACCENT;
  ctx.fillRect(px, py, PLAYER_W, 2);

  // Void warning
  if (!p.onGround && p.vy > 2) {
    const hasBelow = state.blocks.some(b =>
      b.settled && b.y > p.y && b.x + b.w > p.x + 2 && b.x < p.x + PLAYER_W - 2 && b.y < p.y + H
    );
    if (!hasBelow) {
      const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
      grad.addColorStop(0, 'rgba(255,40,60,0)');
      grad.addColorStop(1, 'rgba(255,40,60,0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  if (getLevel() > 1) {
    ctx.fillStyle = ACCENT;
    ctx.font = '10px "Courier New"';
    ctx.fillText(`${getBlocksPerSpawn()} BLOCKS / DROP`, W - 130, 20);
  }
}

// ── Loop ──────────────────────────────────────────────────────
function loop() {
  update();
  draw();
  animFrameId = requestAnimationFrame(loop);
}

// ── Game flow ─────────────────────────────────────────────────
function startGame() {
  const hs = state ? state.highScore : 0;
  state = initState();
  state.highScore = hs;
  state.running = true;
  overlayEl.style.display = 'none';
}

function die(reason) {
  if (state.dead) return;
  state.dead = true;
  state.running = false;
  showGameOverOverlay(reason);
}

// ── Public API ────────────────────────────────────────────────

/**
 * start(canvasElement, onExit)
 *   canvasElement — the <canvas> you want the game to render into
 *   onExit        — callback fired when the player clicks "Exit"
 */
export function start(canvasElement, onExit) {
  canvas    = canvasElement;
  ctx       = canvas.getContext('2d');
  container = canvas.parentElement;
  if (onExit && typeof onExit === 'object') {
    onExitCb = onExit.onExit || null;
    onScoreCb = onExit.onScore || null;
  } else {
    onExitCb  = onExit || null;
    onScoreCb = null;
  }

  state = null;
  createHUD();

  state = initState();

  // Keyboard
  boundKeyDown = (e) => {
    state.keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && state.running) {
      const p = state.player;
      if (p.onGround) {
        p.vy = -(BS * 0.245); p.jumpsLeft = 0; p.onGround = false;
      } else if (p.jumpsLeft > 0 && !p.touchingWall) {
        p.vy = -(BS * 0.245); p.jumpsLeft--;
      }
      e.preventDefault();
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
  };

  boundKeyUp = (e) => {
    state.keys[e.key] = false;
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) {
      state.player.snapX = null;
    }
  };

  document.addEventListener('keydown', boundKeyDown);
  document.addEventListener('keyup',   boundKeyUp);

  window.addEventListener('resize', onResize);

  // Touch controls
  canvas.addEventListener('touchstart',  onTouchStart, { passive: true });
  canvas.addEventListener('touchmove',   onTouchMove,  { passive: true });
  canvas.addEventListener('touchend',    onTouchEnd,   { passive: true });

  animFrameId = requestAnimationFrame(loop);
}

/**
 * stop()
 *   Cancels the animation loop and removes all event listeners.
 *   Call this before navigating away from the game mode.
 */
export function stop() {
  cancelAnimationFrame(animFrameId);
  animFrameId = null;

  document.removeEventListener('keydown', boundKeyDown);
  document.removeEventListener('keyup',   boundKeyUp);
  window.removeEventListener('resize',    onResize);

  canvas.removeEventListener('touchstart', onTouchStart);
  canvas.removeEventListener('touchmove',  onTouchMove);
  canvas.removeEventListener('touchend',   onTouchEnd);

  removeHUD();

  boundKeyDown = null;
  boundKeyUp   = null;
  onScoreCb    = null;
}

// ── Event handlers ────────────────────────────────────────────
function onResize() {
  if (state && state.running) resize();
}

let touchStartX = null, touchStartY = null;

function onTouchStart(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}

function onTouchMove(e) {
  if (touchStartX === null) return;
  const dx = e.touches[0].clientX - touchStartX;
  if (dx < -12)     { state.keys['ArrowLeft'] = true;  state.keys['ArrowRight'] = false; }
  else if (dx > 12) { state.keys['ArrowRight'] = true; state.keys['ArrowLeft']  = false; }
  else              { state.keys['ArrowLeft']  = false; state.keys['ArrowRight'] = false; }
}

function onTouchEnd(e) {
  state.keys['ArrowLeft']  = false;
  state.keys['ArrowRight'] = false;
  state.player.snapX = null;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dy) < 15) {
    const p = state.player;
    if (p.onGround) {
      p.vy = -(BS * 0.245); p.jumpsLeft = 0; p.onGround = false;
    } else if (p.jumpsLeft > 0 && !p.touchingWall) {
      p.vy = -(BS * 0.245); p.jumpsLeft--;
    }
  }
  touchStartX = null;
  touchStartY = null;
}
