import type { RefObject } from "react";
import { scoreAt } from "../game/engine";
import type { GameView } from "../game/types";

interface Props {
  view: GameView;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  announcementRef: RefObject<HTMLDivElement | null>;
}

export function GameBoard({ view, canvasRef, announcementRef }: Props) {
  const computer =
    view.settings.mode !== "practice" &&
    view.settings.opponent === "computer" &&
    view.state.current === 1;
  const prototype = view.controls.mechanic === "prototype" && !computer;
  const step = view.prototypeStep;
  const tip = computer
    ? "House player at the oche"
    : view.state.phase === "turn-end"
      ? "Three darts down. Ready for the next visit?"
      : prototype && view.state.phase === "ready"
        ? step === 0
          ? "1 · Stop the moving line at your chosen height"
          : step === 1
            ? "2 · Stop the sideways line at your chosen position"
            : step === 2
              ? "3 · Hold to charge. Release in green."
              : "Ready to line up the next dart?"
        : "Tap or drag on the board to aim";
  const label = scoreAt(view.aim.x, view.aim.y).label;
  return (
    <section
      className="board-section"
      aria-label="Dartboard and aiming controls"
    >
      <div className="board-frame">
        <canvas
          ref={canvasRef}
          id="dartboard"
          className={prototype ? "guide-control" : undefined}
          width="700"
          height="700"
          tabIndex={0}
          role="img"
          aria-label={
            prototype
              ? "Dartboard with moving guides. Press Space to stop height, press again to stop direction, then hold and release Space in the green zone."
              : `Dartboard. Aiming at ${label}. Arrow keys to aim. Hold and release Space to throw.`
          }
        />
        <div
          ref={announcementRef}
          id="board-announcement"
          className="board-announcement"
          aria-hidden="true"
        />
      </div>
      <div className="board-caption">
        <span className="caption-rule h-px flex-1 bg-[var(--line)] max-w-[70px]" />
        <span id="board-tip">{tip}</span>
        <span className="caption-rule h-px flex-1 bg-[var(--line)] max-w-[70px]" />
      </div>
    </section>
  );
}
