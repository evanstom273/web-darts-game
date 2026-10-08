import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const context = new Proxy<Record<string, unknown>>(
  {},
  {
    get(target, property: string) {
      if (
        property === "createRadialGradient" ||
        property === "createLinearGradient"
      )
        return () => ({ addColorStop() {} });
      return target[property] ?? (() => {});
    },
  },
);
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
  (() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext,
);
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({ matches: false }),
});
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value() {
    this.open = true;
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value() {
    this.open = false;
  },
});
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value() {},
});
// jsdom does not lay out the board; use its original 700 × 700 coordinate system.
vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 700,
  bottom: 700,
  width: 700,
  height: 700,
  toJSON: () => ({}),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
