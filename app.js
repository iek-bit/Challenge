import {
  createMouseCircleGame,
  createMouseCirclePreview,
} from "./games/mouseCircleGame.js";
import {
  createPrecisionClicksGame,
  createPrecisionClicksPreview,
} from "./games/precisionClicksGame.js";
import {
  createTimingBarGame,
  createTimingBarPreview,
} from "./games/timingBarGame.js";
import {
  createFollowPathGame,
  createFollowPathPreview,
} from "./games/followPathGame.js";
import {
  createDodgeFieldGame,
  createDodgeFieldPreview,
} from "./games/dodgeFieldGame.js";

const TAGS = ["Skill", "Speed", "Control"];

const gameRegistry = {
  "racing-mode": {
    title: "Racing Mode",
    description: "Try to beat your best time on challenging tracks",
    tags: ["Speed", "Control"],
    icon: "racing",
    // Racing Mode now launches an iframe; the previous canvas game code was removed.
    infoText: "Steer left and right to stay on the track as speed builds.",
  },
  "mouse-circle": {
    title: "Mouse in Circle",
    description: "Keep the cursor inside a drifting, shrinking circle.",
    tags: ["Control", "Skill"],
    icon: "circle",
    createGame: () => createMouseCircleGame(sharedGameEnv),
    createPreview: (canvas) => createMouseCirclePreview(canvas),
    infoText: "Keep the cursor inside a morphing shape as it darts around.",
  },
  "block-tower": {
    title: "Block Tower",
    description: "Climb a collapsing tower with tight platforming control.",
    tags: ["Skill"],
    icon: "tower",
    createGame: () => createBlockTowerGame(),
    infoText: "Survive falling blocks and climb higher each round.",
  },
  "precision-clicks": {
    title: "Precision Clicks",
    description: "Hit fast targets before they blink away.",
    tags: ["Skill", "Speed"],
    icon: "target",
    createGame: () => createPrecisionClicksGame(sharedGameEnv),
    createPreview: (canvas) => createPrecisionClicksPreview(canvas),
    infoText: "Click true targets quickly. Decoys look similar but cost points.",
  },
  "timing-bar": {
    title: "Timing Bar",
    description: "Tap when the slider hits the sweet spot.",
    tags: ["Speed", "Skill"],
    icon: "timing",
    createGame: () => createTimingBarGame(sharedGameEnv),
    createPreview: (canvas) => createTimingBarPreview(canvas),
    infoText: "Stop the slider inside the target window.",
  },
  "follow-path": {
    title: "Follow the Path",
    description: "Stay within a moving corridor.",
    tags: ["Control"],
    icon: "path",
    createGame: () => createFollowPathGame(sharedGameEnv),
    createPreview: (canvas) => createFollowPathPreview(canvas),
    infoText: "Guide the cursor through a moving corridor without leaving it.",
  },
  "dodge-field": {
    title: "Dodge Field",
    description: "Avoid incoming hazards as the difficulty increases.",
    tags: ["Control", "Speed"],
    icon: "dodge",
    createGame: () => createDodgeFieldGame(sharedGameEnv),
    createPreview: (canvas) => createDodgeFieldPreview(canvas),
    infoText: "Dodge waves of hazards as they speed up and begin to curve.",
  },
  "missile-command": {
    title: "Missile Command",
    description: "Defend your cities by intercepting incoming missile waves.",
    tags: ["Skill", "Control"],
    icon: "missile",
    createGame: () => createMissileCommandGame(),
    infoText: "Protect the cities, manage launcher ammo, and survive longer waves.",
  },
};

const startButton = document.getElementById("startButton");
const tagLinks = document.getElementById("tagLinks");
const gameList = document.getElementById("gameList");
const homeScreen = document.querySelector('[data-view="home"]');
const selectScreen = document.querySelector('[data-view="select"]');
const gameScreen = document.querySelector('[data-view="game"]');
const gameCanvas = document.getElementById("gameCanvas");
const scoreReadout = document.getElementById("scoreReadout");
const missedReadout = document.getElementById("missedReadout");
const gameOver = document.getElementById("gameOver");
const gameOverScore = document.getElementById("gameOverScore");
const continueButton = document.getElementById("continueButton");
const exitButton = document.getElementById("exitButton");
const infoModal = document.getElementById("infoModal");
const infoScrim = document.getElementById("infoScrim");
const infoClose = document.getElementById("infoClose");
const infoTitle = document.getElementById("infoTitle");
const infoText = document.getElementById("infoText");
const infoCanvas = document.getElementById("infoCanvas");
const heartsReadout = document.getElementById("heartsReadout");
const gameModuleMount = document.getElementById("gameModuleMount");

const sharedGameEnv = {
  gameCanvas,
  gameScreen,
  scoreReadout,
  missedReadout,
  heartsReadout,
  onGameOver: (scoreText) => {
    GameController.gameOverScreen(scoreText);
  },
};

document.body.classList.add("home-active");

const HIGHSCORE_PREFIX = "challenge_highscore_";
const safeStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures so the games continue to work.
    }
  },
};

function getHighScore(gameId) {
  const raw = safeStorage.get(`${HIGHSCORE_PREFIX}${gameId}`);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function setHighScore(gameId, scoreValue) {
  if (!Number.isFinite(scoreValue)) return;
  const existing = getHighScore(gameId);
  if (existing === null || scoreValue > existing) {
    safeStorage.set(`${HIGHSCORE_PREFIX}${gameId}`, String(scoreValue));
  }
}

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
  racing: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <path d="M18 70 L34 48 L86 48 L102 70"></path>
      <path d="M34 48 L42 30 L78 30 L86 48"></path>
      <line x1="26" y1="70" x2="18" y2="80"></line>
      <line x1="94" y1="70" x2="102" y2="80"></line>
      <circle cx="34" cy="78" r="8"></circle>
      <circle cx="86" cy="78" r="8"></circle>
    </svg>
  `,
  tower: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <rect x="36" y="20" width="48" height="80"></rect>
      <rect x="30" y="34" width="12" height="18"></rect>
      <rect x="78" y="34" width="12" height="18"></rect>
      <rect x="52" y="56" width="16" height="20"></rect>
      <line x1="30" y1="100" x2="90" y2="100"></line>
    </svg>
  `,
  missile: () => `
    <svg class="game-icon" viewBox="0 0 120 120" fill="none" stroke-width="2">
      <path d="M18 92 L42 64"></path>
      <path d="M42 64 L54 72"></path>
      <path d="M42 64 L50 52"></path>
      <path d="M62 28 L78 44"></path>
      <path d="M78 44 L86 36"></path>
      <path d="M78 44 L70 52"></path>
      <circle cx="54" cy="72" r="12"></circle>
      <circle cx="86" cy="36" r="8"></circle>
      <path d="M32 100 H88"></path>
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

      const previewCanvas = document.createElement("canvas");
      previewCanvas.className = "game-preview";

      const chip = document.createElement("div");
      chip.className = "tag-chip";
      chip.textContent = game.tags.join(" / ");

      const title = document.createElement("h3");
      title.textContent = game.title;

      const desc = document.createElement("p");
      desc.textContent = game.description;

      let highscore = null;
      if (gameId !== "racing-mode") {
        highscore = document.createElement("div");
        highscore.className = "game-highscore";
        const storedScore = getHighScore(gameId);
        highscore.textContent = storedScore === null ? "High: --" : `High: ${formatHighScore(storedScore)}`;
      }

      card.innerHTML = iconFactory[game.icon]?.() ?? "";
      card.appendChild(previewCanvas);
      card.appendChild(chip);
      card.appendChild(title);
      card.appendChild(desc);
      if (highscore) {
        card.appendChild(highscore);
      }

      grid.appendChild(card);

      HoverPreviewController.init(card, gameId);
      card.addEventListener("mouseenter", () => {
        HoverPreviewController.start(card);
      });
      card.addEventListener("mouseleave", () => {
        HoverPreviewController.stop(card);
      });
      card.addEventListener("focus", () => {
        HoverPreviewController.start(card);
      });
      card.addEventListener("blur", () => {
        HoverPreviewController.stop(card);
      });
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

  infoScrim.addEventListener("click", () => {
    GamePreviewController.close();
  });

  infoClose.addEventListener("click", () => {
    GamePreviewController.close();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!infoModal.classList.contains("is-hidden")) {
      GamePreviewController.close();
      return;
    }
    const racingOverlay = document.getElementById("racingIframeOverlay");
    if (racingOverlay) {
      closeRacingIframe();
      return;
    }
    if (!gameScreen.classList.contains("is-hidden")) {
      GameController.stop();
    }
  });
}

const GameController = (() => {
  let currentGame = null;
  let currentGameId = null;

  function resetHudState() {
    missedReadout.classList.remove("is-collapsed");
    missedReadout.textContent = "Missed 0/3";
    heartsReadout.classList.add("is-hidden");
    heartsReadout.textContent = "❤❤❤";
  }

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

    GamePreviewController.close();
    closeRacingIframe();
    if (currentGame) {
      currentGame.stop();
    }

    showView(gameScreen);
    gameOver.classList.add("is-hidden");
    resetHudState();
    document.body.classList.add("game-active");
    currentGameId = gameId;
    currentGame = gameConfig.createGame();
    currentGame.start();
  }

  function stop() {
    GamePreviewController.close();
    closeRacingIframe();
    if (currentGame) {
      currentGame.stop();
      currentGame = null;
    }
    currentGameId = null;
    document.body.classList.remove("game-active");
    showView(selectScreen);
    gameOver.classList.add("is-hidden");
    resetHudState();
  }

  function gameOverScreen(scoreText) {
    if (currentGameId) {
      const parsedScore = parseScoreValue(scoreText);
      setHighScore(currentGameId, parsedScore);
      updateCardHighScore(currentGameId);
    }
    if (currentGame) {
      currentGame.stop();
      currentGame = null;
    }
    currentGameId = null;
    gameOverScore.textContent = `Score ${scoreText}`;
    gameOver.classList.remove("is-hidden");
    document.body.classList.remove("game-active");
    resetHudState();
  }

  return { start, stop, gameOverScreen };
})();

function setupGameCards() {
  gameList.addEventListener("click", (event) => {
    const button = event.target.closest(".game-card");
    if (!button) return;
    const gameId = button.dataset.gameId;
    if (gameId === "racing-mode") {
      insertRacingIframe(button);
      return;
    }
    GameController.start(gameId);
  });
}

function insertRacingIframe(button) {
  // The old Racing Mode canvas game code was removed from this file in favor of an iframe embed.
  // Prevent duplicate iframes if the Racing Mode button is clicked multiple times.
  if (document.getElementById("racingIframeOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "racingIframeOverlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "40";
  overlay.style.background = "rgba(6, 7, 8, 0.92)";
  overlay.style.display = "grid";
  overlay.style.placeItems = "center";

  const frameWrap = document.createElement("div");
  frameWrap.style.width = "100%";
  frameWrap.style.height = "100%";
  frameWrap.style.overflow = "hidden";

  const iframe = document.createElement("iframe");
  iframe.src = "https://vectorgp.run/";
  iframe.title = "Racing Mode";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.setAttribute("loading", "lazy");

  const exit = document.createElement("button");
  exit.type = "button";
  exit.textContent = "Exit";
  exit.style.position = "absolute";
  exit.style.top = "18px";
  exit.style.right = "18px";
  exit.style.border = "1px solid rgba(226, 230, 234, 0.2)";
  exit.style.background = "rgba(6, 7, 8, 0.85)";
  exit.style.color = "#e2e6ea";
  exit.style.padding = "10px 18px";
  exit.style.borderRadius = "999px";
  exit.style.cursor = "pointer";
  exit.style.textTransform = "uppercase";
  exit.style.letterSpacing = "0.12em";
  exit.style.fontSize = "12px";

  exit.addEventListener("click", () => {
    closeRacingIframe();
  });

  frameWrap.appendChild(iframe);
  overlay.appendChild(frameWrap);
  overlay.appendChild(exit);

  // Insert fullscreen overlay into the page.
  document.body.classList.add("game-active");
  document.body.appendChild(overlay);
}

function closeRacingIframe() {
  const overlay = document.getElementById("racingIframeOverlay");
  if (!overlay) return;
  overlay.remove();
  if (gameScreen.classList.contains("is-hidden")) {
    document.body.classList.remove("game-active");
  }
}

function createBlockTowerGame() {
  let moduleRef = null;
  let started = false;
  let previousHudDisplay = "";

  function start() {
    const hud = document.querySelector(".game-hud");
    if (hud) {
      previousHudDisplay = hud.style.display;
      hud.style.display = "none";
    }
    missedReadout.classList.add("is-collapsed");
    heartsReadout.classList.add("is-hidden");
    import("./games/blockTower.js")
      .then((mod) => {
        moduleRef = mod;
        started = true;
        moduleRef.start(gameCanvas, () => {
          GameController.stop();
        });
      })
      .catch((error) => {
        console.error("Unable to load Block Tower.", error);
        if (hud) {
          hud.style.display = previousHudDisplay || "";
        }
        missedReadout.classList.remove("is-collapsed");
        window.alert("Block Tower could not be loaded.");
      });
  }

  function stop() {
    if (moduleRef && started) {
      moduleRef.stop();
    }
    moduleRef = null;
    started = false;
    const hud = document.querySelector(".game-hud");
    if (hud) {
      hud.style.display = previousHudDisplay || "";
    }
  }

  return { start, stop };
}

function createMissileCommandGame() {
  let moduleRef = null;
  let started = false;
  let previousHudDisplay = "";
  let previousCanvasDisplay = "";
  let bestScore = 0;

  function start() {
    const hud = document.querySelector(".game-hud");
    if (hud) {
      previousHudDisplay = hud.style.display;
      hud.style.display = "none";
    }
    previousCanvasDisplay = gameCanvas.style.display;
    gameCanvas.style.display = "none";
    gameOver.classList.add("is-hidden");
    gameModuleMount.classList.remove("is-hidden");
    bestScore = 0;
    import("./games/missileCommand.js")
      .then((mod) => {
        moduleRef = mod;
        started = true;
        moduleRef.start(gameModuleMount, {
          onExit: () => {
            GameController.stop();
          },
          onScoreChange: (scoreValue) => {
            if (Number.isFinite(scoreValue)) {
              bestScore = Math.max(bestScore, scoreValue);
            }
          },
          onGameOver: (scoreValue) => {
            if (!Number.isFinite(scoreValue)) return;
            bestScore = Math.max(bestScore, scoreValue);
            setHighScore("missile-command", bestScore);
            updateCardHighScore("missile-command");
          },
        });
      })
      .catch((error) => {
        console.error("Unable to load Missile Command.", error);
        cleanupView();
        window.alert("Missile Command could not be loaded.");
      });
  }

  function cleanupView() {
    gameModuleMount.classList.add("is-hidden");
    gameModuleMount.replaceChildren();
    gameCanvas.style.display = previousCanvasDisplay || "";
    const hud = document.querySelector(".game-hud");
    if (hud) {
      hud.style.display = previousHudDisplay || "";
    }
  }

  function stop() {
    if (moduleRef && started) {
      moduleRef.stop();
    }
    moduleRef = null;
    started = false;
    cleanupView();
  }

  return { start, stop };
}

function parseScoreValue(scoreText) {
  if (typeof scoreText === "number") return scoreText;
  const cleaned = String(scoreText).replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

function formatHighScore(value) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--";
}

function updateCardHighScore(gameId) {
  if (gameId === "racing-mode") return;
  const card = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
  if (!card) return;
  const label = card.querySelector(".game-highscore");
  if (!label) return;
  const storedScore = getHighScore(gameId);
  label.textContent = storedScore === null ? "High: --" : `High: ${formatHighScore(storedScore)}`;
}

const GamePreviewController = (() => {
  let preview = null;

  function open(gameId) {
    const game = gameRegistry[gameId];
    if (!game) return;
    infoTitle.textContent = game.title;
    infoText.textContent = game.infoText ?? "";
    infoModal.classList.remove("is-hidden");
    startPreview(game);
  }

  function close() {
    if (preview) {
      preview.stop();
      preview = null;
    }
    infoModal.classList.add("is-hidden");
  }

  function startPreview(game) {
    if (preview) {
      preview.stop();
      preview = null;
    }
    if (game.createPreview) {
      preview = game.createPreview(infoCanvas);
      preview.start();
      return;
    }
    const ctx = infoCanvas.getContext("2d");
    ctx.clearRect(0, 0, infoCanvas.width, infoCanvas.height);
    ctx.fillStyle = "#060708";
    ctx.fillRect(0, 0, infoCanvas.width, infoCanvas.height);
  }

  return { open, close };
})();

const HoverPreviewController = (() => {
  const previews = new WeakMap();
  const trackedCards = new Set();

  function initializePreview(card, game) {
    const canvas = card.querySelector(".game-preview");
    if (!canvas) return;
    const existing = previews.get(card);
    if (existing) {
      existing.stop?.();
    }
    resizeCanvasToCard(canvas, card);
    const instance = game.createPreview(canvas);
    if (instance.renderStatic) {
      instance.renderStatic();
    }
    previews.set(card, instance);
  }

  function init(card, gameId) {
    const game = gameRegistry[gameId];
    if (!game || !game.createPreview) return;
    trackedCards.add(card);
    let attempts = 0;
    const tryInit = () => {
      const rect = card.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        if (attempts < 6) {
          attempts += 1;
          requestAnimationFrame(tryInit);
        }
        return;
      }
      initializePreview(card, game);
    };
    requestAnimationFrame(tryInit);
  }

  function start(card) {
    const instance = previews.get(card);
    if (!instance) return;
    instance.start();
  }

  function stop(card) {
    const instance = previews.get(card);
    if (instance) {
      instance.stop();
    }
  }

  function refreshAll() {
    trackedCards.forEach((card) => {
      if (!document.body.contains(card)) {
        trackedCards.delete(card);
        return;
      }
      const gameId = card.dataset.gameId;
      const game = gameRegistry[gameId];
      if (!game || !game.createPreview) return;
      initializePreview(card, game);
    });
  }

  function resizeCanvasToCard(canvas, card) {
    const rect = card.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", refreshAll);

  return { init, start, stop, refreshAll };
})();

buildTagLinks();
buildGameSections();
setupNavigation();
setupGameCards();
