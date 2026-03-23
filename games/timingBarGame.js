import { clamp, difficultyStepMagnitude, randomRange } from "./gameUtils.js";

export function createTimingBarGame(env) {
  const { gameCanvas, gameScreen, scoreReadout, missedReadout, onGameOver } = env;

  let running = false;
  let animationId = null;
  let lastTime = 0;
  let gameTime = 0;
  let stepTimer = 0;
  let stepCount = 0;
  let score = 0;
  let streak = 0;
  let missed = 0;
  let started = false;
  let timeLeft = 30;
  let sliderPos = 0.2;
  let sliderDir = 1;
  let zoneCenter = 0.5;
  let zoneDir = 1;
  let feintPhase = 0;

  const stepDuration = 5;
  const maxMissed = 3;
  const baseTime = 30;
  const ctx = gameCanvas.getContext("2d");

  const difficulty = {
    speed: 0,
    size: 0,
    move: 0,
    feint: 0,
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
    missed = 0;
    started = false;
    gameTime = 0;
    stepTimer = 0;
    stepCount = 0;
    timeLeft = baseTime;
    difficulty.speed = 0;
    difficulty.size = 0;
    difficulty.move = 0;
    difficulty.feint = 0;
    sliderPos = 0.2;
    sliderDir = 1;
    zoneCenter = 0.5;
    zoneDir = 1;
    feintPhase = 0;
    resize();
    window.addEventListener("resize", resize);
    gameCanvas.addEventListener("pointerdown", handleInput);
    window.addEventListener("keydown", handleKey);
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
    gameCanvas.removeEventListener("pointerdown", handleInput);
    window.removeEventListener("keydown", handleKey);
  }

  function handleKey(event) {
    if (event.repeat) return;
    handleInput(event);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    updateSlider(dt);
    if (started) {
      gameTime += dt;
      stepTimer += dt;

      if (stepTimer >= stepDuration) {
        stepTimer -= stepDuration;
        applyDifficultyStep();
      }

      const drainRate = 1 + clamp(stepCount * 0.08, 0, 0.5);
      timeLeft = Math.max(0, timeLeft - dt * drainRate);
      if (timeLeft <= 0) {
        onGameOver(score.toString().padStart(6, "0"));
        return;
      }

      updateZone(dt);
    }

    updateHud();
    render();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function handleInput(event) {
    event.preventDefault();
    if (!started) {
      started = true;
      gameTime = 0;
      timeLeft = baseTime;
      stepTimer = 0;
      stepCount = 0;
      difficulty.speed = 0;
      difficulty.size = 0;
      difficulty.move = 0;
      difficulty.feint = 0;
      repositionZone(sliderPos);
      return;
    }

    const zoneWidth = currentZoneWidth();
    const distance = Math.abs(sliderPos - zoneCenter);
    if (distance <= zoneWidth / 2) {
      const normalized = 1 - clamp(distance / (zoneWidth / 2), 0, 1);
      const bonus = Math.round(100 * normalized);
      const perfect = distance <= zoneWidth * 0.15;
      streak += 1;
      score += 100 + bonus + (perfect ? 100 : 0) + (streak - 1) * 20;
      timeLeft = clamp(timeLeft + 0.4, 0, baseTime);
    } else {
      streak = 0;
      missed += 1;
      if (missed >= maxMissed) {
        onGameOver(score.toString().padStart(6, "0"));
        return;
      }
    }

    repositionZone(sliderPos);
  }

  function repositionZone(avoidPos) {
    const minGap = 0.18;
    let next = zoneCenter;
    for (let i = 0; i < 10; i += 1) {
      next = randomRange(0.12, 0.88);
      if (Math.abs(next - avoidPos) >= minGap) {
        break;
      }
    }
    if (Math.abs(next - avoidPos) < minGap) {
      next = clamp(avoidPos + (avoidPos < 0.5 ? minGap : -minGap), 0.12, 0.88);
    }
    zoneCenter = next;
    zoneDir = Math.random() < 0.5 ? -1 : 1;
  }

  function updateSlider(dt) {
    const speed = currentSliderSpeed(dt);
    sliderPos += sliderDir * speed * dt;
    if (sliderPos <= 0) {
      sliderPos = 0;
      sliderDir = 1;
    } else if (sliderPos >= 1) {
      sliderPos = 1;
      sliderDir = -1;
    }
  }

  function updateZone(dt) {
    if (stepCount < 5) return;
    const zoneSpeed = currentZoneSpeed();
    zoneCenter += zoneDir * zoneSpeed * dt;
    if (zoneCenter <= 0.15) {
      zoneCenter = 0.15;
      zoneDir = 1;
    } else if (zoneCenter >= 0.85) {
      zoneCenter = 0.85;
      zoneDir = -1;
    }
  }

  function applyDifficultyStep() {
    let options = ["speed", "size", "feint"];
    if (stepCount >= 5) {
      options = ["speed", "size", "feint", "move"];
    }
    const pick = options[Math.floor(Math.random() * options.length)];
    const magnitude = difficultyStepMagnitude(gameTime);

    if (pick === "speed") difficulty.speed += magnitude;
    if (pick === "size") difficulty.size += magnitude;
    if (pick === "move") difficulty.move += magnitude;
    if (pick === "feint") difficulty.feint += magnitude;
    stepCount += 1;
  }

  function currentSliderSpeed(dt) {
    const base = 0.75;
    const speed = base + difficulty.speed * 0.12;
    const feintStrength = clamp(difficulty.feint * 0.02, 0, 0.18);
    feintPhase += dt * (2 + difficulty.speed * 0.4);
    const feint = 1 + Math.sin(feintPhase) * feintStrength;
    return speed * feint;
  }

  function currentZoneWidth() {
    const base = 0.18;
    const width = base * (1 - difficulty.size * 0.05);
    return clamp(width, 0.06, base);
  }

  function currentZoneSpeed() {
    const sliderSpeed = currentSliderSpeed(0);
    const ratio = 0.35 + clamp(difficulty.move * 0.015, 0, 0.15);
    return sliderSpeed * ratio;
  }

  function updateHud() {
    scoreReadout.textContent = score.toString().padStart(6, "0");
    missedReadout.textContent = `Missed ${missed}/${maxMissed}`;
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);

    const barWidth = Math.min(state.width * 0.8, 700);
    const barHeight = 12;
    const barX = (state.width - barWidth) / 2;
    const barY = state.height * 0.55;
    const zoneWidth = currentZoneWidth() * barWidth;
    const zoneX = barX + zoneCenter * barWidth - zoneWidth / 2;
    const sliderX = barX + sliderPos * barWidth;

    ctx.strokeStyle = "rgba(231, 237, 244, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(barX, barY, barWidth, barHeight);
    ctx.stroke();

    ctx.fillStyle = "rgba(138, 182, 166, 0.18)";
    ctx.fillRect(zoneX, barY - 10, zoneWidth, barHeight + 20);

    ctx.fillStyle = "rgba(231, 237, 244, 0.9)";
    ctx.fillRect(sliderX - 3, barY - 16, 6, barHeight + 32);

    const perfectWidth = zoneWidth * 0.3;
    ctx.fillStyle = "rgba(138, 182, 166, 0.35)";
    ctx.fillRect(zoneX + (zoneWidth - perfectWidth) / 2, barY - 6, perfectWidth, barHeight + 12);
  }

  return { start, stop };
}

export function createTimingBarPreview(canvas) {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  let sliderPos = 0.2;
  let sliderDir = 1;
  let zoneCenter = 0.6;
  const ctx = canvas.getContext("2d");

  function renderStatic() {
    sliderPos = 0.3;
    zoneCenter = 0.6;
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
    sliderPos += sliderDir * dt * 0.8;
    if (sliderPos <= 0) {
      sliderPos = 0;
      sliderDir = 1;
    } else if (sliderPos >= 1) {
      sliderPos = 1;
      sliderDir = -1;
    }
    zoneCenter += Math.sin(now / 600) * 0.0008;
    render();
    animationId = requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#060708";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const barWidth = canvas.width * 0.8;
    const barX = canvas.width * 0.1;
    const barY = canvas.height * 0.55;
    const zoneWidth = barWidth * 0.16;
    const zoneX = barX + zoneCenter * barWidth - zoneWidth / 2;
    const sliderX = barX + sliderPos * barWidth;
    ctx.strokeStyle = "rgba(231, 237, 244, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(barX, barY, barWidth, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(138, 182, 166, 0.25)";
    ctx.fillRect(zoneX, barY - 6, zoneWidth, 22);
    ctx.fillStyle = "rgba(231, 237, 244, 0.9)";
    ctx.fillRect(sliderX - 2, barY - 10, 4, 30);
  }

  return { start, stop, renderStatic };
}
