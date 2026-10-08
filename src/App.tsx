import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createGame, DEFAULT_VIEW } from "./game/controller";
import type { GameController, GameElements } from "./game/types";
import { GameBoard } from "./components/GameBoard";
import { MatchPanel } from "./components/MatchPanel";
import { Dialogs } from "./components/Dialogs";

const emptySubscribe = () => () => {};
const initialSnapshot = () => DEFAULT_VIEW;

export function App() {
  const [game, setGame] = useState<GameController | null>(null);
  const view = useSyncExternalStore(
    game?.subscribe ?? emptySubscribe,
    game?.getSnapshot ?? initialSnapshot,
  );
  const canvas = useRef<HTMLCanvasElement>(null);
  const announcement = useRef<HTMLDivElement>(null);
  const meterMarker = useRef<HTMLSpanElement>(null);
  const releaseMeter = useRef<HTMLDivElement>(null);
  const throwButton = useRef<HTMLButtonElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const setupDialog = useRef<HTMLDialogElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const resultDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (
      !canvas.current ||
      !announcement.current ||
      !meterMarker.current ||
      !releaseMeter.current ||
      !throwButton.current ||
      !settingsDialog.current ||
      !setupDialog.current ||
      !helpDialog.current ||
      !resultDialog.current
    )
      return;
    const elements: GameElements = {
      canvas: canvas.current,
      announcement: announcement.current,
      meterMarker: meterMarker.current,
      releaseMeter: releaseMeter.current,
      throwButton: throwButton.current,
      dialogs: {
        "settings-dialog": settingsDialog.current,
        "setup-dialog": setupDialog.current,
        "help-dialog": helpDialog.current,
        "result-dialog": resultDialog.current,
      },
    };
    const controller = createGame(elements);
    setGame(controller);
    return () => controller.dispose();
  }, []);

  const practice = view.settings.mode === "practice";
  const prototype = view.controls.mechanic === "prototype";
  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <a className="wordmark" href="./" aria-label="The Oche home">
            <span className="brand-target" aria-hidden="true">
              ◎
            </span>
            <span>
              THE OCHE<small>DARTS CLUB</small>
            </span>
          </a>
          <nav aria-label="Game controls">
            <button
              id="help-button"
              className="quiet-button"
              onClick={() => game?.openDialog("help-dialog")}
            >
              How to play
            </button>
            <button
              id="settings-button"
              className="quiet-button"
              aria-label="Settings"
              onClick={() => game?.openDialog("settings-dialog")}
            >
              <span className="settings-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="settings-button-label">Settings</span>
            </button>
            <button
              id="new-game"
              className="outline-button"
              onClick={() => game?.openDialog("setup-dialog")}
            >
              New game
            </button>
          </nav>
        </header>
        <main>
          <div className="match-heading">
            <div>
              <span className="eyebrow">STEP UP TO THE LINE</span>
              <h1 id="mode-heading">
                {practice ? "Practice" : view.settings.mode}{" "}
                <span>{practice ? "Find your range" : "Double out"}</span>
              </h1>
            </div>
            <div className="match-meta">
              <span id="match-format">
                {practice
                  ? "FREE PRACTICE"
                  : view.settings.legs === 1
                    ? "SINGLE LEG"
                    : `BEST OF ${view.settings.legs} LEGS`}
              </span>
              <strong id="leg-label">
                {practice
                  ? `${view.state.players[view.state.current].darts} darts thrown`
                  : `Leg ${view.state.leg}`}
              </strong>
            </div>
          </div>
          <div className="game-layout">
            <GameBoard
              view={view}
              canvasRef={canvas}
              announcementRef={announcement}
            />
            <MatchPanel
              game={game}
              view={view}
              meterMarkerRef={meterMarker}
              releaseMeterRef={releaseMeter}
              throwButtonRef={throwButton}
            />
          </div>
          <footer>
            <span>A LITTLE TOUCH. A LITTLE NERVE.</span>
            <span id="footer-controls">
              {prototype
                ? "Stop height · Stop direction · Hold and release"
                : "Tap to aim · Hold to draw · Release to throw"}
            </span>
          </footer>
        </main>
      </div>
      <Dialogs
        game={game}
        view={view}
        settingsRef={settingsDialog}
        setupRef={setupDialog}
        helpRef={helpDialog}
        resultRef={resultDialog}
      />
    </>
  );
}
