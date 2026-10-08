export type GameMode = "501" | "301" | "practice";
export type Opponent = "computer" | "local";
export type Difficulty = "casual" | "club" | "expert";
export type MatchLength = 1 | 3 | 5;
export type ThrowingMechanic = "classic" | "prototype";
export type PrototypeStep = 0 | 1 | 2 | 3;
export type GamePhase =
  | "ready"
  | "ai-aim"
  | "flight"
  | "turn-end"
  | "ai-finished"
  | "leg-end"
  | "match-end";

export interface Point {
  x: number;
  y: number;
}
export interface Target {
  number: number;
  multiplier: number;
}
export interface CheckoutTarget extends Target {
  value: number;
  short: string;
}
export interface Hit extends CheckoutTarget {
  label: string;
  double: boolean;
}
export interface GameSettings {
  mode: GameMode;
  opponent: Opponent;
  difficulty: Difficulty;
  legs: MatchLength;
}
export interface ControlPreferences {
  mechanic: ThrowingMechanic;
  aimingSpeed: number;
}
export interface Player {
  name: string;
  remaining: number;
  legs: number;
  points: number;
  darts: number;
  visits: number;
  best: number;
}
export interface Dart extends Point {
  hit: Hit;
  at: number;
  bot: boolean;
}
export interface Visit {
  name: string;
  total: number;
  bust: boolean;
  darts: string[];
}
export interface GameState {
  players: Player[];
  current: number;
  starter: number;
  leg: number;
  phase: GamePhase;
  visitStart: number;
  visitTotal: number;
  visitBust: boolean;
  visitFinished: boolean;
  darts: Dart[];
  history: Visit[];
}
export interface Feedback {
  title: string;
  detail: string;
  bust: boolean;
}
export interface Result {
  eyebrow: string;
  number: string;
  title: string;
  description: string;
  average: string;
  best: number;
  darts: number;
  continueLabel: string;
}
export interface GameView {
  settings: GameSettings;
  controls: ControlPreferences;
  state: GameState;
  aim: Point;
  prototypeStep: PrototypeStep;
  charging: boolean;
  soundOn: boolean;
  feedback: Feedback;
  result: Result | null;
}
export type DialogId =
  "settings-dialog" | "setup-dialog" | "help-dialog" | "result-dialog";
export interface GameElements {
  canvas: HTMLCanvasElement;
  announcement: HTMLDivElement;
  meterMarker: HTMLSpanElement;
  releaseMeter: HTMLDivElement;
  throwButton: HTMLButtonElement;
  dialogs: Record<DialogId, HTMLDialogElement>;
}
export interface GameController {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => GameView;
  startGame: (settings?: GameSettings) => void;
  setThrowingMechanic: (mechanic: ThrowingMechanic) => void;
  setAimingSpeed: (speed: number) => void;
  openDialog: (id: DialogId) => void;
  nextTurn: () => void;
  nextLeg: () => void;
  showResult: () => void;
  toggleSound: () => void;
  dispose: () => void;
}

// Optional browser agent integration. Input remains unknown until validated.
export interface PageTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
export interface ModelContext {
  registerTool: (tool: PageTool, options: { signal: AbortSignal }) => unknown;
}
