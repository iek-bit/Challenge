// ============================================================
//  games/missileCommand.js  —  Missile Command game mode
//  Usage:
//    import { start, stop } from './games/missileCommand.js';
//    start(containerElement, onExitCallback);  // launch the game
//    stop();                                   // clean up & exit
//
//  start() creates its own HUD, canvas, overlays inside
//  containerElement. stop() tears everything down cleanly.
// ============================================================

const BG = '#060708', ACCENT = '#3ecfb2';
const MISSILE_SPEED = 0.55, INTERCEPTOR_SPEED = 5.8;
const NUM_CITIES = 6, NUM_LAUNCHERS = 3;

let canvas, ctx, W, H, state, animId = null;
let container, onExitCb;
let onScoreChangeCb = null, onGameOverCb = null;
let hudEl, scoreEl, livesEl, ammoEl, waveEl, pauseBtn;
let overlayEl, pauseOverlayEl;
let boundKeyDown = null, boundResize = null;
let boundMouseLeave = null;
let expIdCounter = 0;

// ── Public API ────────────────────────────────────────────────

export function start(containerElement, options = {}) {
  container = containerElement;
  onExitCb  = typeof options === 'function' ? options : options.onExit || null;
  onScoreChangeCb = typeof options === 'object' ? options.onScoreChange || null : null;
  onGameOverCb = typeof options === 'object' ? options.onGameOver || null : null;
  expIdCounter = 0;
  state = null;

  buildDOM();
  state = initState();
  resize();
  buildLayout();

  boundKeyDown = (e) => {
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') &&
        state && state.running && !state.dead) {
      togglePause();
      e.preventDefault();
    }
  };
  boundResize = () => resize();

  document.addEventListener('keydown', boundKeyDown);
  window.addEventListener('resize', boundResize);

  setCursor(false);
  animId = requestAnimationFrame(loop);
}

export function stop() {
  cancelAnimationFrame(animId);
  animId = null;
  document.removeEventListener('keydown', boundKeyDown);
  window.removeEventListener('resize', boundResize);
  tearDownDOM();
  boundKeyDown = null;
  boundResize  = null;
  boundMouseLeave = null;
  onScoreChangeCb = null;
  onGameOverCb = null;
}

// ── DOM construction ──────────────────────────────────────────

function buildDOM() {
  container.style.position   = 'relative';
  container.style.background = BG;
  container.style.display    = 'flex';
  container.style.flexDirection = 'column';
  container.style.fontFamily = "'Courier New', monospace";
  container.style.overflow   = 'hidden';

  // HUD
  hudEl = document.createElement('div');
  hudEl.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:10px 24px;background:${BG};border-bottom:1px solid #1a1a1a;flex-shrink:0;`;

  scoreEl = document.createElement('span');
  scoreEl.style.cssText = 'font-size:20px;font-weight:700;letter-spacing:4px;color:#fff;';
  scoreEl.textContent = '000000';

  const right = document.createElement('div');
  right.style.cssText = 'display:flex;gap:20px;align-items:center;';

  livesEl = document.createElement('div');
  livesEl.style.cssText = 'display:flex;gap:5px;align-items:center;';

  ammoEl = document.createElement('span');
  ammoEl.style.cssText = 'font-size:11px;letter-spacing:2px;color:#444;text-transform:uppercase;';
  ammoEl.textContent = 'AMMO 30';

  waveEl = document.createElement('span');
  waveEl.style.cssText = `font-size:11px;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;`;
  waveEl.textContent = 'WAVE 1';

  pauseBtn = document.createElement('button');
  pauseBtn.style.cssText = `background:transparent;border:1px solid #2a2a2a;color:#555;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;padding:5px 14px;cursor:pointer;border-radius:5px;display:none;`;
  pauseBtn.textContent = 'PAUSE';
  pauseBtn.addEventListener('click', togglePause);
  pauseBtn.addEventListener('mouseover', () => { pauseBtn.style.borderColor='#555'; pauseBtn.style.color='#aaa'; });
  pauseBtn.addEventListener('mouseout',  () => { pauseBtn.style.borderColor='#2a2a2a'; pauseBtn.style.color='#555'; });

  right.appendChild(livesEl);
  right.appendChild(ammoEl);
  right.appendChild(waveEl);
  right.appendChild(pauseBtn);
  hudEl.appendChild(scoreEl);
  hudEl.appendChild(right);
  container.appendChild(hudEl);

  // Canvas wrapper
  const canvasWrap = document.createElement('div');
  canvasWrap.id = 'mc-canvas-wrap';
  canvasWrap.style.cssText = 'position:relative;flex:1;overflow:hidden;';

  canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  canvas.addEventListener('mousemove', onMouseMove);
  boundMouseLeave = () => { if (state) state.mouse = null; };
  canvas.addEventListener('mouseleave', boundMouseLeave);
  canvas.addEventListener('click', onCanvasClick);
  canvasWrap.appendChild(canvas);
  ctx = canvas.getContext('2d');

  // Start / game-over overlay
  overlayEl = document.createElement('div');
  overlayEl.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(6,7,8,0.93);cursor:default;`;
  showStartOverlay();
  canvasWrap.appendChild(overlayEl);

  // Pause overlay
  pauseOverlayEl = document.createElement('div');
  pauseOverlayEl.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(6,7,8,0.82);cursor:default;`;
  buildPauseOverlay();
  canvasWrap.appendChild(pauseOverlayEl);

  container.appendChild(canvasWrap);
}

function tearDownDOM() {
  if (hudEl        && hudEl.parentNode)        hudEl.parentNode.removeChild(hudEl);
  if (overlayEl    && overlayEl.parentNode)    overlayEl.parentNode.removeChild(overlayEl);
  if (pauseOverlayEl && pauseOverlayEl.parentNode) pauseOverlayEl.parentNode.removeChild(pauseOverlayEl);
  const cw = container.querySelector('#mc-canvas-wrap');
  if (cw) container.removeChild(cw);
  canvas.removeEventListener('mousemove',  onMouseMove);
  canvas.removeEventListener('mouseleave', boundMouseLeave);
  canvas.removeEventListener('click', onCanvasClick);
}

function showStartOverlay() {
  overlayEl.style.display = 'flex';
  overlayEl.innerHTML = `
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#fff;margin-bottom:16px;">Missile Command</div>
    <div style="font-size:11px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:10px;">Defend the cities. Lead your shots.</div>
    <div style="font-size:11px;letter-spacing:2px;color:#222;text-transform:uppercase;margin-bottom:32px;">Interceptors take time to reach their target.</div>
    <button id="mc-start-btn" style="${btnCSS()}">Press Start</button>
    <div style="font-size:11px;letter-spacing:2px;color:#2a2a2a;text-transform:uppercase;margin-top:22px;">Click to fire &nbsp;·&nbsp; Lead your targets</div>
  `;
  overlayEl.querySelector('#mc-start-btn').addEventListener('click', startGame);
}

function buildPauseOverlay() {
  pauseOverlayEl.innerHTML = `
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#fff;margin-bottom:32px;">Paused</div>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
      <button id="mc-resume-btn" style="${btnCSS()}width:200px;">Resume</button>
      <button id="mc-quit-btn"   style="background:transparent;border:1px solid #2a2a2a;color:#555;font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;text-transform:uppercase;padding:12px 40px;cursor:pointer;border-radius:6px;width:200px;">Quit</button>
    </div>
    <div style="font-size:11px;letter-spacing:2px;color:#2a2a2a;text-transform:uppercase;margin-top:22px;">ESC or P to resume</div>
  `;
  pauseOverlayEl.querySelector('#mc-resume-btn').addEventListener('click', togglePause);
  pauseOverlayEl.querySelector('#mc-quit-btn').addEventListener('click', quitToMenu);
}

function btnCSS() {
  return `background:transparent;border:1px solid #333;color:#fff;font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;text-transform:uppercase;padding:12px 40px;cursor:pointer;border-radius:6px;`;
}

// ── Cursor helpers ────────────────────────────────────────────

function setCursor(hide) {
  const val = hide ? 'none' : 'default';
  canvas.style.cursor = val;
  const cw = container.querySelector('#mc-canvas-wrap');
  if (cw) cw.style.cursor = val;
}

// ── Resize ────────────────────────────────────────────────────

function resize() {
  const r = canvas.getBoundingClientRect();
  W = Math.floor(r.width  || canvas.clientWidth  || 800);
  H = Math.floor(r.height || canvas.clientHeight || 600);
  canvas.width  = W;
  canvas.height = H;
  if (state) buildLayout();
}

// ── Layout ────────────────────────────────────────────────────

function waveAmmo(w) { return Math.min(10 + Math.floor(w * 1.5), 25); }

function buildLayout() {
  const ground = H - 40;
  state.ground = ground;
  const cityXs = [0.15, 0.28, 0.41, 0.59, 0.72, 0.85];
  state.cities = cityXs.map((fx, i) => ({
    x: Math.round(fx * W), y: ground - 8,
    alive: state.cities[i] ? state.cities[i].alive : true
  }));
  const lxs = [0.15, 0.5, 0.85];
  state.launchers = lxs.map((fx, i) => ({
    x: Math.round(fx * W), y: ground,
    ammo:    state.launchers[i] ? state.launchers[i].ammo : waveAmmo(state.wave || 1),
    maxAmmo: waveAmmo(state.wave || 1)
  }));
}

// ── State ─────────────────────────────────────────────────────

function initState() {
  return {
    running: false, dead: false, paused: false,
    waveEnding: false, waveEndTimer: 0,
    score: 0, highScore: state ? state.highScore : 0,
    wave: 1,
    cities: [], launchers: [],
    missiles: [], interceptors: [], explosions: [],
    bombers: [], fighters: [],
    ground: H - 40,
    spawnTimer: 0, totalSpawned: 0,
    mouse: null, waveCfg: null, bonusDisplay: null, frameCount: 0,
  };
}

// ── Wave config ───────────────────────────────────────────────

function getWaveCfg(w) {
  return {
    total:       8 + w * 4,
    interval:    Math.max(55, 220 - w * 14),
    maxOnScreen: Math.min(3 + Math.floor(w * 0.8), 14),
    blueFrac:    w >= 4  ? Math.min((w - 3)  * 0.07, 0.40) : 0,
    greenFrac:   w >= 7  ? Math.min((w - 6)  * 0.05, 0.25) : 0,
    numBombers:  w >= 6  ? Math.min(Math.floor((w - 5) * 0.5 + 0.5), 3) : 0,
    blueBombers: w >= 11,
    numFighters: w >= 9  ? Math.min(Math.floor((w - 8) * 0.5 + 0.5), 3) : 0,
    splitChance: Math.min(0.0005, 0.00003 + w * 0.00006),
    maxBends:    Math.min(1 + Math.floor((w - 4) / 3), 3),
    maxBendDeg:  Math.min(18 + (w - 4) * 2, 42),
  };
}

function pickMissileType(cfg) {
  const r = 1 - cfg.blueFrac - cfg.greenFrac, roll = Math.random();
  if (roll < r) return 'red';
  if (roll < r + cfg.blueFrac) return 'blue';
  return 'green';
}

// ── Blue missile path ─────────────────────────────────────────

function toRad(d) { return d * Math.PI / 180; }

function makeBluePath(sx, sy, tx, ty, cfg) {
  const numBends = 1 + Math.floor(Math.random() * cfg.maxBends);
  const minDeg = 8, maxDeg = cfg.maxBendDeg || 18;
  const waypoints = [];
  for (let i = 0; i < numBends; i++) {
    const t  = Math.max(0.1, Math.min(0.9, (i + 1) / (numBends + 1) + (Math.random() - 0.5) * 0.15));
    const lx = sx + (tx - sx) * t, ly = sy + (ty - sy) * t;
    const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len, perpY = dx / len;
    const deg    = minDeg + Math.random() * (maxDeg - minDeg);
    const offset = Math.hypot(tx - lx, ty - ly) * Math.tan(toRad(deg));
    const side   = Math.random() < 0.5 ? 1 : -1;
    waypoints.push({ x: lx + perpX * offset * side, y: ly + perpY * offset * side });
  }
  waypoints.push({ x: tx, y: ty });
  return waypoints;
}

// ── Missile factory ───────────────────────────────────────────

function makeMissile(sx, sy, type, cfg, immuneExpId) {
  const alive = state.cities.filter(c => c.alive);
  if (!alive.length) return null;
  const target = alive[Math.floor(Math.random() * alive.length)];
  const tx = target.x + (Math.random() - 0.5) * 50, ty = state.ground - 12;
  const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
  const spd = MISSILE_SPEED * (0.88 + Math.random() * 0.24);
  if (type === 'blue') {
    const waypoints = makeBluePath(sx, sy, tx, ty, cfg || { maxBends: 1, maxBendDeg: 18 });
    const wp = waypoints[0];
    const dx0 = wp.x - sx, dy0 = wp.y - sy, l0 = Math.hypot(dx0, dy0) || 1;
    return { x: sx, y: sy, vx: dx0/l0*spd, vy: dy0/l0*spd, speed: spd, waypoints, wpIdx: 0, trail: [], split: false, type: 'blue', immuneExpId: immuneExpId || null, immuneExpId2: null };
  }
  return { x: sx, y: sy, tx, ty, vx: dx/len*spd, vy: dy/len*spd, trail: [], split: false, type, immuneExpId: immuneExpId || null, immuneExpId2: null };
}

function spawnMissile(type, cfg, fromX, fromY, immuneExpId) {
  const sx = fromX !== undefined ? fromX : W * 0.05 + Math.random() * W * 0.9;
  const m  = makeMissile(sx, fromY !== undefined ? fromY : 0, type || 'red', cfg, immuneExpId);
  if (m) { state.missiles.push(m); state.totalSpawned++; }
}

// ── Kill missile (handles green split) ───────────────────────

function killMissile(idx, triggerExpId) {
  const m = state.missiles[idx];
  if (m.type === 'green') {
    const popId = addExplosion(m.x, m.y, 28, '#44cc66', 32);
    const alive = state.cities.filter(c => c.alive);
    const count = Math.min(3, Math.max(1, alive.length));
    for (let i = 0; i < count; i++) {
      const t = alive[i % alive.length];
      const dx = t.x - m.x, dy = (state.ground - 12) - m.y, len = Math.hypot(dx, dy) || 1;
      state.missiles.push({
        x: m.x, y: m.y, tx: t.x, ty: state.ground - 12,
        vx: dx/len*MISSILE_SPEED*1.1, vy: dy/len*MISSILE_SPEED*1.1,
        trail: [], split: true, type: 'red',
        immuneExpId: triggerExpId, immuneExpId2: popId,
        spawnFrame: state.frameCount,
      });
      state.totalSpawned++;
    }
  }
  state.missiles.splice(idx, 1);
}

// ── Interceptor ───────────────────────────────────────────────

function fireInterceptor(mx, my) {
  const withAmmo = state.launchers.filter(l => l.ammo > 0);
  if (!withAmmo.length) return;
  const launcher = withAmmo.reduce((a, b) => dist({ x: mx, y: my }, a) < dist({ x: mx, y: my }, b) ? a : b);
  launcher.ammo--;
  const dx = mx - launcher.x, dy = my - launcher.y, len = Math.hypot(dx, dy) || 1;
  state.interceptors.push({
    x: launcher.x, y: launcher.y, tx: mx, ty: my,
    vx: dx/len*INTERCEPTOR_SPEED, vy: dy/len*INTERCEPTOR_SPEED,
    trail: [], totalDist: len, traveled: 0,
  });
  updateHUD();
}

// ── Explosion ─────────────────────────────────────────────────

function addExplosion(x, y, maxR, clr, dur) {
  const id = ++expIdCounter;
  state.explosions.push({ id, x, y, r: 0, maxR, clr: clr || '#ffffff', t: 0, dur: dur || 60, growing: true });
  return id;
}

// ── Bombers ───────────────────────────────────────────────────

function spawnBomber(index, blue) {
  const fromLeft = Math.random() < 0.5, speed = 0.55 + Math.random() * 0.35;
  state.bombers.push({
    x: fromLeft ? -60 : W + 60,
    y: H * (0.30 + index * 0.09 + Math.random() * 0.03),
    vx: (fromLeft ? 1 : -1) * speed, speed,
    fireTimer: Math.floor(Math.random() * 120),
    fireInterval: 170 + Math.floor(Math.random() * 110),
    alive: true, trail: [], blue: !!blue, onScreen: false,
  });
}

// ── Fighters ──────────────────────────────────────────────────

function spawnFighter() {
  const fromLeft = Math.random() < 0.5;
  const alive = state.cities.filter(c => c.alive);
  if (!alive.length) return;
  const target = alive[Math.floor(Math.random() * alive.length)];
  const spd = 1.6 + Math.random() * 0.5;
  state.fighters.push({
    x: fromLeft ? -50 : W + 50, y: H * 0.10,
    speed: spd, diveSpeed: spd * 1.8 + Math.random() * 0.4,
    angle: fromLeft ? 0 : Math.PI,
    vx: fromLeft ? spd : -spd, vy: 0,
    target, phase: 'approach', alive: true,
    dodgeChance: 0.85, dodgeCooldown: 0, trail: [],
    patrolChance: 0.6 + Math.random() * 0.3,
    patrolDecay: 0.45, patrolDir: fromLeft ? 1 : -1,
    patrolPasses: 0, decidedToDive: false,
  });
}

function interceptorThreatens(plane, margin) {
  for (const p of state.interceptors) {
    const steps = Math.ceil(dist(p, { x: p.tx, y: p.ty }) / INTERCEPTOR_SPEED);
    for (let s = 1; s <= Math.min(steps, 55); s++) {
      if (dist({ x: p.x + p.vx*s, y: p.y + p.vy*s }, plane) < margin) return p;
    }
  }
  return null;
}

// ── HUD ───────────────────────────────────────────────────────

function updateHUD() {
  scoreEl.textContent = pad(state.score, 6);
  waveEl.textContent  = 'WAVE ' + state.wave;
  ammoEl.textContent  = 'AMMO ' + state.launchers.reduce((s, l) => s + l.ammo, 0);
  livesEl.innerHTML   = '';
  for (let i = 0; i < NUM_CITIES; i++) {
    const d  = document.createElement('div');
    const on = state.cities[i] && state.cities[i].alive;
    d.style.cssText = `width:14px;height:10px;background:${on?'#fff':'#222'};display:inline-block;border-radius:2px 2px 0 0;`;
    livesEl.appendChild(d);
  }
  if (typeof onScoreChangeCb === 'function') onScoreChangeCb(state.score);
}

// ── Wave transitions ──────────────────────────────────────────

function checkWaveEnd() {
  const cfg = state.waveCfg;
  if (state.totalSpawned >= cfg.total && state.missiles.length === 0 &&
      state.interceptors.length === 0 && state.explosions.length === 0 &&
      state.bombers.length === 0 && state.fighters.length === 0) beginWaveEnd();
}

function beginWaveEnd() {
  state.waveEnding = true; state.waveEndTimer = 0;
  const bonus = state.launchers.reduce((s, l) => s + l.ammo, 0) * 5 +
                state.cities.filter(c => c.alive).length * 150;
  state.score += bonus;
  state.bonusDisplay = { text: 'WAVE CLEAR  +' + bonus, timer: 150 };
  updateHUD();
}

function beginNextWave() {
  state.wave++; state.waveEnding = false; state.waveEndTimer = 0;
  state.missiles = []; state.interceptors = []; state.explosions = [];
  state.bombers  = []; state.fighters     = [];
  state.spawnTimer = 0; state.totalSpawned = 0;
  state.waveCfg = getWaveCfg(state.wave);
  const am = waveAmmo(state.wave);
  state.launchers.forEach(l => { l.ammo = am; l.maxAmmo = am; });
  for (let i = 0; i < state.waveCfg.numBombers; i++) {
    const isBlue = state.waveCfg.blueBombers && i === state.waveCfg.numBombers - 1;
    setTimeout(() => { if (state.running && !state.dead) spawnBomber(i, isBlue); }, i * 1500);
  }
  for (let i = 0; i < state.waveCfg.numFighters; i++)
    setTimeout(() => { if (state.running && !state.dead) spawnFighter(); }, 3500 + i * 2500);
  updateHUD();
}

// ── Pause / Quit ──────────────────────────────────────────────

function togglePause() {
  if (!state || !state.running || state.dead || state.waveEnding) return;
  state.paused = !state.paused;
  pauseOverlayEl.style.display = state.paused ? 'flex' : 'none';
  pauseBtn.textContent = state.paused ? 'RESUME' : 'PAUSE';
  setCursor(!state.paused);
}

function quitToMenu() {
  state.paused = false; state.running = false; state.dead = false;
  pauseOverlayEl.style.display = 'none';
  pauseBtn.style.display = 'none';
  setCursor(false);
  overlayEl.style.display = 'flex';
  overlayEl.innerHTML = `
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#fff;margin-bottom:16px;">Missile Command</div>
    <div style="font-size:11px;letter-spacing:2px;color:#444;text-transform:uppercase;margin-bottom:6px;">Score before quitting</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:5px;color:#fff;margin-bottom:24px;">${pad(state.score, 6)}</div>
    <div style="display:flex;gap:12px;">
      <button id="mc-again-btn" style="${btnCSS()}">Play Again</button>
      ${onExitCb ? `<button id="mc-exit-btn" style="background:transparent;border:1px solid #2a2a2a;color:#555;font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;text-transform:uppercase;padding:12px 40px;cursor:pointer;border-radius:6px;">Exit</button>` : ''}
    </div>
    <div style="font-size:11px;letter-spacing:2px;color:#2a2a2a;text-transform:uppercase;margin-top:22px;">Click to fire &nbsp;·&nbsp; Lead your targets</div>
  `;
  overlayEl.querySelector('#mc-again-btn').addEventListener('click', startGame);
  if (onExitCb) {
    overlayEl.querySelector('#mc-exit-btn').addEventListener('click', () => { stop(); onExitCb(); });
  }
}

// ── Explosion tick ────────────────────────────────────────────

function tickExplosions() {
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const e = state.explosions[i]; e.t++;
    if (e.growing) { e.r += e.maxR / 18; if (e.r >= e.maxR) e.growing = false; }
    else e.r -= e.maxR / 22;
    if (e.r <= 0) { state.explosions.splice(i, 1); continue; }
    for (let j = state.missiles.length - 1; j >= 0; j--) {
      const m = state.missiles[j];
      if (m.immuneExpId === e.id || m.immuneExpId2 === e.id) continue;
      if (dist(m, e) < e.r) {
        state.score += m.type === 'green' ? 150 : m.type === 'blue' ? 80 : 50;
        killMissile(j, e.id); updateHUD();
      }
    }
    for (let j = state.bombers.length - 1; j >= 0; j--) {
      if (dist(state.bombers[j], e) < e.r + 22) {
        addExplosion(state.bombers[j].x, state.bombers[j].y, 55, '#ffffff', 70);
        state.score += state.bombers[j].blue ? 350 : 250; updateHUD();
        state.bombers.splice(j, 1);
      }
    }
    for (let j = state.fighters.length - 1; j >= 0; j--) {
      if (dist(state.fighters[j], e) < e.r + 16) {
        addExplosion(state.fighters[j].x, state.fighters[j].y, 50, '#ffffff', 65);
        state.score += 400; updateHUD(); state.fighters.splice(j, 1);
      }
    }
  }
}

// ── Blue steering ─────────────────────────────────────────────

function steerBlue(m) {
  const wp = m.waypoints[m.wpIdx];
  const dx = wp.x - m.x, dy = wp.y - m.y, len = Math.hypot(dx, dy) || 1;
  m.vx += (dx/len*m.speed - m.vx) * 0.04;
  m.vy += (dy/len*m.speed - m.vy) * 0.04;
  const spd = Math.hypot(m.vx, m.vy);
  if (spd > 0) { m.vx = m.vx/spd*m.speed; m.vy = m.vy/spd*m.speed; }
  if (len < 12 && m.wpIdx < m.waypoints.length - 1) m.wpIdx++;
}

// ── Main update ───────────────────────────────────────────────

function update() {
  if (!state.running || state.dead || state.paused) return;
  state.frameCount++;
  if (!state.waveCfg) state.waveCfg = getWaveCfg(state.wave);
  const cfg = state.waveCfg;

  if (state.waveEnding) {
    state.waveEndTimer++;
    if (state.bonusDisplay) state.bonusDisplay.timer--;
    if (state.waveEndTimer > 130) beginNextWave();
    tickExplosions(); return;
  }

  if (state.totalSpawned < cfg.total && state.missiles.length < cfg.maxOnScreen) {
    state.spawnTimer++;
    if (state.spawnTimer >= cfg.interval) { spawnMissile(pickMissileType(cfg), cfg); state.spawnTimer = 0; }
  }

  // Missiles
  for (let i = state.missiles.length - 1; i >= 0; i--) {
    const m = state.missiles[i];
    m.trail.push({ x: m.x, y: m.y }); if (m.trail.length > 35) m.trail.shift();
    if (m.type === 'blue') steerBlue(m);
    m.x += m.vx; m.y += m.vy;
    if (m.type === 'red' && !m.split && m.y > H * 0.25 && m.y < H * 0.6 && Math.random() < cfg.splitChance) {
      m.split = true;
      const alive = state.cities.filter(c => c.alive);
      if (alive.length) {
        const t2 = alive[Math.floor(Math.random() * alive.length)];
        const dx = t2.x - m.x, dy = state.ground - m.y, len = Math.hypot(dx, dy) || 1;
        state.missiles.push({ x: m.x, y: m.y, tx: t2.x, ty: state.ground - 12, vx: dx/len*MISSILE_SPEED, vy: dy/len*MISSILE_SPEED, trail: [], split: true, type: 'red', immuneExpId: null, immuneExpId2: null });
        state.totalSpawned++;
      }
    }
    if (m.y >= state.ground - 12) {
      addExplosion(m.x, state.ground - 12, 48, '#cc3344', 70);
      state.cities.forEach(c => { if (c.alive && dist({ x: m.x, y: state.ground - 12 }, c) < 52) { c.alive = false; addExplosion(c.x, c.y, 36, '#cc3344', 55); } });
      if (m.type === 'green') killMissile(i, null); else state.missiles.splice(i, 1);
      updateHUD();
    }
  }

  // Interceptors
  for (let i = state.interceptors.length - 1; i >= 0; i--) {
    const p = state.interceptors[i];
    p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 14) p.trail.shift();
    p.x += p.vx; p.y += p.vy; p.traveled += INTERCEPTOR_SPEED;
    if (p.traveled >= p.totalDist) { addExplosion(p.tx, p.ty, 70, '#ffffff', 52); state.interceptors.splice(i, 1); }
  }

  // Bombers
  for (let i = state.bombers.length - 1; i >= 0; i--) {
    const b = state.bombers[i];
    b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.shift();
    b.x += b.vx;
    if (b.x > W + 80) b.vx = -b.speed;
    if (b.x < -80)    b.vx =  b.speed;
    if (!b.onScreen && b.x > 0 && b.x < W) b.onScreen = true;
    b.fireTimer++;
    if (b.fireTimer >= b.fireInterval) {
      b.fireTimer = 0;
      const alive = state.cities.filter(c => c.alive);
      if (alive.length) {
        const tc = alive[Math.floor(Math.random() * alive.length)];
        if (b.blue) {
          const m = makeMissile(b.x, b.y, 'blue', cfg);
          if (m) { state.missiles.push(m); state.totalSpawned++; }
        } else {
          const lx = (tc.x - b.x) * 0.1, dy2 = state.ground - b.y, len = Math.hypot(lx, dy2) || 1;
          state.missiles.push({ x: b.x, y: b.y, tx: tc.x, ty: state.ground - 12, vx: lx/len*MISSILE_SPEED*0.15, vy: MISSILE_SPEED, trail: [], split: false, type: 'red', immuneExpId: null, immuneExpId2: null });
          state.totalSpawned++;
        }
      }
    }
    if (b.onScreen && (b.x < -120 || b.x > W + 120)) state.bombers.splice(i, 1);
  }

  // Fighters
  for (let i = state.fighters.length - 1; i >= 0; i--) {
    const f = state.fighters[i];
    if (!f.alive) { state.fighters.splice(i, 1); continue; }
    f.trail.push({ x: f.x, y: f.y }); if (f.trail.length > 18) f.trail.shift();
    if (f.dodgeCooldown > 0) f.dodgeCooldown--;
    let desiredAngle = f.angle;
    const cruiseY = H * 0.10;

    if (f.phase === 'approach') {
      const dx = f.target.x - f.x;
      f.vx += (Math.sign(dx) * f.speed - f.vx) * 0.05;
      f.vy += (cruiseY - f.y) * 0.03;
      desiredAngle = Math.atan2(f.vy, f.vx);
      f.x += f.vx; f.y += f.vy;
      if (!f.target.alive) { const al = state.cities.filter(c => c.alive); if (al.length) f.target = al[Math.floor(Math.random() * al.length)]; else f.phase = 'escape'; }
      if (f.dodgeCooldown === 0) { const threat = interceptorThreatens(f, 60); if (threat && Math.random() < f.dodgeChance) { f.dodgeChance *= 0.55; f.dodgeCooldown = 100; f.vy -= f.speed * 1.4; f.vx += f.vx > 0 ? -1.0 : 1.0; } }
      const overTarget = Math.abs(f.x - f.target.x) < 100 && f.target.alive;
      if (overTarget) {
        if (!f.decidedToDive && Math.random() < f.patrolChance) { f.patrolPasses++; f.patrolChance *= f.patrolDecay; f.patrolDir *= -1; }
        else { f.decidedToDive = true; f.phase = 'dive'; }
      }
      if (!f.decidedToDive && f.target.alive) {
        const pastLeft  = f.x < f.target.x - W * 0.25;
        const pastRight = f.x > f.target.x + W * 0.25;
        if ((pastLeft && f.patrolDir < 0) || (pastRight && f.patrolDir > 0)) f.patrolDir *= -1;
      }
    } else if (f.phase === 'dive') {
      const dx = f.target.x - f.x, dy = f.target.y - 10 - f.y, len = Math.hypot(dx, dy) || 1;
      f.vx += (dx/len*f.diveSpeed - f.vx) * 0.045;
      f.vy += (dy/len*f.diveSpeed - f.vy) * 0.045;
      desiredAngle = Math.atan2(f.vy, f.vx);
      if (f.dodgeCooldown === 0) {
        const threat = interceptorThreatens(f, 55);
        if (threat && Math.random() < f.dodgeChance) {
          f.dodgeChance *= 0.55; f.dodgeCooldown = 120; f.phase = 'dodging';
          f.vy = -f.diveSpeed * 1.8; f.vx *= 0.4;
        } else {
          f.x += f.vx; f.y += f.vy;
          if (dist(f, f.target) < 32 && f.target.alive) { f.target.alive = false; addExplosion(f.target.x, f.target.y, 60, '#cc3344', 80); addExplosion(f.x, f.y, 40, '#ffffff', 55); f.alive = false; state.fighters.splice(i, 1); updateHUD(); continue; }
          if (f.y > state.ground - 20) { addExplosion(f.x, f.y, 30, '#cc3344', 45); f.alive = false; state.fighters.splice(i, 1); continue; }
        }
      } else { f.x += f.vx; f.y += f.vy; }
    } else if (f.phase === 'dodging') {
      f.vy -= 0.28; f.vx *= 0.97; f.x += f.vx; f.y += f.vy;
      desiredAngle = Math.atan2(f.vy, f.vx);
      if (f.y < H * 0.07 || f.dodgeCooldown < 50) { f.vy *= 0.4; f.phase = f.target.alive ? 'approach' : 'escape'; f.decidedToDive = false; }
    } else if (f.phase === 'escape') {
      const dir = f.x < W / 2 ? -1 : 1;
      desiredAngle = dir > 0 ? 0 : Math.PI;
      f.vx += (dir * f.diveSpeed * 1.2 - f.vx) * 0.05; f.vy *= 0.97;
      f.x += f.vx; f.y += f.vy;
      if (f.x < -100 || f.x > W + 100) { f.alive = false; state.fighters.splice(i, 1); continue; }
    }
    f.angle = lerpAngle(f.angle, desiredAngle, 0.055);
    if (f.x < -250 || f.x > W + 250 || f.y > state.ground) { f.alive = false; state.fighters.splice(i, 1); }
  }

  tickExplosions();
  if (state.cities.filter(c => c.alive).length === 0) { die(); return; }
  checkWaveEnd();
  if (state.bonusDisplay && state.bonusDisplay.timer-- <= 0) state.bonusDisplay = null;
}

// ── Draw ──────────────────────────────────────────────────────

function missileColor(type) {
  if (type === 'blue')  return { head: '#4499ff', trail: '66,153,255' };
  if (type === 'green') return { head: '#44cc66', trail: '68,204,102' };
  return { head: '#ee4455', trail: '204,51,68' };
}

function drawFighter(f) {
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
  const s = 11; ctx.fillStyle = '#4488bb';
  ctx.beginPath(); ctx.moveTo(s*1.2,0); ctx.lineTo(-s*0.8,-s*0.5); ctx.lineTo(-s*0.4,0); ctx.lineTo(-s*0.8,s*0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0,-s*0.3); ctx.lineTo(-s*0.5,-s*1.1); ctx.lineTo(-s*1.0,-s*0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBomber(b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.vx >= 0 ? 1 : -1, 1);
  const s = 14; ctx.fillStyle = b.blue ? '#1a2a55' : '#888866';
  ctx.beginPath(); ctx.moveTo(s*1.2,0); ctx.lineTo(-s*0.8,-s*0.5); ctx.lineTo(-s*0.4,0); ctx.lineTo(-s*0.8,s*0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0,-s*0.3); ctx.lineTo(-s*0.5,-s*1.1); ctx.lineTo(-s*1.0,-s*0.3); ctx.closePath(); ctx.fill();
  if (b.blue) {
    ctx.strokeStyle = '#4499ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s*1.2,0); ctx.lineTo(-s*0.8,-s*0.5); ctx.lineTo(-s*0.4,0); ctx.lineTo(-s*0.8,s*0.5); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-s*0.3); ctx.lineTo(-s*0.5,-s*1.1); ctx.lineTo(-s*1.0,-s*0.3); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.012)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, state.ground); ctx.lineTo(W, state.ground); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.fillRect(0, state.ground, W, H - state.ground);

  state.cities.forEach(c => {
    if (!c.alive) { ctx.fillStyle = '#222'; ctx.fillRect(c.x-14, c.y+2, 28, 6); return; }
    ctx.fillStyle = '#fff';
    ctx.fillRect(c.x-14, c.y, 28, 8); ctx.fillRect(c.x-10, c.y-8, 7, 8);
    ctx.fillRect(c.x+3,  c.y-8, 7, 8); ctx.fillRect(c.x-3,  c.y-14, 6, 14);
    ctx.fillStyle = '#060708';
    ctx.fillRect(c.x-8, c.y-6, 3, 4); ctx.fillRect(c.x+5, c.y-6, 3, 4); ctx.fillRect(c.x-2, c.y-12, 4, 5);
  });

  state.launchers.forEach(l => {
    const has = l.ammo > 0;
    ctx.fillStyle = has ? '#2a2a2a' : '#181818'; ctx.fillRect(l.x-18, l.y-6, 36, 6);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5; ctx.strokeRect(l.x-17.5, l.y-5.5, 35, 5);
    ctx.fillStyle = has ? '#444' : '#1e1e1e'; ctx.fillRect(l.x-3, l.y-16, 6, 12);
    const dotW = Math.max(2, Math.min(4, Math.floor(30 / l.maxAmmo)));
    for (let a = 0; a < l.maxAmmo; a++) { ctx.fillStyle = a < l.ammo ? ACCENT : '#1a1a1a'; ctx.fillRect(l.x-15+(a*(dotW+1)), l.y+2, dotW, 3); }
  });

  state.bombers.forEach(b => {
    for (let i = 1; i < b.trail.length; i++) {
      ctx.strokeStyle = `rgba(${b.blue?'60,90,180':'150,150,70'},${(i/b.trail.length)*0.28})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.trail[i-1].x, b.trail[i-1].y); ctx.lineTo(b.trail[i].x, b.trail[i].y); ctx.stroke();
    }
    drawBomber(b);
  });

  state.fighters.forEach(f => {
    for (let i = 1; i < f.trail.length; i++) {
      ctx.strokeStyle = `rgba(80,160,220,${(i/f.trail.length)*0.35})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(f.trail[i-1].x, f.trail[i-1].y); ctx.lineTo(f.trail[i].x, f.trail[i].y); ctx.stroke();
    }
    drawFighter(f);
  });

  state.missiles.forEach(m => {
    const clr = missileColor(m.type);
    for (let i = 1; i < m.trail.length; i++) {
      ctx.strokeStyle = `rgba(${clr.trail},${(i/m.trail.length)*0.55})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(m.trail[i-1].x, m.trail[i-1].y); ctx.lineTo(m.trail[i].x, m.trail[i].y); ctx.stroke();
    }
    ctx.fillStyle = clr.head; ctx.beginPath(); ctx.arc(m.x, m.y, 2.5, 0, Math.PI*2); ctx.fill();
  });

  state.interceptors.forEach(p => {
    for (let i = 1; i < p.trail.length; i++) {
      ctx.strokeStyle = `rgba(62,207,178,${(i/p.trail.length)*0.7})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y); ctx.lineTo(p.trail[i].x, p.trail[i].y); ctx.stroke();
    }
    ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(62,207,178,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.tx-5, p.ty-5); ctx.lineTo(p.tx+5, p.ty+5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.tx+5, p.ty-5); ctx.lineTo(p.tx-5, p.ty+5); ctx.stroke();
  });

  state.explosions.forEach(e => {
    const alpha = Math.max(0, 1 - (e.t / e.dur) * 1.1);
    ctx.globalAlpha = alpha * 0.85; ctx.strokeStyle = e.clr; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.stroke();
    if (e.r > 15) { ctx.globalAlpha = alpha*0.4; ctx.strokeStyle = e.clr === '#ffffff' ? ACCENT : e.clr; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, e.r*0.65, 0, Math.PI*2); ctx.stroke(); }
    if (e.r > 30) { ctx.globalAlpha = alpha*0.2; ctx.strokeStyle = e.clr; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r*0.35, 0, Math.PI*2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });

  if (state.mouse && state.running && !state.dead && !state.paused && !state.waveEnding) {
    const { x: mx, y: my } = state.mouse;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(mx-22, my); ctx.lineTo(mx+22, my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my-22); ctx.lineTo(mx, my+22); ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI*2); ctx.stroke();
  }

  if (state.bonusDisplay && state.bonusDisplay.timer > 0) {
    const t = Math.min(1, state.bonusDisplay.timer / 30);
    ctx.fillStyle = `rgba(62,207,178,${t*0.9})`; ctx.font = '11px "Courier New"'; ctx.textAlign = 'center';
    ctx.fillText(state.bonusDisplay.text, W/2, H*0.42); ctx.textAlign = 'left';
  }
  if (state.waveEnding && (!state.bonusDisplay || state.bonusDisplay.timer < 60)) {
    const a = Math.min(1, (state.waveEndTimer - 60) / 30);
    if (a > 0) { ctx.fillStyle = `rgba(62,207,178,${a*0.35})`; ctx.font = '11px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('WAVE ' + (state.wave + 1) + ' INCOMING', W/2, H*0.42); ctx.textAlign = 'left'; }
  }
}

// ── Loop ──────────────────────────────────────────────────────

function loop() { update(); draw(); animId = requestAnimationFrame(loop); }

// ── Game flow ─────────────────────────────────────────────────

function startGame() {
  const hs = state ? state.highScore : 0;
  state = initState(); state.highScore = hs;
  buildLayout(); state.waveCfg = getWaveCfg(1); state.running = true;
  overlayEl.style.display = 'none';
  pauseOverlayEl.style.display = 'none';
  pauseBtn.style.display = 'inline-block';
  pauseBtn.textContent = 'PAUSE';
  setCursor(true); updateHUD();
}

function die() {
  state.dead = true; state.running = false; state.paused = false;
  pauseOverlayEl.style.display = 'none';
  pauseBtn.style.display = 'none';
  if (state.score > state.highScore) state.highScore = state.score;
  const hs = state.highScore;
  if (typeof onGameOverCb === 'function') onGameOverCb(state.score);
  setCursor(false);
  overlayEl.style.display = 'flex';
  overlayEl.innerHTML = `
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#fff;margin-bottom:16px;">Cities Lost</div>
    <div style="font-size:48px;font-weight:700;letter-spacing:6px;color:#fff;margin-bottom:6px;">${pad(state.score, 6)}</div>
    <div style="font-size:11px;letter-spacing:3px;color:#333;text-transform:uppercase;margin-bottom:20px;">Score</div>
    ${state.score >= hs && state.score > 0
      ? `<div style="font-size:11px;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;margin-bottom:20px;">NEW BEST</div>`
      : `<div style="font-size:11px;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;margin-bottom:20px;">BEST &nbsp;${pad(hs, 6)}</div>`}
    <div style="font-size:11px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:24px;">Reached wave ${state.wave}</div>
    <div style="display:flex;gap:12px;">
      <button id="mc-restart-btn" style="${btnCSS()}">Play Again</button>
      ${onExitCb ? `<button id="mc-exit-btn2" style="background:transparent;border:1px solid #2a2a2a;color:#555;font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;text-transform:uppercase;padding:12px 40px;cursor:pointer;border-radius:6px;">Exit</button>` : ''}
    </div>
  `;
  overlayEl.querySelector('#mc-restart-btn').addEventListener('click', startGame);
  if (onExitCb) {
    overlayEl.querySelector('#mc-exit-btn2').addEventListener('click', () => { stop(); onExitCb(); });
  }
}

// ── Event handlers ────────────────────────────────────────────

function onMouseMove(e) {
  const r = canvas.getBoundingClientRect();
  if (state) state.mouse = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

function onCanvasClick(e) {
  if (!state.running || state.dead || state.waveEnding || state.paused) return;
  const r  = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (W / r.width);
  const my = (e.clientY - r.top)  * (H / r.height);
  if (my >= state.ground) return;
  fireInterceptor(mx, my);
}

// ── Helpers ───────────────────────────────────────────────────

function pad(n, l) { return String(Math.floor(n)).padStart(l, '0'); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}
