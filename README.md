# Challenge

A browser-based arcade hub with multiple reflex and cursor-control minigames, local high-score tracking, responsive layouts, and a shared launcher UI.

## Current Features

- Home screen with centered start flow across desktop, tablet, and mobile layouts.
- Category-based game selection screen with animated preview cards.
- Shared fullscreen game shell for built-in canvas games.
- Support for module-based games with their own HUD and overlays.
- Local high-score persistence for supported games using `localStorage`.
- Escape-key handling for overlays, embedded modes, and active game sessions.
- Responsive layout updates using `100dvh`, flexible card grids, stacked HUD behavior, and safe-area padding support.

## Games

### Skill

- `Mouse in Circle`
  Keep the cursor inside a moving, morphing shape while survival time increases your score.

- `Block Tower`
  Climb a falling-block tower with keyboard/touch platforming controls. Difficulty now ramps using elapsed time instead of frame count, so level progression is more consistent.

- `Precision Clicks`
  Hit real targets quickly, avoid decoys, and survive a progressively faster spawn/lifetime ramp.

- `Missile Command`
  Defend cities from incoming waves of missiles, bombers, and fighters. This game runs as a self-contained module integrated into the shared launcher, with score syncing back to the menu high-score system.

### Speed

- `Racing Mode`
  Launches a fullscreen iframe-based racing experience from the game list.

- `Precision Clicks`
  Shared with `Skill`.

- `Timing Bar`
  Stop the moving slider inside the target zone as speed, feints, and movement increase.

- `Dodge Field`
  Avoid hazard waves that unlock faster and more complex enemy types as difficulty rises.

### Control

- `Mouse in Circle`
  Shared with `Skill`.

- `Racing Mode`
  Shared with `Speed`.

- `Follow the Path`
  Keep the cursor inside a moving corridor while its speed and width vary over time.

- `Dodge Field`
  Shared with `Speed`.

- `Missile Command`
  Shared with `Skill`.

## Controls

- Global
  - `Escape` closes the info modal, exits the racing overlay, or leaves the active game screen.

- `Block Tower`
  - `A` / `D` or `Left` / `Right` to move
  - `Space`, `W`, or `Up` to jump
  - Touch input is supported

- `Timing Bar`
  - Click or press a key to stop the slider

- `Missile Command`
  - Move the mouse to aim
  - Click to fire an interceptor
  - `Escape`, `P`, or the pause button pauses and resumes

- Cursor-based games
  - `Mouse in Circle`, `Precision Clicks`, `Follow the Path`, and `Dodge Field` use pointer movement and/or clicking

## Scoring

- Most games report score through the shared launcher UI and store a per-game high score locally.
- `Racing Mode` does not use the local launcher high-score system.
- `Missile Command` reports score changes and game-over results from its module back into the main app so its game card high score updates correctly.

## Running The Project

This project is primarily a static front-end app.

### Option 1: Open Directly

Open [index.html](/Users/isaac/Desktop/Challenge/index.html) in a browser.

### Option 2: Serve Locally

From the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Project Structure

- [index.html](/Users/isaac/Desktop/Challenge/index.html)
  Main application shell and shared fullscreen game screen.

- [styles.css](/Users/isaac/Desktop/Challenge/styles.css)
  Visual styling, responsive layout rules, HUD/modal styling, and fullscreen module mount styling.

- [app.js](/Users/isaac/Desktop/Challenge/app.js)
  Game registry, launcher UI, preview system, local high-score handling, shared game controller, and built-in minigames.

- [games/blockTower.js](/Users/isaac/Desktop/Challenge/games/blockTower.js)
  Self-contained Block Tower platformer module.

- [games/missileCommand.js](/Users/isaac/Desktop/Challenge/games/missileCommand.js)
  Self-contained Missile Command module with its own HUD, waves, pause state, and callback-based score reporting.

- [main.py](/Users/isaac/Desktop/Challenge/main.py)
  Minimal Python entry point currently used only as a simple placeholder.

## Notes

- The app uses browser `localStorage` for high scores and safely degrades if storage is unavailable.
- Google Fonts are loaded from the stylesheet.
- The repository currently includes both shared-canvas games and module-mounted games, so new minigames can follow either pattern depending on complexity.
