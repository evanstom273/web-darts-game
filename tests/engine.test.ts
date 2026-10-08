import { describe, expect, it } from "vitest";
import {
  checkout,
  NUMBERS,
  pointFor,
  RADII,
  resolveDart,
  scoreAt,
} from "../src/game/engine";
import {
  PROTOTYPE,
  prototypeLanding,
  prototypePosition,
  prototypePower,
} from "../src/game/throwing";

describe("regulation board and double-out scoring", () => {
  it("scores all twenty segments in each ring", () => {
    for (const number of NUMBERS)
      for (const multiplier of [1, 2, 3]) {
        const point = pointFor(number, multiplier),
          hit = scoreAt(point.x, point.y);
        expect(hit.value).toBe(number * multiplier);
        expect(hit.double).toBe(multiplier === 2);
        expect(hit.number).toBe(number);
      }
  });
  it("keeps the bullseye, outer bull and miss boundaries", () => {
    expect(scoreAt(0, 0)).toMatchObject({
      value: 50,
      double: true,
      short: "BULL",
    });
    expect(scoreAt(RADII.bull, 0).value).toBe(50);
    expect(scoreAt(RADII.bull + 0.001, 0).value).toBe(25);
    expect(scoreAt(RADII.outerBull + 0.001, 0).number).toBe(6);
    expect(scoreAt(0, -1)).toMatchObject({ value: 40, double: true });
    expect(scoreAt(0, -1.001).value).toBe(0);
  });
  it("restores the entire visit on overshoot, leaving one or a non-double finish", () => {
    expect(resolveDart(20, 121, scoreAt(...coords(20, 3)))).toEqual({
      remaining: 121,
      bust: true,
      won: false,
    });
    expect(resolveDart(21, 121, scoreAt(...coords(20, 1)))).toEqual({
      remaining: 121,
      bust: true,
      won: false,
    });
    expect(resolveDart(20, 121, scoreAt(...coords(20, 1)))).toEqual({
      remaining: 121,
      bust: true,
      won: false,
    });
    expect(resolveDart(40, 121, scoreAt(...coords(20, 2)))).toEqual({
      remaining: 0,
      bust: false,
      won: true,
    });
    expect(resolveDart(50, 121, scoreAt(0, 0)).won).toBe(true);
  });
  it("keeps the 170 checkout and rejects impossible finishes for the available darts", () => {
    expect(checkout(170)?.map((hit) => hit.short)).toEqual([
      "T20",
      "T20",
      "BULL",
    ]);
    expect(checkout(169)).toBeNull();
    expect(checkout(171)).toBeNull();
    expect(checkout(60, 1)).toBeNull();
    expect(checkout(40, 1)?.map((hit) => hit.short)).toEqual(["D20"]);
    for (let remaining = 2; remaining <= 170; remaining++)
      for (let darts = 1; darts <= 3; darts++) {
        const route = checkout(remaining, darts);
        if (!route) continue;
        expect(route.length).toBeLessThanOrEqual(darts);
        expect(route.reduce((sum, hit) => sum + hit.value, 0)).toBe(remaining);
        expect(route[route.length - 1].multiplier).toBe(2);
      }
  });
});

describe("three-stage timing from the supplied prototype", () => {
  it("keeps guide reach, speed and the slower charge rate", () => {
    expect(prototypePosition(0)).toBe(0);
    expect(prototypePosition(1 / (2 * PROTOTYPE.defaultSpeed))).toBeCloseTo(
      RADII.doubleInner,
    );
    expect(prototypePower(1000)).toBe(0.34);
    expect(prototypePower(0)).toBe(0);
    expect(prototypePower(10000)).toBe(1);
  });
  it("keeps tight scatter in the release window and wider scatter outside it", () => {
    const accurate = prototypeLanding({ x: 0, y: 0 }, 0.65, () => 0.5);
    const early = prototypeLanding({ x: 0, y: 0 }, 0.1, () => 0.5);
    expect(accurate.accurate).toBe(true);
    expect(early.accurate).toBe(false);
    expect(Math.hypot(accurate.point.x, accurate.point.y)).toBeLessThan(0.014);
    expect(Math.hypot(early.point.x, early.point.y)).toBeGreaterThan(0.3);
  });
});

function coords(number: number, multiplier: number): [number, number] {
  const point = pointFor(number, multiplier);
  return [point.x, point.y];
}
