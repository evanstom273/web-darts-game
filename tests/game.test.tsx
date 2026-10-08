import { StrictMode } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { pointFor } from "../src/game/engine";

let time = 1000;
let nextId = 0;
let frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  time = 1000;
  nextId = 0;
  frames = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
function advance(milliseconds: number) {
  act(() => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
      time += Math.min(16, milliseconds - elapsed);
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    }
  });
}
function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing ${id}`);
  return value as T;
}
function keyDown(key = " ") {
  fireEvent.keyDown(element("dartboard"), {
    key,
    code: key === " " ? "Space" : key,
  });
}
function keyUp() {
  fireEvent.keyUp(element("dartboard"), { key: " ", code: "Space" });
}
function throwAt(number: number, multiplier: number) {
  const point = pointFor(number, multiplier);
  const event = new MouseEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    clientX: 350 + point.x * 263,
    clientY: 350 + point.y * 263,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  act(() => element("dartboard").dispatchEvent(event));
  keyDown();
  advance(713);
  keyUp();
  advance(400);
}
function start(mode = "practice", opponent = "computer", legs = "3") {
  fireEvent.click(element("new-game"));
  const form = element<HTMLFormElement>("setup-form");
  fireEvent.click(
    form.querySelector<HTMLInputElement>(
      `input[name="mode"][value="${mode}"]`,
    )!,
  );
  if (mode !== "practice")
    fireEvent.click(
      form.querySelector<HTMLInputElement>(
        `input[name="opponent"][value="${opponent}"]`,
      )!,
    );
  fireEvent.change(form.querySelector('select[name="legs"]')!, {
    target: { value: legs },
  });
  fireEvent.submit(form);
}

describe("React migration keeps playable match flows", () => {
  it("mounts one animation loop, renders the existing screen and cleans up on unmount", () => {
    const { unmount } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(element("mode-heading").textContent).toBe("501 Double out");
    expect(element("player-scores").children).toHaveLength(2);
    expect(frames.size).toBe(1);
    advance(16);
    unmount();
    expect(frames.size).toBe(0);
  });
  it("keeps practice scoring, visit history, averages and collecting the darts", () => {
    render(<App />);
    advance(16);
    start();
    for (let dart = 0; dart < 3; dart++) throwAt(20, 3);
    expect(element("visit-total").textContent).toBe("180");
    expect(element("history-count").textContent).toBe("1");
    expect(element("player-scores").textContent).toContain("Best visit 180");
    expect(element("player-scores").textContent).toContain("3-dart avg 180.0");
    expect(element("continue-button").textContent).toBe("Next visit");
    fireEvent.click(element("continue-button"));
    expect(element("visit-number").textContent).toBe("VISIT 2");
    expect(element("dart-slots").querySelectorAll(".hit")).toHaveLength(0);
  });
  it("preserves the score and saved speed when switching throwing mechanics mid-visit", () => {
    render(<App />);
    advance(16);
    throwAt(20, 3);
    const score = element("player-scores").textContent;
    fireEvent.click(element("settings-button"));
    fireEvent.click(element("mechanic-prototype"));
    fireEvent.input(element("aiming-speed"), { target: { value: ".8" } });
    expect(element("player-scores").textContent).toBe(score);
    expect(element("dart-slots").querySelectorAll(".hit")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("the-oche-controls-v1")!)).toEqual({
      mechanic: "prototype",
      aimingSpeed: 0.8,
    });
    expect(element("throw-label").textContent).toBe("Stop height");
    fireEvent.click(element("mechanic-classic"));
    expect(element("throw-label").textContent).toBe("Hold to throw");
    expect(element("player-scores").textContent).toBe(score);
  });
  it("keeps all three prototype stages and the next-dart action", () => {
    localStorage.setItem(
      "the-oche-controls-v1",
      JSON.stringify({ mechanic: "prototype", aimingSpeed: 0.45 }),
    );
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    start();
    keyDown();
    keyUp();
    expect(element("throw-label").textContent).toBe("Stop direction");
    keyDown();
    keyUp();
    expect(element("throw-label").textContent).toBe("Hold and release");
    keyDown();
    advance(1912);
    keyUp();
    advance(400);
    expect(element("dart-slots").querySelectorAll(".hit")).toHaveLength(1);
    expect(element("shot-feedback").textContent).toContain("Accurate release");
    expect(element("throw-label").textContent).toBe("Next dart");
    keyDown();
    keyUp();
    expect(element("throw-label").textContent).toBe("Stop height");
  });
  it("completes a local 301 leg on a double and retains the result and alternating starter", () => {
    render(<App />);
    advance(16);
    start("301", "local");
    for (let dart = 0; dart < 3; dart++) throwAt(20, 3);
    fireEvent.click(element("continue-button"));
    expect(element("turn-label").textContent).toBe("PLAYER 2 TO THROW");
    for (let dart = 0; dart < 3; dart++) throwAt(20, 3);
    fireEvent.click(element("continue-button"));
    throwAt(20, 3);
    throwAt(11, 3);
    throwAt(14, 2);
    advance(1100);
    expect(element<HTMLDialogElement>("result-dialog").open).toBe(true);
    expect(element("result-title").textContent).toBe("Player 1 takes the leg.");
    expect(element("result-number").textContent).toBe("1 — 0");
    fireEvent.click(element("result-continue"));
    expect(element("leg-label").textContent).toBe("Leg 2");
    expect(element("turn-label").textContent).toBe("PLAYER 2 TO THROW");
  });
  it("restores a bust visit and lets the computer finish its visit before returning control", () => {
    render(<App />);
    advance(16);
    start("301");
    for (let dart = 0; dart < 3; dart++) throwAt(20, 3);
    fireEvent.click(element("continue-button"));
    advance(7500);
    expect(element("turn-label").textContent).toBe("YOUR THROW");
    throwAt(20, 3);
    throwAt(20, 3);
    expect(element("visit-total").textContent).toBe("BUST");
    expect(
      element("player-scores").querySelector(".score-value")?.textContent,
    ).toBe("121");
    expect(element("history-count").textContent).toBe("3");
  });
  it("pauses throwing while a dialog is open and cancels a charge on blur", () => {
    render(<App />);
    advance(16);
    keyDown();
    advance(300);
    fireEvent(window, new Event("blur"));
    keyUp();
    advance(400);
    expect(element("dart-slots").querySelectorAll(".hit")).toHaveLength(0);
    fireEvent.click(element("help-button"));
    keyDown();
    advance(800);
    keyUp();
    advance(400);
    expect(element("dart-slots").querySelectorAll(".hit")).toHaveLength(0);
  });
});
