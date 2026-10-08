import { useState } from "react";
import type { MouseEvent, RefObject } from "react";
import {
  isMode,
  isOpponent,
  isDifficulty,
  isMatchLength,
} from "../game/controller";
import type { GameController, GameView } from "../game/types";

interface Props {
  game: GameController | null;
  view: GameView;
  settingsRef: RefObject<HTMLDialogElement | null>;
  setupRef: RefObject<HTMLDialogElement | null>;
  helpRef: RefObject<HTMLDialogElement | null>;
  resultRef: RefObject<HTMLDialogElement | null>;
}
function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const dialog = event.currentTarget;
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.close();
}
export function Dialogs({
  game,
  view,
  settingsRef,
  setupRef,
  helpRef,
  resultRef,
}: Props) {
  const [mode, setMode] = useState("501");
  const [opponent, setOpponent] = useState("computer");
  const prototype = view.controls.mechanic === "prototype";
  const speed = view.controls.aimingSpeed;
  const speedLabel =
    (speed < 0.4
      ? "Very slow"
      : speed < 0.8
        ? "Slow"
        : speed < 1.15
          ? "Medium"
          : "Fast") +
    " · " +
    speed.toFixed(2);
  const result = view.result;
  return (
    <>
      <dialog
        ref={settingsRef}
        id="settings-dialog"
        aria-labelledby="settings-title"
        onClick={closeOnBackdrop}
      >
        <button
          className="dialog-close"
          onClick={() => settingsRef.current?.close()}
          aria-label="Close settings"
        >
          ×
        </button>
        <span className="eyebrow">FIND YOUR THROW</span>
        <h2 id="settings-title">Settings</h2>
        <p className="dialog-intro">
          Switch your throwing style at any point in a match.
        </p>
        <fieldset id="throwing-options">
          <legend>Throwing mechanic</legend>
          <div className="choice-grid two throwing-choices">
            <label>
              <input
                id="mechanic-classic"
                type="radio"
                name="throwing"
                value="classic"
                checked={!prototype}
                onChange={() => game?.setThrowingMechanic("classic")}
              />
              <span>
                <strong>Original</strong>
                <small>Tap to aim. Time the release.</small>
              </span>
            </label>
            <label>
              <input
                id="mechanic-prototype"
                type="radio"
                name="throwing"
                value="prototype"
                checked={prototype}
                onChange={() => game?.setThrowingMechanic("prototype")}
              />
              <span>
                <strong>Three-stage</strong>
                <small>Your ZIP’s moving guides.</small>
              </span>
            </label>
          </div>
        </fieldset>
        <p
          id="mechanic-description"
          className="mechanic-description"
          aria-live="polite"
        >
          {prototype
            ? "Stop height, stop direction, then hold and release in the green zone."
            : "Aim directly on the board, then hold and release in the gold zone."}
        </p>
        <div
          id="prototype-settings"
          className={prototype ? undefined : "hidden"}
        >
          <label className="speed-label" htmlFor="aiming-speed">
            Aiming speed{" "}
            <output id="speed-label" htmlFor="aiming-speed">
              {speedLabel}
            </output>
          </label>
          <input
            id="aiming-speed"
            type="range"
            min="0.15"
            max="1.5"
            step="0.05"
            value={speed}
            onInput={(event) =>
              game?.setAimingSpeed(Number(event.currentTarget.value))
            }
          />
          <p className="speed-note">
            Very slow to fast. The ZIP’s original speed is 0.45.
          </p>
        </div>
        <div className="sound-setting">
          <span>Game audio</span>
          <button
            id="sound-toggle"
            className="outline-button"
            aria-pressed={view.soundOn}
            onClick={() => game?.toggleSound()}
          >
            {view.soundOn ? "Sound on" : "Sound off"}
          </button>
        </div>
        <p className="settings-note">
          Your score and match stay in place. Your throwing preference is
          remembered on this device.
        </p>
        <button
          className="gold-button"
          onClick={() => settingsRef.current?.close()}
        >
          Back to the board
        </button>
      </dialog>
      <dialog
        ref={setupRef}
        id="setup-dialog"
        aria-labelledby="setup-title"
        onClick={closeOnBackdrop}
        onClose={() => {
          if (
            (view.state.phase === "leg-end" ||
              view.state.phase === "match-end") &&
            !resultRef.current?.open
          )
            game?.showResult();
        }}
      >
        <form
          id="setup-form"
          onChange={(event) => {
            const form = new FormData(event.currentTarget);
            setMode(String(form.get("mode")));
            setOpponent(String(form.get("opponent")));
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget),
              mode = form.get("mode"),
              opponent = form.get("opponent"),
              difficulty = form.get("difficulty"),
              legs = Number(form.get("legs"));
            if (
              isMode(mode) &&
              isOpponent(opponent) &&
              isDifficulty(difficulty) &&
              isMatchLength(legs)
            )
              game?.startGame({ mode, opponent, difficulty, legs });
          }}
        >
          <button
            className="dialog-close"
            type="button"
            onClick={() => setupRef.current?.close()}
            aria-label="Close new game"
          >
            ×
          </button>
          <span className="eyebrow">BACK TO THE OCHE</span>
          <h2 id="setup-title">Make it a match.</h2>
          <p className="dialog-intro">Pick your game and step up.</p>
          <fieldset>
            <legend>Game</legend>
            <div className="choice-grid">
              <label>
                <input type="radio" name="mode" value="501" defaultChecked />
                <span>
                  <strong>501</strong>
                  <small>The classic</small>
                </span>
              </label>
              <label>
                <input type="radio" name="mode" value="301" />
                <span>
                  <strong>301</strong>
                  <small>A quick leg</small>
                </span>
              </label>
              <label>
                <input type="radio" name="mode" value="practice" />
                <span>
                  <strong>Practice</strong>
                  <small>Find your range</small>
                </span>
              </label>
            </div>
          </fieldset>
          <div
            id="match-options"
            className={mode === "practice" ? "hidden" : undefined}
          >
            <fieldset>
              <legend>Play against</legend>
              <div className="choice-grid two">
                <label>
                  <input
                    type="radio"
                    name="opponent"
                    value="computer"
                    defaultChecked
                  />
                  <span>
                    <strong>Computer</strong>
                    <small>The house player</small>
                  </span>
                </label>
                <label>
                  <input type="radio" name="opponent" value="local" />
                  <span>
                    <strong>A friend</strong>
                    <small>Pass &amp; play</small>
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="settings-row">
              <label
                id="difficulty-setting"
                className={opponent === "local" ? "hidden" : undefined}
              >
                Computer level
                <select name="difficulty" defaultValue="club">
                  <option value="casual">Casual</option>
                  <option value="club">Club</option>
                  <option value="expert">Expert</option>
                </select>
              </label>
              <label>
                Match length
                <select name="legs" defaultValue="3">
                  <option value="1">One leg</option>
                  <option value="3">Best of 3</option>
                  <option value="5">Best of 5</option>
                </select>
              </label>
            </div>
          </div>
          <p className="setup-note">
            Straight in, double out. Starting a new game replaces the current
            one.
          </p>
          <button type="submit" className="gold-button">
            Step up
          </button>
        </form>
      </dialog>
      <dialog
        ref={helpRef}
        id="help-dialog"
        aria-labelledby="help-title"
        onClick={closeOnBackdrop}
      >
        <button
          className="dialog-close"
          onClick={() => helpRef.current?.close()}
          aria-label="Close instructions"
        >
          ×
        </button>
        <span className="eyebrow">A QUICK WARM-UP</span>
        <h2 id="help-title">It's all in the release.</h2>
        <div id="classic-help" className={prototype ? "hidden" : undefined}>
          <ol className="instructions">
            <li>
              <strong>Choose your spot.</strong>
              <p>
                Tap or drag on the board to move the gold aiming ring. On a
                keyboard, focus the board and use the arrow keys. Hold Shift for
                fine adjustments.
              </p>
            </li>
            <li>
              <strong>Draw, then let go.</strong>
              <p>
                Hold the throw button or Space. Release as the marker crosses
                the gold band. An early release lands low; a late release lands
                high. A little natural sway keeps it interesting.
              </p>
            </li>
            <li>
              <strong>Finish on a double.</strong>
              <p>
                In 501 or 301, work down to exactly zero. Your last dart must
                hit a double ring or the bullseye. Go below zero, leave one, or
                reach zero without a double and you bust: your whole visit is
                undone.
              </p>
            </li>
          </ol>
        </div>
        <div id="prototype-help" className={prototype ? undefined : "hidden"}>
          <ol className="instructions">
            <li>
              <strong>Stop the height guide.</strong>
              <p>
                The blue horizontal line moves up and down. Press the main
                button or Space to stop it at your chosen height.
              </p>
            </li>
            <li>
              <strong>Stop the direction guide.</strong>
              <p>
                The blue vertical line moves sideways. Press again to lock it
                where the two guides meet.
              </p>
            </li>
            <li>
              <strong>Hold, then release in green.</strong>
              <p>
                Hold the main button or Space to fill the meter. Release around
                65% for a tight throw. A poor release scatters the dart around
                your locked aim. Press Next dart to line up again.
              </p>
            </li>
          </ol>
          <p className="help-note">
            Adjust the guide speed in Settings. Matches still finish on a double
            or bullseye. Going below zero, leaving one, or finishing without a
            double busts the whole visit.
          </p>
        </div>
        <div className="scoring-guide">
          <span>
            <b>Outer ring</b>Double
          </span>
          <span>
            <b>Inner ring</b>Treble
          </span>
          <span>
            <b>Outer bull</b>25
          </span>
          <span>
            <b>Bullseye</b>50 · double
          </span>
        </div>
        <p className="help-note">
          Practice has no finish line. Throw, learn the timing, and chase a 180.
          The computer throws automatically when you continue after your visit.
        </p>
        <button
          className="gold-button"
          onClick={() => helpRef.current?.close()}
        >
          Back to the board
        </button>
      </dialog>
      <dialog
        ref={resultRef}
        id="result-dialog"
        aria-labelledby="result-title"
        onCancel={(event) => event.preventDefault()}
      >
        <span className="eyebrow" id="result-eyebrow">
          {result?.eyebrow ?? "GAME SHOT"}
        </span>
        <div className="result-number" id="result-number">
          {result?.number ?? "1—0"}
        </div>
        <h2 id="result-title">{result?.title ?? "You take the leg."}</h2>
        <p id="result-description">{result?.description}</p>
        <div className="result-stats" id="result-stats">
          {result ? (
            <>
              <div>
                <strong>{result.average}</strong>
                <span>3-dart average</span>
              </div>
              <div>
                <strong>{result.best}</strong>
                <span>Best visit</span>
              </div>
              <div>
                <strong>{result.darts}</strong>
                <span>Darts thrown</span>
              </div>
            </>
          ) : null}
        </div>
        <button
          className="gold-button"
          id="result-continue"
          onClick={() => game?.nextLeg()}
        >
          {result?.continueLabel ?? "Next leg"}
        </button>
        <button
          className="result-new"
          id="result-new"
          onClick={() => {
            resultRef.current?.close();
            game?.openDialog("setup-dialog");
          }}
        >
          Choose a new game
        </button>
      </dialog>
    </>
  );
}
