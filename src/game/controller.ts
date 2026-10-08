import {
  NUMBERS,
  RADII,
  scoreAt,
  pointFor,
  resolveDart,
  checkout,
  chooseTarget,
  gaussian,
} from "./engine";
import {
  PROTOTYPE,
  prototypePosition,
  prototypePower,
  prototypeLanding,
} from "./throwing";
type RuntimeEventMap = HTMLElementEventMap & DocumentEventMap & WindowEventMap;

import type {
  ControlPreferences,
  DialogId,
  GameController,
  GameElements,
  GameSettings,
  GameState,
  GameView,
  ModelContext,
  PageTool,
  Player,
  Point,
  PrototypeStep,
  Result,
  Feedback,
  ThrowingMechanic,
} from "./types";

export const DEFAULT_VIEW: GameView = {
  settings: { mode: "501", opponent: "computer", difficulty: "club", legs: 3 },
  controls: { mechanic: "classic", aimingSpeed: PROTOTYPE.defaultSpeed },
  state: {
    players: [makeDefaultPlayer("You"), makeDefaultPlayer("House player")],
    current: 0,
    starter: 0,
    leg: 1,
    phase: "ready",
    visitStart: 501,
    visitTotal: 0,
    visitBust: false,
    visitFinished: false,
    darts: [],
    history: [],
  },
  aim: pointFor(20, 3),
  prototypeStep: 0,
  charging: false,
  soundOn: false,
  feedback: {
    title: "Find your rhythm.",
    detail: "Three darts. Make them count.",
    bust: false,
  },
  result: null,
};
function makeDefaultPlayer(name: string): Player {
  return {
    name,
    remaining: 501,
    legs: 0,
    points: 0,
    darts: 0,
    visits: 0,
    best: 0,
  };
}
export function average(p: Player) {
  return p.darts ? ((p.points * 3) / p.darts).toFixed(1) : "0.0";
}

export function createGame(elements: GameElements): GameController {
  const canvas = elements.canvas;
  const ctx = requireContext(canvas);
  const board = document.createElement("canvas");
  board.width = 1400;
  board.height = 1400;
  const boardCtx = requireContext(board);
  const lifecycle = new AbortController();
  const listeners = new Set<() => void>();
  let animationFrame = 0;
  let disposed = false;
  let view = DEFAULT_VIEW;
  let currentFeedback: Feedback = DEFAULT_VIEW.feedback;
  let result: Result | null = null;
  const C = 350,
    R = 263,
    TAU = Math.PI * 2;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let settings: GameSettings = { ...DEFAULT_VIEW.settings };
  let state: GameState;
  let aim = pointFor(20, 3);
  let charge: { start: number } | null = null;
  let flight: {
    point: Point;
    quality: string;
    bot: boolean;
    start: number;
    duration: number;
  } | null = null;
  let clock = 0,
    lastFrame = 0,
    announcementUntil = 0;
  let timers: { at: number; fn: () => void }[] = [];
  let throwPointer: number | null = null,
    dragPointer: number | null = null;
  let controls = readControlPreferences(),
    prototypeAim: { step: PrototypeStep; elapsed: number; pos: number } = {
      step: 0,
      elapsed: 0,
      pos: 0,
    },
    lastClassicAim = { ...aim };
  let soundOn = false,
    audioContext: AudioContext | null = null;
  const colors = {
    gold: "#e3bd76",
    cream: "#eee5ce",
    wire: "#aca88e",
    red: "#a43b35",
    green: "#28664d",
  };

  function circle(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    fill: string | CanvasGradient | null = null,
    stroke: string | null = null,
    width = 1,
  ) {
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.stroke();
    }
  }
  function ringSection(
    context: CanvasRenderingContext2D,
    a: number,
    b: number,
    r1: number,
    r2: number,
    fill: string | CanvasGradient,
  ) {
    context.beginPath();
    context.arc(C, C, r2, a, b);
    context.arc(C, C, r1, b, a, true);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  }
  function drawBase() {
    const c = boardCtx;
    c.scale(2, 2);
    c.shadowColor = "#000b";
    c.shadowBlur = 24;
    c.shadowOffsetY = 14;
    circle(c, C, C, 332, "#08100c");
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    const surround = c.createRadialGradient(C, 260, 180, C, C, 330);
    surround.addColorStop(0, "#344433");
    surround.addColorStop(1, "#243126");
    circle(c, C, C, 325, surround, "#506043", 1);
    circle(c, C, C, 313, "#142019", "#47503c", 1);
    circle(c, C, C, 303, "#171b15", "#090e0b", 6);
    const black = c.createLinearGradient(0, 70, 0, 610);
    black.addColorStop(0, "#222923");
    black.addColorStop(1, "#131b17");
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20,
        b = a + Math.PI / 10;
      ringSection(c, a, b, 0, R, i % 2 === 0 ? black : "#e6dfc8");
      ringSection(
        c,
        a,
        b,
        R * RADII.trebleInner,
        R * RADII.trebleOuter,
        i % 2 === 0 ? colors.red : colors.green,
      );
      ringSection(
        c,
        a,
        b,
        R * RADII.doubleInner,
        R,
        i % 2 === 0 ? colors.red : colors.green,
      );
    }
    // Fine, deterministic fibres give the playing surface a little depth.
    c.save();
    c.beginPath();
    c.arc(C, C, R, 0, TAU);
    c.clip();
    let seed = 93287;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    c.lineWidth = 0.55;
    for (let n = 0; n < 7200; n++) {
      const x = C + (rnd() * 2 - 1) * R,
        y = C + (rnd() * 2 - 1) * R;
      c.strokeStyle = n % 2 ? "#fff1c510" : "#00000016";
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + rnd() * 1.5, y + 1 + rnd() * 3);
      c.stroke();
    }
    c.restore();
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20;
      c.beginPath();
      c.moveTo(
        C + Math.cos(a) * R * RADII.outerBull,
        C + Math.sin(a) * R * RADII.outerBull,
      );
      c.lineTo(C + Math.cos(a) * R, C + Math.sin(a) * R);
      c.strokeStyle = "#a8a58d";
      c.lineWidth = 1.05;
      c.stroke();
    }
    for (const r of [
      RADII.trebleInner,
      RADII.trebleOuter,
      RADII.doubleInner,
      1,
    ])
      circle(c, C, C, R * r, null, "#aeae96", 1.25);
    circle(c, C, C, R * RADII.outerBull, colors.green, "#b7b399", 1.2);
    circle(c, C, C, R * RADII.bull, colors.red, "#c1b598", 1.2);
    c.font = "500 25px Arial, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 10;
      c.fillStyle = "#dedac7";
      c.fillText(
        String(NUMBERS[i]),
        C + Math.cos(a) * 285,
        C + Math.sin(a) * 285 + 1,
      );
    }
    circle(c, C, C, 304, null, "#818270", 1.1);
    c.fillStyle = "#b6b195";
    c.font = "9px Arial, sans-serif";
    c.letterSpacing = "2px";
    c.fillText("THE OCHE", C, 677);
    c.letterSpacing = "0px";
  }

  function modalOpen() {
    return Object.values(elements.dialogs).some((dialog) => dialog.open);
  }
  function schedule(fn: () => void, ms: number) {
    timers.push({ at: clock + ms, fn });
  }
  function player() {
    return state.players[state.current];
  }
  function isPractice() {
    return settings.mode === "practice";
  }
  function isComputer() {
    return (
      !isPractice() && settings.opponent === "computer" && state.current === 1
    );
  }
  function canThrow() {
    return (
      state?.phase === "ready" &&
      !isComputer() &&
      !modalOpen() &&
      !document.hidden
    );
  }
  function isPrototype() {
    return controls.mechanic === "prototype";
  }
  function readControlPreferences(): ControlPreferences {
    const defaults: ControlPreferences = {
      mechanic: "classic",
      aimingSpeed: PROTOTYPE.defaultSpeed,
    };
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("the-oche-controls-v1") ?? "null",
      );
      if (isRecord(value)) {
        if (value.mechanic === "classic" || value.mechanic === "prototype")
          defaults.mechanic = value.mechanic;
        if (
          typeof value.aimingSpeed === "number" &&
          Number.isFinite(value.aimingSpeed) &&
          value.aimingSpeed >= PROTOTYPE.minSpeed &&
          value.aimingSpeed <= PROTOTYPE.maxSpeed
        )
          defaults.aimingSpeed = value.aimingSpeed;
      }
    } catch {}
    return defaults;
  }
  function saveControlPreferences() {
    try {
      localStorage.setItem("the-oche-controls-v1", JSON.stringify(controls));
    } catch {}
  }
  function resetPrototypeAim() {
    prototypeAim = { step: 0, elapsed: 0, pos: 0 };
    if (isPrototype() && !isComputer()) aim = { x: 0, y: 0 };
  }
  function setThrowingMechanic(mechanic: ThrowingMechanic) {
    if (!["classic", "prototype"].includes(mechanic))
      throw new Error("Unknown throwing mechanic.");
    if (mechanic === controls.mechanic) return;
    cancelCharge();
    throwPointer = null;
    dragPointer = null;
    if (!isPrototype() && !isComputer()) lastClassicAim = { ...aim };
    controls.mechanic = mechanic;
    resetPrototypeAim();
    if (!isPrototype() && !isComputer()) aim = { ...lastClassicAim };
    resetMeter();
    saveControlPreferences();
    render();
  }
  function setAimingSpeed(speed: number) {
    if (
      !Number.isFinite(speed) ||
      speed < PROTOTYPE.minSpeed ||
      speed > PROTOTYPE.maxSpeed
    )
      throw new Error("Aiming speed must be between 0.15 and 1.5.");
    controls.aimingSpeed = speed;
    saveControlPreferences();
    render();
  }
  function makePlayer(name: string): Player {
    return {
      name,
      remaining: Number(settings.mode) || 0,
      legs: 0,
      points: 0,
      darts: 0,
      visits: 0,
      best: 0,
    };
  }
  function startGame(next: GameSettings = settings) {
    settings = { ...next };
    timers = [];
    charge = null;
    flight = null;
    state = {
      players: [
        makePlayer(
          isPractice() || settings.opponent === "computer" ? "You" : "Player 1",
        ),
      ],
      current: 0,
      starter: 0,
      leg: 1,
      phase: "ready",
      visitStart: 0,
      visitTotal: 0,
      visitBust: false,
      visitFinished: false,
      darts: [],
      history: [],
    };
    if (!isPractice())
      state.players.push(
        makePlayer(
          settings.opponent === "computer" ? "House player" : "Player 2",
        ),
      );
    for (const d of Object.values(elements.dialogs)) if (d.open) d.close();
    elements.announcement.classList.remove("show");
    announcementUntil = 0;
    aim = pointFor(20, 3);
    beginTurn(0);
    feedback(
      isPractice() ? "No pressure. Just practice." : "Find your rhythm.",
      isPractice()
        ? "Try a few throws and find your rhythm."
        : "Three darts. Make them count.",
    );
  }
  function beginTurn(index: number) {
    state.current = index;
    state.visitStart = player().remaining;
    state.visitTotal = 0;
    state.visitBust = false;
    state.visitFinished = false;
    state.darts = [];
    flight = null;
    charge = null;
    state.phase = isComputer() ? "ai-aim" : "ready";
    resetMeter();
    resetPrototypeAim();
    render();
    if (isComputer()) {
      feedback("The house steps up.", "Watch the board — your turn is next.");
      schedule(computerThrow, 650);
    } else {
      feedback(
        isPractice()
          ? "A fresh set of three."
          : player().name === "You"
            ? "Your turn."
            : player().name + " to throw.",
        isPractice()
          ? "Take your time. Find your range."
          : isPrototype()
            ? "Set height, set direction, then release in green."
            : "Aim, hold, and release in gold.",
      );
      if (!isPractice() && !isPrototype()) suggestAim();
    }
  }
  function suggestAim() {
    const route = checkout(player().remaining, 3);
    if (route) {
      aim = pointFor(route[0].number, route[0].multiplier);
      updateAim();
    }
  }
  function feedback(title: string, detail: string, bust = false) {
    currentFeedback = { title, detail, bust };
    render();
  }
  function render() {
    if (disposed) return;
    view = {
      settings: { ...settings },
      controls: { ...controls },
      state: {
        ...state,
        players: state.players.map((p) => ({ ...p })),
        darts: [...state.darts],
        history: [...state.history],
      },
      aim: { ...aim },
      prototypeStep: prototypeAim.step,
      charging: !!charge,
      soundOn,
      feedback: { ...currentFeedback },
      result,
    };
    for (const listener of listeners) listener();
  }
  function updateAim() {
    render();
  }
  function resetMeter() {
    charge = null;
    elements.meterMarker.style.left = "0%";
    elements.releaseMeter.setAttribute("aria-valuenow", "0");
    elements.releaseMeter.classList.remove("charging");
    elements.throwButton.classList.remove("charging");
  }
  function powerAt(t: number) {
    const cycle = (t / 1150) % 2;
    return cycle <= 1 ? cycle : 2 - cycle;
  }
  function swayAt(t: number) {
    return {
      x: Math.sin(t * 0.0027) * 0.007 + Math.sin(t * 0.0061) * 0.002,
      y: Math.cos(t * 0.0022) * 0.006,
    };
  }
  function beginCharge() {
    if (!canThrow() || charge || (isPrototype() && prototypeAim.step !== 2))
      return;
    unlockAudio();
    charge = { start: clock };
    elements.releaseMeter.classList.add("charging");
    render();
  }
  function actionDown() {
    if (!canThrow()) return;
    if (!isPrototype()) {
      beginCharge();
      return;
    }
    unlockAudio();
    if (prototypeAim.step === 0) {
      aim.y = prototypeAim.pos;
      prototypeAim.step = 1;
      prototypeAim.elapsed = 0;
      prototypeAim.pos = 0;
      render();
    } else if (prototypeAim.step === 1) {
      aim.x = prototypeAim.pos;
      prototypeAim.step = 2;
      resetMeter();
      render();
    } else if (prototypeAim.step === 2) beginCharge();
    else {
      resetPrototypeAim();
      resetMeter();
      render();
    }
  }
  function cancelCharge() {
    if (!charge) return;
    resetMeter();
    render();
  }
  function releaseCharge() {
    if (!charge) return;
    if (!canThrow()) {
      cancelCharge();
      return;
    }
    const hold = clock - charge.start;
    if (isPrototype()) {
      const power = prototypePower(hold),
        result = prototypeLanding(aim, power);
      const quality =
        (result.accurate
          ? "Accurate release"
          : "Outside green — dart scattered") +
        " · " +
        Math.round(power * 100) +
        "%";
      charge = null;
      prototypeAim.step = 3;
      elements.releaseMeter.classList.remove("charging");
      launch(result.point, quality, false);
      return;
    }
    if (hold < 110) {
      cancelCharge();
      feedback("Hold a little longer.", "Let the marker reach the gold band.");
      return;
    }
    const power = powerAt(hold),
      error = 0.62 - power,
      sway = swayAt(clock);
    const landing = {
      x: aim.x + sway.x + Math.sin(clock * 0.003) * Math.abs(error) * 0.07,
      y: aim.y + sway.y + error * 0.4,
    };
    const quality =
      Math.abs(error) < 0.035
        ? "Perfect release"
        : Math.abs(error) < 0.07
          ? "Good release"
          : error > 0
            ? "Early release — landed low"
            : "Late release — landed high";
    charge = null;
    elements.releaseMeter.classList.remove("charging");
    launch(landing, quality, false);
  }
  function launch(point: Point, quality: string, bot: boolean) {
    state.phase = "flight";
    flight = {
      point,
      quality,
      bot,
      start: clock,
      duration: reducedMotion ? 100 : 340,
    };
    render();
    playSound("throw");
  }
  function finishFlight() {
    const shot = flight;
    if (!shot) return;
    flight = null;
    const hit = scoreAt(shot.point.x, shot.point.y),
      p = player();
    state.darts.push({
      x: shot.point.x,
      y: shot.point.y,
      hit,
      at: clock,
      bot: shot.bot,
    });
    p.darts++;
    if (isPractice()) state.visitTotal += hit.value;
    else {
      const result = resolveDart(p.remaining, state.visitStart, hit);
      p.remaining = result.remaining;
      state.visitBust = result.bust;
      if (!result.bust) state.visitTotal += hit.value;
      if (result.won) {
        finishVisit();
        p.legs++;
        state.phase =
          p.legs >= Math.ceil(settings.legs / 2) ? "match-end" : "leg-end";
        feedback(
          "Game shot!",
          p.name + " finishes on " + hit.label.toLowerCase() + ".",
        );
        announce("GAME SHOT");
        playSound("win");
        render();
        schedule(showResult, 1000);
        return;
      }
    }
    playSound(hit.value === 50 || hit.multiplier === 3 ? "good" : "hit");
    if (state.visitBust) {
      feedback(
        "Bust. Take a breath.",
        "Back to " + state.visitStart + " — the whole visit is undone.",
        true,
      );
      announce("BUST");
      playSound("bust");
    } else {
      feedback(
        hit.value === 0 ? "Just outside." : hit.label + ".",
        shot.bot
          ? hit.value + " scored."
          : shot.quality + " · " + hit.value + " scored",
      );
      if (hit.value === 50) announce("BULLSEYE");
    }
    if (state.darts.length === 3 || state.visitBust) {
      finishVisit();
      if (state.visitTotal === 180 && !state.visitBust) {
        announce("180");
        feedback(
          "One hundred and eighty!",
          "Three in the treble. Beautifully done.",
        );
        playSound("win");
      }
      state.phase = isComputer() ? "ai-finished" : "turn-end";
      render();
      if (isComputer()) schedule(() => beginTurn(0), 1250);
    } else {
      state.phase = isComputer() ? "ai-aim" : "ready";
      render();
      if (isComputer()) schedule(computerThrow, 950);
    }
  }
  function finishVisit() {
    if (state.visitFinished) return;
    state.visitFinished = true;
    const total = state.visitBust ? 0 : state.visitTotal,
      p = player();
    p.points += total;
    p.best = Math.max(p.best, total);
    p.visits++;
    state.history.unshift({
      name: p.name,
      total,
      bust: state.visitBust,
      darts: state.darts.map((d) => d.hit.short),
    });
  }
  function nextTurn() {
    unlockAudio();
    if (state.phase !== "turn-end") return;
    beginTurn(isPractice() ? 0 : 1 - state.current);
  }
  function computerThrow() {
    if (!isComputer() || state.phase !== "ai-aim") return;
    const target = chooseTarget(player().remaining, 3 - state.darts.length);
    aim = pointFor(target.number, target.multiplier);
    updateAim();
    const sigma = { casual: 0.15, club: 0.072, expert: 0.026 }[
      settings.difficulty
    ];
    const point = {
      x: aim.x + gaussian() * sigma,
      y: aim.y + gaussian() * sigma,
    };
    schedule(() => launch(point, "", true), 500);
  }
  function nextLeg() {
    unlockAudio();
    if (state.phase === "match-end") {
      startGame();
      return;
    }
    if (state.phase !== "leg-end") return;
    state.leg++;
    state.starter = 1 - state.starter;
    for (const p of state.players) p.remaining = Number(settings.mode);
    timers = [];
    elements.dialogs["result-dialog"].close();
    beginTurn(state.starter);
  }
  function showResult() {
    const p = player(),
      wonMatch = state.phase === "match-end";
    result = {
      eyebrow: wonMatch ? "MATCH COMPLETE" : "GAME SHOT",
      number: state.players.map((p) => p.legs).join(" — "),
      title:
        (p.name === "You" ? "You take" : p.name + " takes") +
        (wonMatch ? " the match." : " the leg."),
      description: wonMatch
        ? p.name === "You"
          ? "A well-earned finish. Fancy another?"
          : p.name + " found the finish. There’s always the next match."
        : "The opening throw alternates. Next up: " +
          state.players[1 - state.starter].name +
          ".",
      average: average(p),
      best: p.best,
      darts: p.darts,
      continueLabel: wonMatch ? "Play again" : "Next leg",
    };
    render();
    if (!elements.dialogs["result-dialog"].open)
      elements.dialogs["result-dialog"].showModal();
  }
  function announce(text: string) {
    elements.announcement.textContent = text;
    elements.announcement.classList.add("show");
    announcementUntil = clock + 1250;
  }

  function drawDart(x: number, y: number, bot = false, scale = 1) {
    const px = C + x * R,
      py = C + y * R;
    cSave();
    ctx.translate(px, py);
    ctx.rotate(-0.42);
    ctx.scale(scale, scale);
    ctx.shadowColor = "#0009";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = "#dedfce";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -18);
    ctx.stroke();
    ctx.strokeStyle = "#959e90";
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, -35);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 ? "#d3d4bf" : "#5c6b61";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -18 - i * 2.5);
      ctx.lineTo(2, -18 - i * 2.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#ced0c4";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(0, -55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(-9, -53);
    ctx.lineTo(-7, -66);
    ctx.lineTo(0, -62);
    ctx.lineTo(7, -66);
    ctx.lineTo(9, -53);
    ctx.closePath();
    ctx.fillStyle = bot ? "#709b96" : "#d9b46d";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -39);
    ctx.lineTo(0, -64);
    ctx.strokeStyle = bot ? "#c0d4c8" : "#fff0ba";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  function cSave() {
    ctx.save();
  }
  function drawPrototypeGuides() {
    const step = prototypeAim.step,
      guide = "#79d4e8",
      locked = "#f2cb75";
    ctx.save();
    ctx.shadowColor = "#07130f";
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1.8;
    if (step < 2) {
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = step === 0 ? guide : locked;
      const y = C + (step === 0 ? prototypeAim.pos : aim.y) * R;
      ctx.beginPath();
      ctx.moveTo(C - R, y);
      ctx.lineTo(C + R, y);
      ctx.stroke();
      if (step === 1) {
        const x = C + prototypeAim.pos * R;
        ctx.strokeStyle = guide;
        ctx.beginPath();
        ctx.moveTo(x, C - R);
        ctx.lineTo(x, C + R);
        ctx.stroke();
      }
    } else {
      const x = C + aim.x * R,
        y = C + aim.y * R;
      ctx.strokeStyle = locked;
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      ctx.lineTo(x + 14, y);
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
      circle(ctx, x, y, 8, null, locked, 1.2);
    }
    ctx.restore();
  }
  function drawFrame() {
    ctx.clearRect(0, 0, 700, 700);
    ctx.drawImage(board, 0, 0, 700, 700);
    for (const dart of state.darts) {
      if (clock - dart.at < 400 && !reducedMotion) {
        const progress = (clock - dart.at) / 400;
        circle(
          ctx,
          C + dart.x * R,
          C + dart.y * R,
          5 + progress * 18,
          null,
          "rgba(238,204,136," + (1 - progress) * 0.7 + ")",
          1.5,
        );
      }
      drawDart(dart.x, dart.y, dart.bot);
    }
    if ((state.phase === "ready" || state.phase === "ai-aim") && !modalOpen()) {
      if (isPrototype() && !isComputer()) drawPrototypeGuides();
      else {
        const sway = swayAt(clock),
          ax = C + (aim.x + (charge ? sway.x : 0)) * R,
          ay = C + (aim.y + (charge ? sway.y : 0)) * R,
          color = isComputer() ? "#a3c7be" : "#f4cf7f";
        ctx.save();
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 5;
        circle(ctx, ax, ay, charge ? 10 : 12, null, color, 1.4);
        circle(ctx, ax, ay, 2, color);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          ctx.beginPath();
          ctx.moveTo(ax + dx * 16, ay + dy * 16);
          ctx.lineTo(ax + dx * 21, ay + dy * 21);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (flight) {
      const t = Math.min(1, (clock - flight.start) / flight.duration),
        e = 1 - Math.pow(1 - t, 2);
      const x = flight.point.x * e,
        y = 1.7 + (flight.point.y - 1.7) * e;
      drawDart(x, y, flight.bot, 1 + (1 - e) * 1.8);
    }
  }
  function frame(real: number) {
    const delta = lastFrame ? Math.min(70, real - lastFrame) : 16;
    lastFrame = real;
    if (!modalOpen() && !document.hidden) {
      clock += delta;
      if (isPrototype() && canThrow() && prototypeAim.step < 2) {
        prototypeAim.elapsed += Math.min(delta, 50) / 1000;
        prototypeAim.pos = prototypePosition(
          prototypeAim.elapsed,
          controls.aimingSpeed,
        );
      }
      if (charge) {
        const p = isPrototype()
          ? prototypePower(clock - charge.start)
          : powerAt(clock - charge.start);
        elements.meterMarker.style.left = p * 100 + "%";
        elements.releaseMeter.setAttribute(
          "aria-valuenow",
          String(Math.round(p * 100)),
        );
      }
      if (flight && clock - flight.start >= flight.duration) finishFlight();
      const due = timers.filter((t) => t.at <= clock);
      timers = timers.filter((t) => t.at > clock);
      for (const t of due) t.fn();
      if (announcementUntil && clock > announcementUntil) {
        elements.announcement.classList.remove("show");
        announcementUntil = 0;
      }
    }
    drawFrame();
    animationFrame = requestAnimationFrame(frame);
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(700 * dpr);
    canvas.height = Math.round(700 * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function setAimFromPointer(e: PointerEvent) {
    if (!canThrow() || charge || isPrototype()) return;
    const rect = canvas.getBoundingClientRect();
    aim = {
      x: (((e.clientX - rect.left) / rect.width) * 700 - C) / R,
      y: (((e.clientY - rect.top) / rect.height) * 700 - C) / R,
    };
    const radius = Math.hypot(aim.x, aim.y);
    if (radius > 1.12) {
      aim.x *= 1.12 / radius;
      aim.y *= 1.12 / radius;
    }
    updateAim();
  }

  listen(canvas, "pointerdown", (e) => {
    if (!canThrow()) return;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    if (isPrototype()) return;
    dragPointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    setAimFromPointer(e);
  });
  listen(canvas, "pointermove", (e) => {
    if (e.pointerId === dragPointer) setAimFromPointer(e);
  });
  listen(canvas, "pointerup", () => {
    dragPointer = null;
  });
  listen(canvas, "pointercancel", () => {
    dragPointer = null;
  });
  listen(canvas, "keydown", (e) => {
    if (!canThrow() || charge || isPrototype() || !e.key.startsWith("Arrow"))
      return;
    e.preventDefault();
    const amount = e.shiftKey ? 0.004 : 0.017;
    aim.x +=
      e.key === "ArrowRight" ? amount : e.key === "ArrowLeft" ? -amount : 0;
    aim.y += e.key === "ArrowDown" ? amount : e.key === "ArrowUp" ? -amount : 0;
    aim.x = Math.max(-1.1, Math.min(1.1, aim.x));
    aim.y = Math.max(-1.1, Math.min(1.1, aim.y));
    updateAim();
  });
  const throwButton = elements.throwButton;
  listen(throwButton, "pointerdown", (e) => {
    if (e.button !== 0 || !canThrow() || throwPointer !== null) return;
    e.preventDefault();
    throwPointer = e.pointerId;
    throwButton.setPointerCapture(e.pointerId);
    actionDown();
  });
  listen(throwButton, "pointerup", (e) => {
    if (e.pointerId !== throwPointer) return;
    e.preventDefault();
    throwPointer = null;
    releaseCharge();
  });
  listen(throwButton, "pointercancel", () => {
    throwPointer = null;
    cancelCharge();
  });
  listen(throwButton, "lostpointercapture", () => {
    if (throwPointer !== null) {
      throwPointer = null;
      cancelCharge();
    }
  });
  listen(throwButton, "contextmenu", (e) => e.preventDefault());
  listen(throwButton, "click", (e) => {
    if (e.detail === 0) {
      if (charge) releaseCharge();
      else actionDown();
    }
  });
  listen(document, "keydown", (e) => {
    const eligible = [
      document.body,
      document.documentElement,
      canvas,
      throwButton,
    ].some((element) => element === e.target);
    if (
      eligible &&
      !modalOpen() &&
      (e.code === "Space" || (e.key === "Enter" && e.target === throwButton))
    ) {
      e.preventDefault();
      if (!e.repeat) actionDown();
    }
  });
  listen(document, "keyup", (e) => {
    if ((e.code === "Space" || e.key === "Enter") && charge) {
      e.preventDefault();
      releaseCharge();
    }
  });
  listen(window, "blur", cancelCharge);
  listen(document, "visibilitychange", () => {
    if (document.hidden) cancelCharge();
  });
  function openDialog(id: DialogId) {
    cancelCharge();
    elements.dialogs[id].showModal();
  }
  function unlockAudio() {
    if (!soundOn) return;
    try {
      audioContext ??= new (
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      )();
      if (audioContext.state === "suspended")
        void audioContext.resume().catch(() => {});
    } catch {
      soundOn = false;
      render();
    }
  }
  function playSound(type: "throw" | "hit" | "good" | "win" | "bust") {
    if (!soundOn || !audioContext || audioContext.state !== "running") return;
    const ac = audioContext,
      now = ac.currentTime;
    if (type === "throw" || type === "hit" || type === "good") {
      const dur = type === "throw" ? 0.1 : 0.09,
        buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const source = ac.createBufferSource();
      source.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = type === "throw" ? 2300 : 620;
      const gain = ac.createGain();
      gain.gain.value = type === "throw" ? 0.07 : 0.3;
      source.connect(filter).connect(gain).connect(ac.destination);
      source.start(now);
    }
    if (type === "win" || type === "good" || type === "bust") {
      const notes =
        type === "win"
          ? [440, 554.4, 659.3, 880]
          : type === "good"
            ? [660, 880]
            : [180, 140];
      notes.forEach((hz, i) => {
        const osc = ac.createOscillator(),
          gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.07, now + i * 0.1 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.22);
        osc.connect(gain).connect(ac.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.25);
      });
    }
  }
  function toggleSound() {
    soundOn = !soundOn;
    render();
    unlockAudio();
    if (soundOn) playSound("good");
  }

  // Optional page-scoped tools use the same match state and actions as the controls.
  const modelContext = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (modelContext?.registerTool) {
    listen(window, "pagehide", () => lifecycle.abort());
    const snapshot = () => ({
      mode: settings.mode,
      opponent: settings.opponent,
      leg: state.leg,
      phase: state.phase,
      turn: player().name,
      throwingMechanic: controls.mechanic,
      aimingSpeed: controls.aimingSpeed,
      players: state.players.map((p) => ({
        name: p.name,
        remaining: isPractice() ? null : p.remaining,
        legs: p.legs,
        average: Number(average(p)),
        bestVisit: p.best,
      })),
      visit: state.darts.map((d) => d.hit.short),
    });
    const register = (tool: PageTool) => {
      try {
        void Promise.resolve(
          modelContext.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "get_darts_match",
      title: "Read darts match",
      description:
        "Read the current score, player, leg, and darts in this visit.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (input && Object.keys(Object(input)).length)
          throw new Error("No arguments expected.");
        return snapshot();
      },
    });
    register({
      name: "start_darts_game",
      title: "Start a darts game",
      description:
        "Replace the current game with a new 501, 301, or practice game using the visible game settings.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["501", "301", "practice"] },
          opponent: { type: "string", enum: ["computer", "local"] },
          difficulty: { type: "string", enum: ["casual", "club", "expert"] },
          legs: { type: "integer", enum: [1, 3, 5] },
        },
        required: ["mode"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !isRecord(input) ||
          Object.keys(input).some(
            (k) => !["mode", "opponent", "difficulty", "legs"].includes(k),
          ) ||
          !isMode(input.mode) ||
          (input.opponent !== undefined && !isOpponent(input.opponent)) ||
          (input.difficulty !== undefined && !isDifficulty(input.difficulty)) ||
          (input.legs !== undefined && !isMatchLength(input.legs))
        )
          throw new Error("Invalid game settings.");
        startGame({
          mode: input.mode,
          opponent: isOpponent(input.opponent) ? input.opponent : "computer",
          difficulty: isDifficulty(input.difficulty)
            ? input.difficulty
            : "club",
          legs: isMatchLength(input.legs) ? input.legs : 3,
        });
        return snapshot();
      },
    });
  }
  drawBase();
  resize();
  startGame();
  animationFrame = requestAnimationFrame(frame);
  listen(window, "resize", resize);

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => view,
    startGame,
    setThrowingMechanic,
    setAimingSpeed,
    openDialog,
    nextTurn,
    nextLeg,
    showResult,
    toggleSound,
    dispose() {
      disposed = true;
      lifecycle.abort();
      cancelAnimationFrame(animationFrame);
      timers = [];
      listeners.clear();
      if (audioContext) void audioContext.close().catch(() => {});
    },
  };

  function listen<K extends keyof RuntimeEventMap>(
    target: HTMLElement | Document | Window,
    type: K,
    handler: (event: RuntimeEventMap[K]) => void,
  ) {
    target.addEventListener(type, handler as EventListener, {
      signal: lifecycle.signal,
    });
  }
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("The Oche requires a browser with a 2D canvas.");
  return context;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
export function isMode(value: unknown): value is GameSettings["mode"] {
  return value === "501" || value === "301" || value === "practice";
}
export function isOpponent(value: unknown): value is GameSettings["opponent"] {
  return value === "computer" || value === "local";
}
export function isDifficulty(
  value: unknown,
): value is GameSettings["difficulty"] {
  return value === "casual" || value === "club" || value === "expert";
}
export function isMatchLength(value: unknown): value is GameSettings["legs"] {
  return value === 1 || value === 3 || value === 5;
}
