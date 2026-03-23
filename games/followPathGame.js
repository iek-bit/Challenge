import { clamp, lerp, randomRange } from "./gameUtils.js";

export function createFollowPathGame(env) {
  const { gameCanvas, gameScreen, scoreReadout, missedReadout, heartsReadout, onGameOver } = env;

  let running = false;
  let animationId = null;
  let lastTime = 0;
  let elapsed = 0;
  let health = 100;
  let started = false;
  let totalDifficulty = 0;

  const ctx = gameCanvas.getContext("2d");
  const points = [];
  const segmentHeight = 24;
  const margin = 80;
  const drainRate = 40;

  const state = {
    width: 0,
    height: 0,
    minDim: 0,
    player: { x: 0, y: 0 },
    playerReady: false,
    bgColor: "#060708",
  };

  const pathState = {
    targetX: 0,
    turnTimer: 0,
    oscPhase: 0,
    widthPhase: Math.random() * Math.PI * 2,
    speedPhase: Math.random() * Math.PI * 2,
    spanMin: 0,
    spanMax: 0,
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
    state.player.y = state.height * 0.58;
    state.player.x = state.width * 0.5;
  }

  function start() {
    missedReadout.classList.remove("is-collapsed");
    heartsReadout.classList.add("is-hidden");
    elapsed = 0;
    health = 100;
    started = false;
    totalDifficulty = 0;
    state.playerReady = false;
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer);
    initPath();
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
    state.player.x = clamp(event.clientX - rect.left, 0, state.width);
    state.playerReady = true;
  }

  function initPath() {
    points.length = 0;
    const midX = state.width / 2;
    pathState.spanMin = state.width * 0.1;
    pathState.spanMax = state.width * 0.9;
    const top = -margin;
    const bottom = state.height + margin;
    for (let y = top; y <= bottom; y += segmentHeight) {
      points.push({ x: midX, y, w: currentTubeHalfWidth(0) });
    }
    pathState.targetX = midX;
    pathState.turnTimer = 0.6;
    pathState.oscPhase = Math.random() * Math.PI * 2;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    const difficulty = started ? updateDifficulty(dt) : 0;
    updatePath(dt, difficulty);
    const inside = isCursorInside();
    if (!started && state.playerReady && inside) {
      started = true;
      elapsed = 0;
    }

    if (started) {
      elapsed += dt;
      if (!inside) {
        health = Math.max(0, health - drainRate * dt);
        if (health <= 0) {
          onGameOver(scoreReadout.textContent);
          return;
        }
      }
    }

    updateHud();
    render();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function updateDifficulty(dt) {
    const rate = 0.2 + elapsed * 0.01;
    totalDifficulty += dt * rate;
    return totalDifficulty;
  }

  function updatePath(dt, difficulty) {
    const scrollSpeed = currentScrollSpeed(difficulty);
    const deltaY = scrollSpeed * dt;
    points.forEach((point) => {
      point.y += deltaY;
    });

    while (points.length > 0 && points[points.length - 1].y > state.height + margin) {
      points.pop();
    }

    const topLimit = -margin;
    while (points.length === 0 || points[0].y > topLimit) {
      const nextY = points.length === 0 ? topLimit : points[0].y - segmentHeight;
      const nextX = generateNextX(difficulty, scrollSpeed);
      const nextW = generateNextWidth(difficulty, scrollSpeed);
      points.unshift({ x: nextX, y: nextY, w: nextW });
    }
  }

  function generateNextX(difficulty, scrollSpeed) {
    const complexity = clamp(difficulty * 0.6, 0, 24);
    const wildness = clamp((difficulty - 18) / 10, 0, 1);
    const intervalMin = lerp(0.25, 0.8, 1 - clamp(complexity / 18, 0, 1));
    const intervalMax = lerp(0.5, 1.4, 1 - clamp(complexity / 18, 0, 1));
    const maxDelta = lerp(18, 72, clamp(complexity / 24, 0, 1)) * (1 + wildness * 0.45);
    const oscAmp = lerp(0.08, 0.22, clamp(complexity / 24, 0, 1)) * (1 + wildness * 0.6);

    const dtSegment = segmentHeight / Math.max(scrollSpeed, 1);
    pathState.turnTimer -= dtSegment;
    if (pathState.turnTimer <= 0) {
      const marginX = currentTubeHalfWidth(difficulty) + 24;
      const spanChance = Math.random();
      if (spanChance < 0.35 + wildness * 0.25) {
        const spanWidth = randomRange(state.width * (0.35 - wildness * 0.05), state.width * (0.75 - wildness * 0.1));
        const spanCenter = randomRange(state.width * 0.25, state.width * 0.75);
        pathState.spanMin = clamp(spanCenter - spanWidth * 0.5, marginX, state.width - marginX);
        pathState.spanMax = clamp(spanCenter + spanWidth * 0.5, marginX, state.width - marginX);
      } else {
        pathState.spanMin = marginX;
        pathState.spanMax = state.width - marginX;
      }
      pathState.targetX = randomRange(pathState.spanMin, pathState.spanMax);
      const wildMin = intervalMin * (1 - wildness * 0.45);
      const wildMax = intervalMax * (1 - wildness * 0.4);
      pathState.turnTimer = randomRange(wildMin, wildMax);
    }

    const lastX = points.length > 0 ? points[0].x : state.width / 2;
    const delta = clamp(pathState.targetX - lastX, -maxDelta, maxDelta);
    pathState.oscPhase += dtSegment * (1.6 + complexity * 0.08 + wildness * 1.4);
    const oscillation = Math.sin(pathState.oscPhase) * oscAmp * state.width;
    return clamp(lastX + delta * 0.35 + oscillation, pathState.spanMin, pathState.spanMax);
  }

  function generateNextWidth(difficulty, scrollSpeed) {
    const wildness = clamp((difficulty - 18) / 10, 0, 1);
    const base = currentTubeHalfWidth(difficulty);
    const dtSegment = segmentHeight / Math.max(scrollSpeed, 1);
    pathState.widthPhase += dtSegment * (0.9 + difficulty * 0.02 + wildness * 0.8);
    const wave = Math.sin(pathState.widthPhase);
    const noise = randomRange(-0.4 - wildness * 0.2, 0.4 + wildness * 0.2);
    const variance = clamp(0.25 + difficulty * 0.01 + wildness * 0.15, 0.25, 0.8);
    const factor = clamp(1 + (wave + noise) * variance, 0.45, 1.45);
    return Math.max(20, base * factor);
  }

  function currentTubeHalfWidth(difficulty) {
    const base = state.minDim * 0.12;
    const shrink = clamp(difficulty * 0.02, 0, 0.4);
    return Math.max(24, base * (1 - shrink));
  }

  function currentScrollSpeed(difficulty) {
    const base = state.minDim * 0.18;
    const boost = 1 + clamp(difficulty * 0.04, 0, 1.1);
    pathState.speedPhase += 0.01 + difficulty * 0.0008;
    const pulse = 1 + Math.sin(pathState.speedPhase) * 0.15;
    return base * boost * pulse;
  }

  function isCursorInside() {
    if (points.length < 2) return false;
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const { distance, t } = pointToSegmentDistance(state.player.x, state.player.y, p1.x, p1.y, p2.x, p2.y);
      const halfWidth = lerp(p1.w, p2.w, t);
      const edgeDistance = distance - halfWidth;
      if (edgeDistance < best) best = edgeDistance;
    }
    return best <= 0;
  }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return { distance: Math.hypot(px - cx, py - cy), t };
  }

  function updateHud() {
    const score = started ? elapsed * 100 : 0;
    scoreReadout.textContent = score.toFixed(2).padStart(7, "0");
    missedReadout.textContent = `Health ${Math.ceil(health)}%`;
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, state.width, state.height);
    if (points.length < 2) return;

    const left = [];
    const right = [];
    for (let i = 0; i < points.length; i += 1) {
      const prev = points[i - 1] || points[i];
      const next = points[i + 1] || points[i];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const halfWidth = points[i].w;
      left.push({ x: points[i].x + nx * halfWidth, y: points[i].y + ny * halfWidth });
      right.push({ x: points[i].x - nx * halfWidth, y: points[i].y - ny * halfWidth });
    }

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i += 1) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(138, 182, 166, 0.16)";
    ctx.fill();

    ctx.strokeStyle = "rgba(231, 237, 244, 0.6)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    if (state.playerReady) {
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(226, 74, 74, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(226, 74, 74, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  return { start, stop };
}

export function createFollowPathPreview(canvas) {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  const ctx = canvas.getContext("2d");
  const points = [];
  const segmentHeight = 20;
  const margin = 40;
  const preview = {
    width: 0,
    height: 0,
  };

  const pathState = {
    targetX: 0,
    turnTimer: 0,
    oscPhase: Math.random() * Math.PI * 2,
  };

  function renderStatic() {
    preview.width = canvas.width;
    preview.height = canvas.height;
    initPath();
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

  function initPath() {
    points.length = 0;
    const midX = preview.width / 2;
    for (let y = -margin; y <= preview.height + margin; y += segmentHeight) {
      points.push({ x: midX, y });
    }
    pathState.targetX = midX;
    pathState.turnTimer = 0.7;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    updatePath(dt);
    render();
    animationId = requestAnimationFrame(loop);
  }

  function updatePath(dt) {
    const speed = Math.min(preview.height * 0.35, 140);
    const deltaY = speed * dt;
    points.forEach((point) => {
      point.y += deltaY;
    });
    while (points.length > 0 && points[points.length - 1].y > preview.height + margin) {
      points.pop();
    }
    while (points.length === 0 || points[0].y > -margin) {
      const nextY = points.length === 0 ? -margin : points[0].y - segmentHeight;
      const nextX = generateNextX(speed);
      points.unshift({ x: nextX, y: nextY });
    }
  }

  function generateNextX(speed) {
    const dtSegment = segmentHeight / Math.max(speed, 1);
    pathState.turnTimer -= dtSegment;
    if (pathState.turnTimer <= 0) {
      pathState.targetX = randomRange(30, preview.width - 30);
      pathState.turnTimer = randomRange(0.45, 1.0);
    }
    pathState.oscPhase += dtSegment * 1.6;
    const osc = Math.sin(pathState.oscPhase) * preview.width * 0.12;
    const lastX = points.length > 0 ? points[0].x : preview.width / 2;
    const delta = clamp(pathState.targetX - lastX, -32, 32);
    return clamp(lastX + delta * 0.35 + osc, 18, preview.width - 18);
  }

  function render() {
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.fillStyle = "#060708";
    ctx.fillRect(0, 0, preview.width, preview.height);
    if (points.length < 2) return;
    const halfWidth = 18;
    const left = [];
    const right = [];
    for (let i = 0; i < points.length; i += 1) {
      const prev = points[i - 1] || points[i];
      const next = points[i + 1] || points[i];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      left.push({ x: points[i].x + nx * halfWidth, y: points[i].y + ny * halfWidth });
      right.push({ x: points[i].x - nx * halfWidth, y: points[i].y - ny * halfWidth });
    }

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i += 1) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(138, 182, 166, 0.2)";
    ctx.fill();

    ctx.strokeStyle = "rgba(231, 237, 244, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  return { start, stop, renderStatic };
}
