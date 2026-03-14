const TAGS = ["Skill", "Speed", "Control"];

const gameRegistry = {
  "mouse-circle": {
    title: "Mouse in Circle",
    description: "Keep the cursor inside a drifting, shrinking circle.",
    tags: ["Control", "Skill"],
    icon: "circle",
    createGame: () => createMouseCircleGame(),
  },
  "precision-clicks": {
    title: "Precision Clicks",
    description: "Hit fast targets before they blink away.",
    tags: ["Skill", "Speed"],
    icon: "target",
    createGame: () => createPrecisionClicksGame(),
  },
  "timing-bar": {
    title: "Timing Bar",
    description: "Tap when the slider hits the sweet spot.",
    tags: ["Speed", "Skill"],
    icon: "timing",
    createGame: () => createTimingBarGame(),
  },
  "follow-path": {
    title: "Follow the Path",
    description: "Stay within a moving corridor.",
    tags: ["Control"],
    icon: "path",
  },
  "dodge-field": {
    title: "Dodge Field",
    description: "Avoid incoming hazards as the arena tightens.",
    tags: ["Control", "Speed"],
    icon: "dodge",
  },
};

const startButton = document.getElementById("startButton");
const tagLinks = document.getElementById("tagLinks");
const gameList = document.getElementById("gameList");
const homeScreen = document.querySelector('[data-view="home"]');
const selectScreen = document.querySelector('[data-view="select"]');
const gameScreen = document.querySelector('[data-view="game"]');
const gameCanvas = document.getElementById("gameCanvas");
const progressFill = document.getElementById("difficultyProgress");
const scoreReadout = document.getElementById("scoreReadout");
const missedReadout = document.getElementById("missedReadout");
const gameOver = document.getElementById("gameOver");
const gameOverScore = document.getElementById("gameOverScore");
const continueButton = document.getElementById("continueButton");
const exitButton = document.getElementById("exitButton");

document.body.classList.add("home-active");

const iconFactory = {
  circle: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <circle cx="60" cy="60" r="34"></circle>
      <circle cx="60" cy="60" r="18"></circle>
      <circle cx="60" cy="60" r="6"></circle>
    </svg>
  `,
  target: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <circle cx="60" cy="60" r="34"></circle>
      <circle cx="60" cy="60" r="20"></circle>
      <line x1="12" y1="60" x2="32" y2="60"></line>
      <line x1="88" y1="60" x2="108" y2="60"></line>
      <line x1="60" y1="12" x2="60" y2="32"></line>
      <line x1="60" y1="88" x2="60" y2="108"></line>
    </svg>
  `,
  timing: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <rect x="18" y="54" width="84" height="12" rx="6"></rect>
      <rect x="48" y="46" width="24" height="28" rx="6"></rect>
      <line x1="24" y1="60" x2="96" y2="60"></line>
    </svg>
  `,
  path: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <path d="M16 30 C40 10, 80 10, 104 30"></path>
      <path d="M16 90 C40 70, 80 70, 104 90"></path>
      <path d="M20 60 C40 48, 80 48, 100 60"></path>
    </svg>
  `,
  dodge: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <rect x="18" y="18" width="84" height="84" rx="18"></rect>
      <line x1="28" y1="36" x2="92" y2="36"></line>
      <line x1="28" y1="60" x2="92" y2="60"></line>
      <line x1="28" y1="84" x2="92" y2="84"></line>
    </svg>
  `,
};

function buildTagLinks() {
  TAGS.forEach((tag) => {
    const link = document.createElement("a");
    link.href = `#tag-${tag.toLowerCase()}`;
    link.textContent = tag;
    tagLinks.appendChild(link);
  });
}

function buildGameSections() {
  TAGS.forEach((tag) => {
    const section = document.createElement("section");
    section.className = "tag-section";
    section.id = `tag-${tag.toLowerCase()}`;

    const heading = document.createElement("div");
    heading.className = "tag-heading";
    heading.textContent = tag;

    const grid = document.createElement("div");
    grid.className = "game-grid";

    Object.entries(gameRegistry).forEach(([gameId, game]) => {
      const primaryTag = game.tags[0];
      if (primaryTag !== tag) return;

      const card = document.createElement("button");
      card.className = "game-card";
      card.type = "button";
      card.dataset.gameId = gameId;

      const chip = document.createElement("div");
      chip.className = "tag-chip";
      chip.textContent = game.tags.join(" / ");

      const title = document.createElement("h3");
      title.textContent = game.title;

      const desc = document.createElement("p");
      desc.textContent = game.description;

      card.innerHTML = iconFactory[game.icon]?.() ?? "";
      card.appendChild(chip);
      card.appendChild(title);
      card.appendChild(desc);

      grid.appendChild(card);
    });

    section.appendChild(heading);
    section.appendChild(grid);
    gameList.appendChild(section);
  });
}

function setupNavigation() {
  startButton.addEventListener("click", () => {
    homeScreen.classList.add("is-hidden");
    selectScreen.classList.remove("is-hidden");
    document.body.classList.remove("home-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  exitButton.addEventListener("click", () => {
    GameController.stop();
  });

  continueButton.addEventListener("click", () => {
    GameController.stop();
  });
}

const GameController = (() => {
  let currentGame = null;

  function showView(view) {
    const views = [homeScreen, selectScreen, gameScreen];
    views.forEach((section) => {
      if (section === view) {
        section.classList.remove("is-hidden");
      } else {
        section.classList.add("is-hidden");
      }
    });
  }

  function start(gameId) {
    const gameConfig = gameRegistry[gameId];
    if (!gameConfig || !gameConfig.createGame) {
      window.alert("This game is still in development.");
      return;
    }

    if (currentGame) {
      currentGame.stop();
    }

    showView(gameScreen);
    gameOver.classList.add("is-hidden");
    document.body.classList.add("game-active");
    currentGame = gameConfig.createGame();
    currentGame.start();
  }

  function stop() {
    if (currentGame) {
      currentGame.stop();
      currentGame = null;
    }
    document.body.classList.remove("game-active");
    showView(selectScreen);
    gameOver.classList.add("is-hidden");
  }

  function gameOverScreen(scoreText) {
    if (currentGame) {
      currentGame.stop();
      currentGame = null;
    }
    gameOverScore.textContent = `Score ${scoreText}`;
    gameOver.classList.remove("is-hidden");
    document.body.classList.remove("game-active");
  }

  return { start, stop, gameOverScreen };
})();

function setupGameCards() {
  gameList.addEventListener("click", (event) => {
    const button = event.target.closest(".game-card");
    if (!button) return;
    const gameId = button.dataset.gameId;
    GameController.start(gameId);
  });
}

function createMouseCircleGame() {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  let elapsed = 0;
  let stepTimer = 0;
  let timeLeft = 30;
  let totalDifficulty = 0;

  const stepDuration = 5;
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
    bgColor: "#0b0e13",
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
    stepTimer = 0;
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
    state.morphTime = 0;
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
    if (!state.started) {
      if (isCursorInsideShape(0.55)) {
        state.started = true;
        elapsed = 0;
        stepTimer = 0;
        totalDifficulty = 0;
        const minSize = currentMinSize();
        const maxSize = currentMaxSize();
        state.sizePhase = 0.25;
        state.currentRadius = (minSize + maxSize) * 0.5;
      }
    }

    if (state.started) {
      updateMotion(dt);
      updateMorph(dt);
      updateSizePulse(dt);
      elapsed += dt;
      stepTimer += dt;

      if (stepTimer >= stepDuration) {
        stepTimer -= stepDuration;
        applyDifficultyStep();
      }

      checkCollision();
      const drainRate = 1 + clamp(totalDifficulty * 0.02, 0, 0.5);
      timeLeft = Math.max(0, timeLeft - dt * drainRate);
      if (timeLeft <= 0) {
        const scoreText = scoreReadout.textContent;
        GameController.gameOverScreen(scoreText);
        return;
      }
    }

    updateBackground();
    updateScore();
    render();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function applyDifficultyStep() {
    const options = ["speed", "size", "morph", "drift"];
    const pick = options[Math.floor(Math.random() * options.length)];
    const magnitude = difficultyStepMagnitude(elapsed);

    if (pick === "speed") state.speedDifficulty += magnitude;
    if (pick === "size") state.sizeDifficulty += magnitude;
    if (pick === "morph") state.morphDifficulty += magnitude;
    if (pick === "drift") state.driftDifficulty += magnitude;
    totalDifficulty += magnitude;
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

  function updateBackground() {
    state.bgColor = "#060708";
  }

  function updateScore() {
    const score = elapsed * 100;
    scoreReadout.textContent = score.toFixed(2).padStart(7, "0");
    const progress = clamp(stepTimer / stepDuration, 0, 1);
    progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
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
      const scoreText = scoreReadout.textContent;
      GameController.gameOverScreen(scoreText);
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

  function rotateVelocity(delta) {
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    const vx = state.velocity.x * cos - state.velocity.y * sin;
    const vy = state.velocity.x * sin + state.velocity.y * cos;
    const len = Math.hypot(vx, vy) || 1;
    state.velocity.x = vx / len;
    state.velocity.y = vy / len;
  }

  function normalizeVelocity() {
    const len = Math.hypot(state.velocity.x, state.velocity.y) || 1;
    state.velocity.x /= len;
    state.velocity.y /= len;
  }

  return { start, stop };
}

function createPrecisionClicksGame() {
  let running = false;
  let animationId = null;
  let lastTime = 0;
  let gameTime = 0;
  let stepTimer = 0;
  let spawnTimer = 0;
  let score = 0;
  let streak = 0;
  let started = false;
  let missedTargets = 0;
  let graceTime = 0;
  let totalDifficulty = 0;
  let timeLeft = 30;

  const stepDuration = 5;
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
    bgColor: "#0b0e13",
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
    stepTimer = 0;
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
      stepTimer += dt;
      spawnTimer += dt;

      const drainRate = 1 + clamp(totalDifficulty * 0.03, 0, 0.5);
      timeLeft = Math.max(0, timeLeft - dt * drainRate);
      if (timeLeft <= 0) {
        const scoreText = score.toString().padStart(6, "0");
        GameController.gameOverScreen(scoreText);
        return;
      }

      if (graceTime > 0) {
        graceTime = Math.max(0, graceTime - dt);
      } else {
        if (stepTimer >= stepDuration) {
          stepTimer -= stepDuration;
          applyDifficultyStep();
        }
      }

      const interval = currentSpawnInterval();
      if (spawnTimer >= interval) {
        spawnTimer -= interval;
        spawnTarget(false);
      }

      expireTargets();
    }

    updateBackground();
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
        const scoreText = score.toString().padStart(6, "0");
        GameController.gameOverScreen(scoreText);
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
      stepTimer = 0;
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
            const scoreText = score.toString().padStart(6, "0");
            GameController.gameOverScreen(scoreText);
            return;
          }
        }
      }
    }
  }

  function applyDifficultyStep() {
    const options = ["spawn", "size", "life", "decoy"];
    const pick = options[Math.floor(Math.random() * options.length)];
    const magnitude = difficultyStepMagnitude(gameTime);

    if (pick === "spawn") difficulty.spawn += magnitude;
    if (pick === "size") difficulty.size += magnitude;
    if (pick === "life") difficulty.life += magnitude;
    if (pick === "decoy") difficulty.decoy += magnitude;
    totalDifficulty += magnitude;
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

  function updateBackground() {
    state.bgColor = "#060708";
  }

  function updateHud() {
    scoreReadout.textContent = score.toString().padStart(6, "0");
    missedReadout.textContent = `Missed ${missedTargets}/${maxMissed}`;
    const progress = started ? clamp(stepTimer / stepDuration, 0, 1) : 0;
    progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
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

function createTimingBarGame() {
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
    bgColor: "#0b0e13",
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
        const scoreText = score.toString().padStart(6, "0");
        GameController.gameOverScreen(scoreText);
        return;
      }

      updateZone(dt);
    }

    updateBackground();
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
        const scoreText = score.toString().padStart(6, "0");
        GameController.gameOverScreen(scoreText);
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
    if (stepCount < 5) {
      return;
    }
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

  function updateBackground() {
    state.bgColor = "#060708";
  }

  function updateHud() {
    scoreReadout.textContent = score.toString().padStart(6, "0");
    missedReadout.textContent = `Missed ${missed}/${maxMissed}`;
    const progress = started ? clamp(stepTimer / stepDuration, 0, 1) : 0;
    progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
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

function polygonRadius(angle, sides) {
  const slice = (Math.PI * 2) / sides;
  const rotated = (angle + Math.PI) % (Math.PI * 2);
  const offset = (rotated % slice) - slice / 2;
  return Math.cos(slice / 2) / Math.cos(offset);
}

function nextShapeIndex(current, total) {
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * total);
  }
  return next;
}

function difficultyStepMagnitude(elapsedSeconds) {
  if (elapsedSeconds < 5) {
    return 0.0;
  }
  if (elapsedSeconds < 18) {
    return 3.4;
  }
  if (elapsedSeconds < 35) {
    return 2.0;
  }
  return 1.3;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b2 = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b2})`;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function calcLuminance(color) {
  const match = color.match(/\d+/g);
  if (!match) return 0;
  const [r, g, b] = match.map((value) => Number(value) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

buildTagLinks();
buildGameSections();
setupNavigation();
setupGameCards();
