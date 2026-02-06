import { TetrisEngine } from "@/lib/tetris/engine";
import type { GameSnapshot } from "@/lib/tetris/types";
import { GAME_MODES, type GameModeId } from "@/lib/shared/game-mode";

export type SessionEndReason = "top_out" | "sprint_complete" | "time_up" | null;

export interface SessionSnapshot {
  mode: GameModeId;
  running: boolean;
  paused: boolean;
  elapsedMs: number;
  remainingMs: number | null;
  progress: number;
  objectiveLabel: string;
  endReason: SessionEndReason;
  game: GameSnapshot;
}

export class TetrisSession {
  private readonly engine: TetrisEngine;

  private mode: GameModeId;

  private elapsedMs = 0;

  private paused = false;

  private endReason: SessionEndReason = null;

  constructor(mode: GameModeId = "classic", random: () => number = Math.random) {
    this.mode = mode;
    this.engine = new TetrisEngine(random);
  }

  reset(mode?: GameModeId): void {
    if (mode) {
      this.mode = mode;
    }
    this.engine.reset();
    this.elapsedMs = 0;
    this.paused = false;
    this.endReason = null;
  }

  setPaused(value: boolean): void {
    this.paused = value;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  update(deltaMs: number): void {
    if (this.paused || this.endReason) {
      return;
    }

    this.elapsedMs += deltaMs;
    this.engine.update(deltaMs);
    this.evaluateEndConditions();
  }

  moveHorizontal(direction: -1 | 1): boolean {
    if (this.paused || this.endReason) {
      return false;
    }
    const moved = this.engine.moveHorizontal(direction);
    this.evaluateEndConditions();
    return moved;
  }

  rotate(clockwise = true): boolean {
    if (this.paused || this.endReason) {
      return false;
    }
    const rotated = this.engine.rotate(clockwise);
    this.evaluateEndConditions();
    return rotated;
  }

  softDrop(): boolean {
    if (this.paused || this.endReason) {
      return false;
    }
    const dropped = this.engine.softDrop();
    this.evaluateEndConditions();
    return dropped;
  }

  hardDrop(): number {
    if (this.paused || this.endReason) {
      return 0;
    }
    const distance = this.engine.hardDrop();
    this.evaluateEndConditions();
    return distance;
  }

  hold(): boolean {
    if (this.paused || this.endReason) {
      return false;
    }
    const held = this.engine.holdCurrentPiece();
    this.evaluateEndConditions();
    return held;
  }

  getEngine(): TetrisEngine {
    return this.engine;
  }

  getSnapshot(): SessionSnapshot {
    const remainingMs =
      this.mode === "blitz120"
        ? Math.max(0, (GAME_MODES.blitz120.durationMs ?? 0) - this.elapsedMs)
        : null;
    const progress = this.computeProgress();
    const objectiveLabel =
      this.mode === "classic"
        ? "Sobreviva o maximo possivel."
        : this.mode === "sprint40"
          ? `Linhas: ${Math.min(this.engine.lines, GAME_MODES.sprint40.targetLines ?? 40)}/${GAME_MODES.sprint40.targetLines ?? 40}`
          : `Tempo restante: ${Math.ceil((remainingMs ?? 0) / 1000)}s`;

    return {
      mode: this.mode,
      running: !this.endReason,
      paused: this.paused,
      elapsedMs: this.elapsedMs,
      remainingMs,
      progress,
      objectiveLabel,
      endReason: this.endReason,
      game: this.engine.getSnapshot()
    };
  }

  private evaluateEndConditions(): void {
    if (this.endReason) {
      return;
    }

    if (this.engine.gameOver) {
      this.endReason = "top_out";
      return;
    }

    if (this.mode === "sprint40" && this.engine.lines >= (GAME_MODES.sprint40.targetLines ?? 40)) {
      this.endReason = "sprint_complete";
      return;
    }

    if (this.mode === "blitz120" && this.elapsedMs >= (GAME_MODES.blitz120.durationMs ?? 120_000)) {
      this.endReason = "time_up";
      return;
    }
  }

  private computeProgress(): number {
    if (this.mode === "sprint40") {
      const target = GAME_MODES.sprint40.targetLines ?? 40;
      return Math.min(1, this.engine.lines / target);
    }

    if (this.mode === "blitz120") {
      const duration = GAME_MODES.blitz120.durationMs ?? 120_000;
      return Math.min(1, this.elapsedMs / duration);
    }

    return 0;
  }
}
