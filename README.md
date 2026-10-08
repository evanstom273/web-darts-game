# The Oche — Darts Club

A React, Vite, Tailwind CSS and TypeScript migration of the published darts game, including both throwing mechanics. The game rules, timing, canvas artwork, theme and responsive layout are preserved.

## Run locally

Install Node.js 24 or newer, then run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173). Press Ctrl+C to stop the server.

```sh
npm test           # Scoring, throwing and React integration regression tests
npm run typecheck  # Strict TypeScript checking, including tests and configuration
npm run build      # Type-check and produce the static site in dist/
npm run preview    # Serve the production build locally
npm run format     # Format source and configuration
```

The built game still runs entirely in the browser, with no backend, API key or paid service.

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
| `index.html`, `src/main.tsx` | HTML metadata and React entry point |
| `src/App.tsx`, `src/components/*.tsx` | Game screen, score panels, settings, instructions and dialogs |
| `src/styles.css` | Original theme and desktop/mobile styling, with compiled Tailwind utilities |
| `src/game/controller.ts` | Typed game state, input, canvas rendering, computer turns and sound |
| `src/game/engine.ts` | Dartboard scoring, busts, double-out and checkout routes |
| `src/game/throwing.ts` | Three-stage guide movement, charge timing and release scatter |
| `src/game/types.ts` | Shared game, UI and optional browser-tool types |
| `vite.config.ts`, `tsconfig.json` | Vite, React, Tailwind and strict TypeScript configuration |
| `tests/` | Scoring and React/gameplay regression coverage |

All application code, tests and build configuration use TypeScript. React subscribes to game updates; the canvas drawing and timing meter stay outside React's render loop. Animation frames, input listeners and optional agent registrations are cleaned up on unmount, including development Strict Mode and hot reloads.

The original stylesheet remains in place. Tailwind is integrated through its Vite plugin with Preflight omitted to preserve the original browser defaults and appearance. The canvas draws the board and darts; Web Audio produces the sounds. There are no separate image or sound assets.

Throwing preferences are saved locally on the device. Match progress is held in memory and resets when the page is reloaded. The optional page-scoped agent tools are feature-detected and are not required in normal browsers.

## Put it in a repository or host it

Use `npm ci` to install dependencies and `npm run build` as the build command. Deploy `dist/` on a static host. Vite uses relative asset URLs, so the build works both at a domain root and under GitHub Pages' `/web-darts-game/` path.

The included GitHub Actions workflow runs tests and the production build for pull requests. Pushes to `main` also deploy the built `dist/` artifact to GitHub Pages.

## Original export provenance

Published source commit: `ca47c832ad6ba9d1fe85554d510bc88050af70d8`
Export date: 8 October 2026
Live site: https://the-oche-darts.thehardway1-yt.chatgpt.site
