import {
  calcLuminance,
  clamp,
  lerp,
  nextShapeIndex,
  polygonRadius,
  randomRange,
} from "./gameUtils.js";

export function createMouseCircleGame(env) {
  const { gameCanvas, gameScreen, scoreReadout, missedReadout, onGameOver } = env;

  let running = false;
  let animationId = null;
  let lastTime = 0;
  let elapsed = 0;
  let timeLeft = 30;
  let totalDifficulty = 0;

  const baseTime = 30;
  const pulseDurationBase = 4;
  const buffer = 5;
  const shapes = [
    { name: "circle", fn: () => 1 },
    { name: "triangle", fn: (angle) => polygonRadius(angle, 3) },
    { name: "square", fn: (angle) => polygonRadius(angle, 4) },
    { name: "pentagon", fn: (angle) => polygonRadius(angle, 5) },
    { name: "hexagon", fn: (angle) => polygonRadius(angle, 6) },
    { name: "octagon", fn: (angle) => polygonRadius(angle, 8) },
  ];

  const state = {
    width: 0,
    height: 0,
    minDim: 0,
    center: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    cursor: { x: 0, y: 0 },
    cursorReady: false,
    speedDifficulty: 0,
    sizeDifficulty: 0,
    morphDifficulty: 0,
    driftDifficulty: 0,
    morphTime: 0,
    morphDuration: randomRange(0.7, 1.1),
    morphFrom: 0,
    morphTo: 1,
    sizePhase: 0,
    currentRadius: 0,
    bgColor: "#060708",
    started: false,
    driftTimer: 0,
    driftTarget: { x: 0, y: 0 },
  };

  const ctx = gameCanvas.getContext("2d");

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
    missedReadout.classList.add("is-collapsed");
    elapsed = 0;
    totalDifficulty = 0;
    state.speedDifficulty = 0;
    state.sizeDifficulty = 0;
    state.morphDifficulty = 0;
    state.driftDifficulty = 0;
    state.sizePhase = 0.25;
    state.morphTime = 0;
    state.morphDuration = randomRange(0.7, 1.1);
    state.cursorReady = false;
    state.started = false;
    state.driftTimer = 0;
    timeLeft = baseTime;
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer);
    initMotion();
    const minSize = currentMinSize();
    const maxSize = currentMaxSize();
    state.currentRadius = (minSize + maxSize) * 0.5;
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

  function initMotion() {
    state.center.x = state.width / 2;
    state.center.y = state.height / 2;
    const angle = Math.random() * Math.PI * 2;
    state.velocity.x = Math.cos(angle);
    state.velocity.y = Math.sin(angle);
    state.driftTarget.x = state.velocity.x;
    state.driftTarget.y = state.velocity.y;
    state.morphFrom = Math.floor(Math.random() * shapes.length);
    state.morphTo = nextShapeIndex(state.morphFrom, shapes.length);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    if (!state.started && isCursorInsideShape(0.55)) {
      state.started = true;
      elapsed = 0;
      totalDifficulty = 0;
      const minSize = currentMinSize();
      const maxSize = currentMaxSize();
      state.sizePhase = 0.25;
      state.currentRadius = (minSize + maxSize) * 0.5;
    }

    if (state.started) {
      updateMotion(dt);
      updateMorph(dt);
      updateSizePulse(dt);
      elapsed += dt;
      updateContinuousDifficulty(dt);

      checkCollision();
      const drainRate = 1 + clamp(totalDifficulty * 0.02, 0, 0.5);
      timeLeft = Math.max(0, timeLeft - dt * drainRate);
      if (timeLeft <= 0) {
        onGameOver(scoreReadout.textContent);
        return;
      }
    }

    updateScore();
    render();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function updateContinuousDifficulty(dt) {
    const rate = 0.22 + elapsed * 0.01;
    totalDifficulty += dt * rate;
    state.speedDifficulty = clamp(totalDifficulty * 0.35, 0, 25);
    state.sizeDifficulty = clamp(totalDifficulty * 0.28, 0, 20);
    state.morphDifficulty = clamp(totalDifficulty * 0.32, 0, 20);
    state.driftDifficulty = clamp(totalDifficulty * 0.3, 0, 20);
  }

  function updateMotion(dt) {
    const baseSpeed = state.minDim * 0.16;
    let speedScale = 1 + state.speedDifficulty * 0.3;
    const minSize = currentMinSize();
    const sizeSafety = clamp(minSize / (state.minDim * 0.1), 0.6, 1);
    speedScale *= sizeSafety;
    const speed = baseSpeed * speedScale;

    state.driftTimer += dt;
    const driftInterval = Math.max(0.18, 0.6 - state.driftDifficulty * 0.03);
    if (state.driftTimer >= driftInterval) {
      state.driftTimer = 0;
      const targetAngle = Math.random() * Math.PI * 2;
      state.driftTarget.x = Math.cos(targetAngle);
      state.driftTarget.y = Math.sin(targetAngle);
    }

    const driftBlend = 0.02 + state.driftDifficulty * 0.003;
    state.velocity.x = lerp(state.velocity.x, state.driftTarget.x, driftBlend);
    state.velocity.y = lerp(state.velocity.y, state.driftTarget.y, driftBlend);
    normalizeVelocity();

    state.center.x += state.velocity.x * speed * dt;
    state.center.y += state.velocity.y * speed * dt;

    const margin = state.currentRadius + 12;
    if (state.center.x < margin) {
      state.center.x = margin;
      state.velocity.x = Math.abs(state.velocity.x);
    }
    if (state.center.x > state.width - margin) {
      state.center.x = state.width - margin;
      state.velocity.x = -Math.abs(state.velocity.x);
    }
    if (state.center.y < margin) {
      state.center.y = margin;
      state.velocity.y = Math.abs(state.velocity.y);
    }
    if (state.center.y > state.height - margin) {
      state.center.y = state.height - margin;
      state.velocity.y = -Math.abs(state.velocity.y);
    }
  }

  function updateMorph(dt) {
    const durationScale = 1 - clamp(state.morphDifficulty * 0.05, 0, 0.55);
    const morphDuration = state.morphDuration * durationScale;
    state.morphTime += dt;
    if (state.morphTime >= morphDuration) {
      state.morphTime = 0;
      state.morphFrom = state.morphTo;
      state.morphTo = nextShapeIndex(state.morphFrom, shapes.length);
      state.morphDuration = randomRange(0.7, 1.1);
    }
  }

  function updateSizePulse(dt) {
    const pulseDuration = pulseDurationBase * (1 - clamp(state.morphDifficulty * 0.03, 0, 0.4));
    state.sizePhase = (state.sizePhase + dt / pulseDuration) % 1;
    const minSize = currentMinSize();
    const maxSize = currentMaxSize();
    const eased = 0.5 - 0.5 * Math.cos(state.sizePhase * Math.PI * 2);
    state.currentRadius = minSize + (maxSize - minSize) * eased;
  }

  function updateScore() {
    const score = elapsed * 100;
    scoreReadout.textContent = score.toFixed(2).padStart(7, "0");
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);

    const luminance = calcLuminance(state.bgColor);
    const strokeColor = luminance > 0.65 ? "rgba(15, 18, 24, 0.85)" : "rgba(231, 237, 244, 0.85)";
    const fillColor = luminance > 0.65 ? "rgba(15, 18, 24, 0.18)" : "rgba(231, 237, 244, 0.12)";

    ctx.save();
    ctx.translate(state.center.x, state.center.y);
    ctx.beginPath();
    const points = 96;
    const morphProgress = state.morphTime / currentMorphDuration();
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * clamp(morphProgress, 0, 1));
    for (let i = 0; i <= points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const radius = shapeRadiusAtAngle(angle, eased);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function checkCollision() {
    const dx = state.cursor.x - state.center.x;
    const dy = state.cursor.y - state.center.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const morphProgress = state.morphTime / currentMorphDuration();
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * clamp(morphProgress, 0, 1));
    const boundary = shapeRadiusAtAngle(angle, eased) + buffer;
    if (distance > boundary) {
      onGameOver(scoreReadout.textContent);
    }
  }

  function isCursorInsideShape(innerRatio = 1) {
    if (!state.cursorReady) return false;
    const dx = state.cursor.x - state.center.x;
    const dy = state.cursor.y - state.center.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const morphProgress = state.morphTime / currentMorphDuration();
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * clamp(morphProgress, 0, 1));
    const boundary = shapeRadiusAtAngle(angle, eased) * innerRatio;
    return distance <= boundary;
  }

  function shapeRadiusAtAngle(angle, eased) {
    const fromShape = shapes[state.morphFrom];
    const toShape = shapes[state.morphTo];
    const r1 = fromShape.fn(angle);
    const r2 = toShape.fn(angle);
    return state.currentRadius * (r1 + (r2 - r1) * eased);
  }

  function currentMinSize() {
    const baseMin = state.minDim * 0.1;
    const min = baseMin * (1 - state.sizeDifficulty * 0.04);
    return Math.max(min, state.minDim * 0.07);
  }

  function currentMaxSize() {
    const baseMax = state.minDim * 0.16;
    const max = baseMax * (1 + state.sizeDifficulty * 0.03);
    return Math.max(max, state.minDim * 0.11);
  }

  function currentMorphDuration() {
    const durationScale = 1 - clamp(state.morphDifficulty * 0.02, 0, 0.35);
    return state.morphDuration * durationScale;
  }

  function normalizeVelocity() {
    const len = Math.hypot(state.velocity.x, state.velocity.y) || 1;
    state.velocity.x /= len;
    state.velocity.y /= len;
  }

  return { start, stop };
}

export function createMouseCirclePreview(canvas) {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  const ctx = canvas.getContext("2d");
  const preview = {
    width: 0,
    height: 0,
    center: { x: 0, y: 0 },
    radius: 30,
    angle: 0,
  };

  function renderStatic() {
    preview.width = canvas.width;
    preview.height = canvas.height;
    preview.center.x = preview.width / 2;
    preview.center.y = preview.height / 2;
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
    preview.angle += dt * 2;
    preview.radius = 26 + Math.sin(now / 300) * 8;
    preview.center.x = preview.width / 2 + Math.cos(now / 500) * preview.width * 0.18;
    preview.center.y = preview.height / 2 + Math.sin(now / 420) * preview.height * 0.18;
    render();
    animationId = requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.fillStyle = "#060708";
    ctx.fillRect(0, 0, preview.width, preview.height);
    ctx.strokeStyle = "rgba(231, 237, 244, 0.8)";
    ctx.beginPath();
    ctx.arc(preview.center.x, preview.center.y, preview.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  return { start, stop, renderStatic };
}
