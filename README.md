# The Oche — Darts Club

Complete source from the published darts game, including the settings update with both throwing mechanics.

## Run locally

The game uses standard JavaScript modules, so serve the folder over HTTP rather than opening `index.html` directly.

1. Extract the ZIP.
2. Open a terminal inside the `the-oche` folder.
3. If Python is installed, start a local server:

   Windows:
   ```sh
   py -m http.server 8000
   ```

   macOS/Linux:
   ```sh
   python3 -m http.server 8000
   ```

   If Windows provides `python` instead of `py`, use `python -m http.server 8000`.

4. Open http://localhost:8000 in your browser.
5. Press Ctrl+C in the terminal to stop the server.

Any static web server can serve this folder. There is no build step, dependency installation, backend, API key, or paid service required by the game.

## Included game features

- 501 and 301 with double-out finishes and whole-visit bust restoration.
- Computer opponents at Casual, Club, and Expert difficulty.
- Local two-player pass-and-play and free practice.
- One-leg, best-of-three, and best-of-five matches.
- Visit history, three-dart averages, and checkout suggestions.
- Mouse, touch, and keyboard controls; optional synthesised audio.
- Settings to switch throwing mechanics during a match.

### Original throwing

Tap or drag on the board to aim. Hold the throw button or Space, then release in the gold zone. Arrow keys move the aim when the board has focus; Shift gives finer adjustments.

### Three-stage throwing

1. Press the main button or Space to stop the moving height guide.
2. Press again to stop the moving direction guide.
3. Hold the main button or Space, then release in the green zone, around 65%.
4. Press Next dart to line up again, or continue after the visit ends.

The aiming-speed slider is in Settings. The default speed is 0.45. The slower charge timing and radial scatter come from the supplied throwing prototype. Its guide travel is adapted to reach the inner double ring on this board. The game's match scoring remains the same in both modes.

## Source files

| File | Purpose |
| --- | --- |
| `index.html` | Game screen, score panels, settings, instructions, and dialogs |
| `style.css` | Theme, desktop/mobile layout, and control styling |
| `game.js` | Game state, input, canvas rendering, computer turns, and sound |
| `engine.js` | Dartboard scoring, busts, double-out, and checkout routes |
| `throwing.js` | Three-stage guide movement, charge timing, and release scatter |

These are the readable source files used by the live site, not a compiled bundle. The canvas draws the board and darts; Web Audio produces the sounds. There are no separate image or sound assets.

Throwing preferences are saved locally on the device. Match progress is held in memory and resets when the page is reloaded. The optional page-scoped agent tools are feature-detected and are not required in normal browsers.

## Put it in a repository or host it

Use the contents of this folder as the repository root. `index.html` is the entry point. Deploy the same folder on any static host; no build command is needed. The export does not include the original site's private hosting identity or Git metadata.

## Export version

Published source commit: `ca47c832ad6ba9d1fe85554d510bc88050af70d8`
Export date: 8 October 2026
Live site: https://the-oche-darts.thehardway1-yt.chatgpt.site
