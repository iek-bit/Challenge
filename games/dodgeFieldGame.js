import { clamp, lerp, randomRange } from "./gameUtils.js";

export function createDodgeFieldGame(env) {
  const { gameCanvas, gameScreen, scoreReadout, missedReadout, heartsReadout, onGameOver } = env;

  let running = false;
  let animationId = null;
  let lastTime = 0;
  let elapsed = 0;
  let score = 0;
  let lives = 3;
  let totalDifficulty = 0;

  const hazards = [];
  const ctx = gameCanvas.getContext("2d");
  const maxLives = 3;

  const state = {
    width: 0,
    height: 0,
    minDim: 0,
    cursor: { x: 0, y: 0 },
    cursorReady: false,
    bgColor: "#060708",
    spawnTimer: 0,
  };

  function resize() {
    const rect = gameScreen.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    gameCanvas.width = rect.width * dpr;
    gameCanvas.height = rect.height * dpr;
    gameCanvas.style.width = `${rect.width}px`;
    gameCanvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;
    state.minDim = Math.min(rect.width, rect.height);
    if (!state.cursorReady) {
      state.cursor.x = rect.width / 2;
      state.cursor.y = rect.height / 2;
    }
  }

  function start() {
    heartsReadout.classList.remove("is-hidden");
    missedReadout.classList.add("is-collapsed");
    lives = maxLives;
    score = 0;
    elapsed = 0;
    totalDifficulty = 0;
    hazards.length = 0;
    state.spawnTimer = 0;
    state.cursorReady = false;
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer);
    running = true;
    lastTime = performance.now();
    loop(lastTime);
  }

  function stop() {
    running = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", handlePointer);
  }

  function handlePointer(event) {
    const rect = gameCanvas.getBoundingClientRect();
    state.cursor.x = event.clientX - rect.left;
    state.cursor.y = event.clientY - rect.top;
    state.cursorReady = true;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    elapsed += dt;
    score = elapsed * 100;

    updateDifficulty(dt);
    updateSpawning(dt);
    updateHazards(dt);
    checkCollisions();
    updateHud();
    render();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function updateDifficulty(dt) {
    const rate = 0.28 + elapsed * 0.02;
    totalDifficulty += dt * rate;
  }

  function updateSpawning(dt) {
    const maxConcurrent = currentMaxConcurrent();
    state.spawnTimer += dt;
    const interval = currentSpawnInterval();
    if (state.spawnTimer >= interval && hazards.length < maxConcurrent) {
      state.spawnTimer = 0;
      hazards.push(createHazard());
    }
  }

  function currentSpawnInterval() {
    const base = 0.8;
    const interval = base * (1 - clamp(totalDifficulty * 0.03, 0, 0.6));
    return clamp(interval, 0.2, base);
  }

  function currentMaxConcurrent() {
    const base = 5;
    const extra = Math.floor(totalDifficulty * 0.15);
    const penalty = unlockedTypeCount() > 2 ? 1 : 0;
    return clamp(base + extra - penalty, 4, 14);
  }

  function unlockedTypeCount() {
    return 1 + (totalDifficulty > 8 ? 1 : 0) + (totalDifficulty > 16 ? 1 : 0);
  }

  function createHazard() {
    const type = pickHazardType();
    const sizeTier = pickSizeTier();
    let radius = sizeTierRadius(sizeTier);
    const { x, y, vx, vy } = spawnFromEdge();
    let speedScale = randomRange(0.55, 1.2);
    if (type === "fast") {
      speedScale *= 1.8;
      radius *= 0.82;
    } else if (type === "track") {
      speedScale *= 0.92;
    } else if (type === "curve") {
      speedScale *= 1.05;
    } else if (type === "wander") {
      speedScale *= 0.95;
    }
    return {
      type,
      x,
      y,
      vx: vx * speedScale,
      vy: vy * speedScale,
      radius,
      sizeTier,
      curvePhase: Math.random() * Math.PI * 2,
      curveStrength: 1.1 + Math.random() * 1.1,
      trackTimeLeft: 1.6 + Math.random() * 1.2,
      noisePhase: Math.random() * Math.PI * 2,
      noiseStrength: 1.3 + Math.random() * 1.2,
      laserPhase: "telegraph",
      telegraphTimer: 0.6,
      laserLife: 1.0,
      beamThickness: radius * 2.6,
      laserLength: 0,
      laserAxis: Math.random() < 0.5 ? "h" : "v",
      stationary: false,
      travelRange: 0,
      life: 0,
    };
  }

  function pickHazardType() {
    const pool = ["straight"];
    if (totalDifficulty > 6) pool.push("fast");
    if (totalDifficulty > 12) pool.push("track");
    if (totalDifficulty > 18) pool.push("curve");
    if (totalDifficulty > 24) pool.push("wander");
    if (totalDifficulty > 30) pool.push("laser");
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickSizeTier() {
    const roll = Math.random();
    if (totalDifficulty < 10) {
      return roll < 0.7 ? "small" : roll < 0.95 ? "medium" : "large";
    }
    if (totalDifficulty < 20) {
      return roll < 0.5 ? "small" : roll < 0.85 ? "medium" : "large";
    }
    return roll < 0.3 ? "small" : roll < 0.7 ? "medium" : "large";
  }

  function sizeTierRadius(tier) {
    const small = clamp(state.minDim * 0.012, 8, 12);
    const medium = clamp(state.minDim * 0.018, 12, 18);
    const large = clamp(state.minDim * 0.026, 18, 26);
    if (tier === "small") return small;
    if (tier === "large") return large;
    return medium;
  }

  function spawnFromEdge() {
    const edge = Math.floor(Math.random() * 4);
    const speed = currentHazardSpeed();
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    if (edge === 0) {
      x = randomRange(0, state.width);
      y = -20;
      vx = randomRange(-0.3, 0.3);
      vy = 1;
    } else if (edge === 1) {
      x = state.width + 20;
      y = randomRange(0, state.height);
      vx = -1;
      vy = randomRange(-0.3, 0.3);
    } else if (edge === 2) {
      x = randomRange(0, state.width);
      y = state.height + 20;
      vx = randomRange(-0.3, 0.3);
      vy = -1;
    } else {
      x = -20;
      y = randomRange(0, state.height);
      vx = 1;
      vy = randomRange(-0.3, 0.3);
    }
    const len = Math.hypot(vx, vy) || 1;
    return { x, y, vx: (vx / len) * speed, vy: (vy / len) * speed };
  }

  function currentHazardSpeed() {
    const base = state.minDim * 0.22;
    return base * (1 + clamp(totalDifficulty * 0.08, 0, 2.6));
  }

  function updateHazards(dt) {
    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      hazard.life += dt;
      if (hazard.type === "laser") {
        hazard.telegraphTimer = Math.max(0, hazard.telegraphTimer - dt);
        hazard.laserPhase = hazard.telegraphTimer > 0 ? "telegraph" : "sweep";
        hazard.laserLife = Math.max(0, hazard.laserLife - dt);
        if (hazard.laserLife <= 0) {
          hazards.splice(i, 1);
          continue;
        }
        if (hazard.laserLength === 0) {
          hazard.laserLength = hazard.laserAxis === "v" ? state.height : state.width;
          hazard.travelRange = hazard.laserAxis === "v" ? state.width * 0.45 : state.height * 0.45;
          hazard.stationary = Math.random() < 0.5;
          if (hazard.stationary) {
            hazard.vx = 0;
            hazard.vy = 0;
          }
        }
      }
      if (hazard.type === "track" && hazard.trackTimeLeft > 0) {
        hazard.trackTimeLeft = Math.max(0, hazard.trackTimeLeft - dt);
        steerTowardCursor(hazard, 1.2 * dt);
      }
      if (hazard.type === "curve") {
        hazard.curvePhase += dt * 2;
        hazard.vx += Math.cos(hazard.curvePhase) * hazard.curveStrength;
        hazard.vy += Math.sin(hazard.curvePhase) * hazard.curveStrength;
      }
      if (hazard.type === "fast") {
        const baseSpeed = currentHazardSpeed() * 1.75;
        const len = Math.hypot(hazard.vx, hazard.vy) || 1;
        const targetVX = (hazard.vx / len) * baseSpeed;
        const targetVY = (hazard.vy / len) * baseSpeed;
        hazard.vx = lerp(hazard.vx, targetVX, 0.14);
        hazard.vy = lerp(hazard.vy, targetVY, 0.14);
      }
      if (hazard.type === "wander") {
        hazard.noisePhase += dt * 3;
        hazard.vx += Math.cos(hazard.noisePhase) * hazard.noiseStrength;
        hazard.vy += Math.sin(hazard.noisePhase * 0.8) * hazard.noiseStrength;
      }
      if (!hazard.stationary) {
        hazard.x += hazard.vx * dt;
        hazard.y += hazard.vy * dt;
        if (hazard.type === "laser") {
          if (hazard.laserAxis === "h") {
            hazard.y = clamp(hazard.y, state.height * 0.1, state.height * 0.9);
          } else {
            hazard.x = clamp(hazard.x, state.width * 0.1, state.width * 0.9);
          }
        }
      }
      if (hazard.x < -60 || hazard.x > state.width + 60 || hazard.y < -60 || hazard.y > state.height + 60) {
        hazards.splice(i, 1);
      }
    }
  }

  function steerTowardCursor(hazard, strength) {
    const dx = state.cursor.x - hazard.x;
    const dy = state.cursor.y - hazard.y;
    const len = Math.hypot(dx, dy) || 1;
    const targetVX = (dx / len) * currentHazardSpeed();
    const targetVY = (dy / len) * currentHazardSpeed();
    hazard.vx = lerp(hazard.vx, targetVX, strength);
    hazard.vy = lerp(hazard.vy, targetVY, strength);
  }

  function checkCollisions() {
    if (!state.cursorReady) return;
    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      if (hazard.type === "laser" && hazard.laserPhase === "sweep") {
        const { distance } = pointToLaserDistance(hazard, state.cursor.x, state.cursor.y);
        if (distance <= hazard.beamThickness) {
          hazards.splice(i, 1);
          lives -= 1;
        }
      } else {
        const dx = hazard.x - state.cursor.x;
        const dy = hazard.y - state.cursor.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= hazard.radius + 6) {
          hazards.splice(i, 1);
          lives -= 1;
        }
      }
      if (lives <= 0) {
        onGameOver(Math.floor(score).toString().padStart(6, "0"));
        return;
      }
    }
  }

  function updateHud() {
    scoreReadout.textContent = Math.floor(score).toString().padStart(6, "0");
    missedReadout.textContent = "";
    heartsReadout.textContent = "❤".repeat(lives);
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);

    hazards.forEach((hazard) => {
      if (hazard.type === "laser") {
        ctx.strokeStyle = hazard.laserPhase === "telegraph" ? "rgba(138, 182, 166, 0.35)" : "rgba(231, 237, 244, 0.9)";
        ctx.lineWidth = hazard.laserPhase === "telegraph" ? 1 : hazard.beamThickness;
        ctx.beginPath();
        const { x1, y1, x2, y2 } = laserEndpoints(hazard);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = "rgba(231, 237, 244, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    if (state.cursorReady) {
      ctx.beginPath();
      ctx.arc(state.cursor.x, state.cursor.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(138, 182, 166, 0.9)";
      ctx.stroke();
    }
  }

  return { start, stop };
}

function laserEndpoints(hazard) {
  if (hazard.laserAxis === "v") {
    return { x1: hazard.x, y1: 0, x2: hazard.x, y2: hazard.laserLength || hazard.y };
  }
  return { x1: 0, y1: hazard.y, x2: hazard.laserLength || hazard.x, y2: hazard.y };
}

function pointToLaserDistance(hazard, px, py) {
  const { x1, y1, x2, y2 } = laserEndpoints(hazard);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return { distance: Math.hypot(px - cx, py - cy), cx, cy };
}

export function createDodgeFieldPreview(canvas) {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  const ctx = canvas.getContext("2d");
  const hazards = [];
  const preview = {
    width: 0,
    height: 0,
    cursor: { x: 60, y: 60 },
  };

  function renderStatic() {
    preview.width = canvas.width;
    preview.height = canvas.height;
    hazards.length = 0;
    for (let i = 0; i < 12; i += 1) {
      hazards.push({
        x: randomRange(0, preview.width),
        y: randomRange(0, preview.height),
        vx: randomRange(-80, 80),
        vy: randomRange(-80, 80),
        radius: 6 + Math.random() * 10,
        type: i % 3 === 0 ? "curve" : i % 3 === 1 ? "track" : "wander",
        curvePhase: Math.random() * Math.PI * 2,
        noisePhase: Math.random() * Math.PI * 2,
        noiseStrength: 0.6 + Math.random() * 0.6,
        laserPhase: "telegraph",
        telegraphTimer: 0.6,
        beamThickness: 10,
      });
    }
    hazards.push({
      x: preview.width * 0.5,
      y: preview.height * 0.35,
      vx: 40,
      vy: 0,
      radius: 8,
      type: "laser",
      laserPhase: "telegraph",
      telegraphTimer: 0.6,
      laserLife: 1.0,
      beamThickness: 10,
      laserLength: preview.width,
      laserAxis: "h",
      stationary: false,
    });
    hazards.push({
      x: preview.width * 0.2,
      y: preview.height * 0.7,
      vx: 0,
      vy: 0,
      radius: 8,
      type: "laser",
      laserPhase: "telegraph",
      telegraphTimer: 0.5,
      laserLife: 1.0,
      beamThickness: 8,
      laserLength: preview.height,
      laserAxis: "v",
      stationary: true,
    });
    render();
  }

  function start() {
    renderStatic();
    running = true;
    lastTime = performance.now();
    loop(lastTime);
  }

  function stop() {
    running = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    preview.cursor.x = preview.width / 2 + Math.cos(now / 600) * preview.width * 0.2;
    preview.cursor.y = preview.height / 2 + Math.sin(now / 700) * preview.height * 0.2;
    hazards.forEach((hazard) => {
      if (hazard.type === "laser") {
        hazard.telegraphTimer = Math.max(0, hazard.telegraphTimer - dt);
        hazard.laserPhase = hazard.telegraphTimer > 0 ? "telegraph" : "sweep";
        hazard.laserLife = hazard.laserLife === undefined ? 1.0 : Math.max(0, hazard.laserLife - dt);
        if (hazard.laserLife <= 0) {
          hazard.laserLife = 1.0;
          hazard.telegraphTimer = 0.6;
        }
        if (hazard.laserLength === undefined) {
          hazard.laserLength = preview.width * 0.5;
          hazard.laserAxis = "h";
          hazard.stationary = false;
        }
      }
      if (hazard.type === "curve") {
        hazard.curvePhase += dt * 2;
        hazard.vx += Math.cos(hazard.curvePhase) * 8 * dt;
        hazard.vy += Math.sin(hazard.curvePhase) * 8 * dt;
      } else if (hazard.type === "track") {
        const dx = preview.cursor.x - hazard.x;
        const dy = preview.cursor.y - hazard.y;
        const len = Math.hypot(dx, dy) || 1;
        hazard.vx = lerp(hazard.vx, (dx / len) * 90, 0.02);
        hazard.vy = lerp(hazard.vy, (dy / len) * 90, 0.02);
      } else if (hazard.type === "wander") {
        hazard.noisePhase += dt * 3;
        hazard.vx += Math.cos(hazard.noisePhase) * 6 * dt;
        hazard.vy += Math.sin(hazard.noisePhase * 0.8) * 6 * dt;
      }
      if (!hazard.stationary) {
        hazard.x += hazard.vx * dt;
        hazard.y += hazard.vy * dt;
      }
      if (hazard.x < -20) hazard.x = preview.width + 20;
      if (hazard.x > preview.width + 20) hazard.x = -20;
      if (hazard.y < -20) hazard.y = preview.height + 20;
      if (hazard.y > preview.height + 20) hazard.y = -20;
    });
    render();
    animationId = requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.fillStyle = "#060708";
    ctx.fillRect(0, 0, preview.width, preview.height);
    hazards.forEach((hazard) => {
      if (hazard.type === "laser") {
        ctx.strokeStyle = hazard.laserPhase === "telegraph" ? "rgba(138, 182, 166, 0.35)" : "rgba(231, 237, 244, 0.9)";
        ctx.lineWidth = hazard.laserPhase === "telegraph" ? 1 : hazard.beamThickness;
        ctx.beginPath();
        const { x1, y1, x2, y2 } = laserEndpoints(hazard);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.lineWidth = 2;
        return;
      }
      ctx.strokeStyle = "rgba(231, 237, 244, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(preview.cursor.x, preview.cursor.y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(138, 182, 166, 0.9)";
    ctx.stroke();
  }

  return { start, stop, renderStatic };
}
