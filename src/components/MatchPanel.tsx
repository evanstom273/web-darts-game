import type { RefObject } from "react";
import { checkout, scoreAt } from "../game/engine";
import { average } from "../game/controller";
import type { GameController, GameView } from "../game/types";

interface Props {
  game: GameController | null;
  view: GameView;
  meterMarkerRef: RefObject<HTMLSpanElement | null>;
  releaseMeterRef: RefObject<HTMLDivElement | null>;
  throwButtonRef: RefObject<HTMLButtonElement | null>;
}

export function MatchPanel({
  game,
  view,
  meterMarkerRef,
  releaseMeterRef,
  throwButtonRef,
}: Props) {
  const { settings, state, charging, prototypeStep: step } = view;
  const practice = settings.mode === "practice";
  const computer =
    !practice && settings.opponent === "computer" && state.current === 1;
  const prototype = view.controls.mechanic === "prototype";
  const humanPrototype = prototype && !computer;
  const ready = state.phase === "ready";
  const end = state.phase === "turn-end";
  const p = state.players[state.current];
  const route =
    !practice && !state.visitFinished
      ? checkout(p.remaining, 3 - state.darts.length)
      : null;
  let throwLabel = charging
    ? "Release in gold"
    : computer
      ? "House player throwing…"
      : state.phase === "flight"
        ? "In the air…"
        : state.phase === "leg-end" || state.phase === "match-end"
          ? "Game shot"
          : "Hold to throw";
  let shortcut = computer
    ? "Your turn is coming up"
    : charging
      ? "Find the moment. Let go."
      : "then release in the gold zone";
  let note = end
    ? "Collect the darts when you’re ready."
    : computer
      ? "Watch the house player’s visit."
      : "Hold the button or Space. Release to throw.";
  if (humanPrototype && ready) {
    throwLabel =
      step === 0
        ? "Stop height"
        : step === 1
          ? "Stop direction"
          : step === 3
            ? "Next dart"
            : charging
              ? "Release in green"
              : "Hold and release";
    shortcut =
      step === 0
        ? "lock the horizontal guide"
        : step === 1
          ? "lock the vertical guide"
          : step === 3
            ? "line up your next throw"
            : charging
              ? "Aim for the middle of the green zone"
              : "charge to around 65%";
    note =
      step === 2
        ? "Hold the button or Space. Release in green."
        : step === 3
          ? "Press the button or Space to line up again."
          : "Press the button or Space to stop the guide.";
  }
  return (
    <aside className="match-panel" aria-label="Scoreboard and throw controls">
      <section className="scoreboard" aria-label="Scores">
        <div className="scoreboard-heading">
          <span id="scoreboard-label">
            {practice ? "AT THE PRACTICE BOARD" : "THE MATCH"}
          </span>
          <span id="match-difficulty">
            {practice
              ? "NO LIMITS"
              : settings.opponent === "local"
                ? "PASS & PLAY"
                : settings.difficulty.toUpperCase()}
          </span>
        </div>
        <div id="player-scores">
          {state.players.map((v, i) => (
            <div
              key={i}
              className={`player-score ${i === state.current ? "active" : ""}`}
            >
              <div className="player-name">
                {v.name}
                {i === state.current && !practice ? <em>AT THE OCHE</em> : null}
              </div>
              <strong className="score-value">
                {practice
                  ? v.points + (!state.visitFinished ? state.visitTotal : 0)
                  : v.remaining}
              </strong>
              <div className="player-sub">
                <span>
                  {practice ? "Best visit" : "Legs"}{" "}
                  <b>{practice ? v.best : v.legs}</b>
                </span>
                <span>
                  3-dart avg <b>{average(v)}</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="throw-panel">
        <div className="visit-heading">
          <span id="turn-label">
            {computer
              ? "HOUSE PLAYER"
              : practice || p.name === "You"
                ? "YOUR THROW"
                : `${p.name.toUpperCase()} TO THROW`}
          </span>
          <span id="visit-number">
            VISIT {p.visits + (state.visitFinished ? 0 : 1)}
          </span>
        </div>
        <div id="dart-slots" className="dart-slots" aria-label="Current visit">
          {[0, 1, 2].map((i) => {
            const dart = state.darts[i];
            return (
              <div
                key={i}
                className={`dart-slot ${dart ? "hit " : ""}${state.visitBust ? "bust " : !dart && i === state.darts.length ? "next" : ""}`}
              >
                {dart ? (
                  <>
                    <b>{dart.hit.value}</b>
                    <small>{dart.hit.short}</small>
                  </>
                ) : (
                  <span>0{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="visit-bottom">
          <span>
            This visit{" "}
            <strong id="visit-total">
              {state.visitBust ? "BUST" : state.visitTotal}
            </strong>
          </span>
          <span id="checkout-hint">
            {practice
              ? `Best visit: ${p.best}`
              : route
                ? `Finish: ${route.map((h) => h.short).join(" · ")}`
                : state.visitBust
                  ? `Score reset to ${state.visitStart}`
                  : end
                    ? "Visit complete"
                    : "Aim for the treble 20"}
          </span>
        </div>
        <div
          className={`shot-feedback${view.feedback.bust ? " bust" : ""}`}
          id="shot-feedback"
          role="status"
          aria-live="polite"
        >
          <strong>{view.feedback.title}</strong>
          <span>{view.feedback.detail}</span>
        </div>
        <div id="aim-row" className="aim-row">
          <span id="aim-heading">
            {prototype ? "THREE-STAGE" : "AIMING AT"}
          </span>
          <strong id="aim-label">
            {humanPrototype && ready && step < 2
              ? step === 0
                ? "Set height"
                : "Set direction"
              : scoreAt(view.aim.x, view.aim.y).label}
          </strong>
        </div>
        <div
          className={`prototype-steps${!humanPrototype || !ready || step === 3 ? " hidden" : ""}`}
          id="prototype-steps"
          aria-label="Throw stages"
        >
          {["Height", "Direction", "Release"].map((label, index) => (
            <span
              key={label}
              id={`step-${label.toLowerCase()}`}
              className={
                index === step
                  ? "active"
                  : index < step
                    ? "complete"
                    : undefined
              }
            >
              {index + 1} · {label}
            </span>
          ))}
        </div>
        <div
          id="timing-controls"
          className={
            humanPrototype && (step !== 2 || !ready) ? "hidden" : undefined
          }
        >
          <div
            ref={releaseMeterRef}
            className={`release-meter${prototype ? " prototype-meter" : ""}${charging ? " charging" : ""}`}
            id="release-meter"
            role="meter"
            aria-label={
              prototype
                ? "Throw charge, release in the green zone around 65 percent"
                : "Throw timing, release in the gold zone"
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
          >
            <span className="sweet-spot" />
            <span
              ref={meterMarkerRef}
              className="meter-marker"
              id="meter-marker"
            />
          </div>
          <div className="meter-labels">
            <span id="meter-start-label">{prototype ? "0%" : "HOLD"}</span>
            <span id="meter-zone-label">
              {prototype ? "RELEASE IN GREEN · 65%" : "RELEASE IN GOLD"}
            </span>
          </div>
        </div>
        <button
          ref={throwButtonRef}
          id="throw-button"
          className={`throw-button${end ? " hidden" : ""}${charging ? " charging" : ""}`}
          disabled={!ready || computer}
        >
          <span id="throw-label">{throwLabel}</span>
          <span id="throw-shortcut">{shortcut}</span>
        </button>
        <button
          id="continue-button"
          className={`throw-button${end ? "" : " hidden"}`}
          onClick={() => game?.nextTurn()}
        >
          {practice
            ? "Next visit"
            : settings.opponent === "computer"
              ? "Computer’s turn"
              : `Pass to ${state.players[1 - state.current].name}`}
        </button>
        <p id="control-note" className="control-note">
          {note}
        </p>
      </section>
      <details className="history">
        <summary>
          Visit history <span id="history-count">{state.history.length}</span>
        </summary>
        <div id="visit-history">
          {state.history.length ? (
            state.history.slice(0, 30).map((v, i) => (
              <div key={state.history.length - i} className="history-row">
                <span>{v.name}</span>
                <span>{v.darts.join(" · ")}</span>
                <strong>{v.bust ? "BUST" : v.total}</strong>
              </div>
            ))
          ) : (
            <p className="empty-history">Your first visit starts here.</p>
          )}
        </div>
      </details>
    </aside>
  );
}
