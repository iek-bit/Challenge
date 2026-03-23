import { calcLuminance, clamp, randomRange } from "./gameUtils.js";

export function createPrecisionClicksGame(env) {
  const { gameCanvas, gameScreen, scoreReadout, missedReadout, onGameOver } = env;

  let running = false;
  let animationId = null;
  let lastTime = 0;
  let gameTime = 0;
  let spawnTimer = 0;
  let score = 0;
  let streak = 0;
  let started = false;
  let missedTargets = 0;
  let graceTime = 0;
  let totalDifficulty = 0;
  let timeLeft = 30;

  const graceDuration = 2;
  const maxMissed = 3;
  const baseTime = 30;
  const targets = [];
  const ctx = gameCanvas.getContext("2d");

  const difficulty = {
    spawn: 0,
    size: 0,
    life: 0,
    decoy: 0,
  };

  const state = {
    width: 0,
    height: 0,
    minDim: 0,
    bgColor: "#060708",
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
  }

  function start() {
    missedReadout.classList.remove("is-collapsed");
    score = 0;
    streak = 0;
    missedTargets = 0;
    graceTime = 0;
    started = false;
    gameTime = 0;
    timeLeft = baseTime;
    spawnTimer = 0;
    totalDifficulty = 0;
    difficulty.spawn = 0;
    difficulty.size = 0;
    difficulty.life = 0;
    difficulty.decoy = 0;
    targets.length = 0;
    resize();
    window.addEventListener("resize", resize);
    gameCanvas.addEventListener("pointerdown", handleClick);
    spawnTarget(true);
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
    gameCanvas.removeEventListener("pointerdown", handleClick);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    if (started) {
      gameTime += dt;
      spawnTimer += dt;

      const drainRate = 1 + clamp(totalDifficulty * 0.03, 0, 0.5);
      timeLeft = Math.max(0, timeLeft - dt * drainRate);
      if (timeLeft <= 0) {
        onGameOver(score.toString().padStart(6, "0"));
        return;
      }

      if (graceTime > 0) {
        graceTime = Math.max(0, graceTime - dt);
      }

      updateContinuousDifficulty(dt);

      const interval = currentSpawnInterval();
      if (spawnTimer >= interval) {
        spawnTimer -= interval;
        spawnTarget(false);
      }

      expireTargets();
    }

    updateHud();
    render();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function handleClick(event) {
    const rect = gameCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hitIndex = findHitTarget(x, y);

    if (hitIndex === -1) {
      if (started) {
        onGameOver(score.toString().padStart(6, "0"));
      }
      return;
    }

    const target = targets[hitIndex];
    if (target.isDecoy) {
      if (started) {
        score = Math.max(0, score - 150);
        streak = 0;
      }
      targets.splice(hitIndex, 1);
      return;
    }

    if (!started) {
      started = true;
      gameTime = 0;
      spawnTimer = 0;
      totalDifficulty = 0;
      difficulty.spawn = 0;
      difficulty.size = 0;
      difficulty.life = 0;
      difficulty.decoy = 0;
      targets.length = 0;
      missedTargets = 0;
      graceTime = 0;
      timeLeft = baseTime;
      spawnTarget(true);
      return;
    }

    const remaining = Math.max(target.expiresAt - gameTime, 0);
    const bonus = Math.round(100 * (remaining / target.lifetime));
    streak += 1;
    score += 100 + bonus + (streak - 1) * 20;
    targets.splice(hitIndex, 1);
  }

  function findHitTarget(x, y) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    targets.forEach((target, index) => {
      const dx = x - target.x;
      const dy = y - target.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= target.radius && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function spawnTarget(forceReal) {
    const radius = currentTargetRadius();
    const margin = radius + 12;
    const x = randomRange(margin, state.width - margin);
    const y = randomRange(margin + 40, state.height - margin);
    const lifetime = currentTargetLifetime();
    const decoyChance = currentDecoyChance();
    const isDecoy = !forceReal && Math.random() < decoyChance;
    const spawnAt = gameTime;
    targets.push({
      x,
      y,
      radius,
      lifetime,
      expiresAt: spawnAt + lifetime,
      isDecoy,
    });
  }

  function expireTargets() {
    for (let i = targets.length - 1; i >= 0; i -= 1) {
      const target = targets[i];
      if (target.expiresAt <= gameTime) {
        targets.splice(i, 1);
        if (!target.isDecoy) {
          missedTargets += 1;
          graceTime = graceDuration;
          if (missedTargets >= maxMissed) {
            onGameOver(score.toString().padStart(6, "0"));
            return;
          }
        }
      }
    }
  }

  function updateContinuousDifficulty(dt) {
    const rate = 0.25 + gameTime * 0.01;
    totalDifficulty += dt * rate;
    difficulty.spawn = clamp(totalDifficulty * 0.28, 0, 20);
    difficulty.size = clamp(totalDifficulty * 0.22, 0, 18);
    difficulty.life = clamp(totalDifficulty * 0.26, 0, 18);
    difficulty.decoy = clamp(totalDifficulty * 0.18, 0, 12);
  }

  function currentSpawnInterval() {
    const base = 0.8;
    const interval = base * (1 - difficulty.spawn * 0.04);
    return clamp(interval, 0.25, base);
  }

  function currentTargetRadius() {
    const base = state.minDim * 0.045;
    const size = base * (1 - difficulty.size * 0.05);
    return clamp(size, 12, base);
  }

  function currentTargetLifetime() {
    const base = 1.1;
    const reduction = graceTime > 0 ? 0 : difficulty.life * 0.06;
    const life = base * (1 - reduction);
    return clamp(life, 0.35, base);
  }

  function currentDecoyChance() {
    const base = 0.08;
    const chance = base + difficulty.decoy * 0.04;
    return clamp(chance, 0, 0.45);
  }

  function updateHud() {
    scoreReadout.textContent = score.toString().padStart(6, "0");
    missedReadout.textContent = `Missed ${missedTargets}/${maxMissed}`;
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);

    const luminance = calcLuminance(state.bgColor);
    const realColor = luminance > 0.65 ? "rgba(15, 18, 24, 0.8)" : "rgba(231, 237, 244, 0.85)";
    const decoyColor = luminance > 0.65 ? "rgba(70, 50, 20, 0.7)" : "rgba(182, 149, 91, 0.75)";

    targets.forEach((target) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
      if (target.isDecoy) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = decoyColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = decoyColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = realColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  return { start, stop };
}

export function createPrecisionClicksPreview(canvas) {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  const ctx = canvas.getContext("2d");
  const targets = [];

  function renderStatic() {
    targets.length = 0;
    for (let i = 0; i < 6; i += 1) {
      targets.push({
        x: randomRange(40, canvas.width - 40),
        y: randomRange(40, canvas.height - 40),
        r: 10 + Math.random() * 8,
        decoy: i % 3 === 0,
      });
    }
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
    if (animationId) cancelAnimationFrame(animationId);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    targets.forEach((target, index) => {
      target.r += Math.sin(now / 200 + index) * 0.05;
    });
    render();
    animationId = requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#060708";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    targets.forEach((target) => {
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
      if (target.decoy) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "rgba(182, 149, 91, 0.75)";
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(231, 237, 244, 0.85)";
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  return { start, stop, renderStatic };
}
