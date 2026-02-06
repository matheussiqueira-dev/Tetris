import { describe, expect, it } from "vitest";
import { TetrisEngine } from "@/lib/tetris/engine";

describe("TetrisEngine", () => {
  it("inicializa com peca atual e peca seguinte", () => {
    const engine = new TetrisEngine(() => 0.42);
    const snapshot = engine.getSnapshot();

    expect(snapshot.current).not.toBeNull();
    expect(snapshot.next).toBeDefined();
    expect(snapshot.hold).toBeNull();
    expect(snapshot.canHold).toBe(true);
  });

  it("permite hold uma vez por turno ate travar a peca", () => {
    const engine = new TetrisEngine(() => 0.33);
    const held = engine.holdCurrentPiece();

    expect(held).toBe(true);
    expect(engine.getHoldPieceType()).not.toBeNull();
    expect(engine.canHoldCurrentPiece()).toBe(false);
    expect(engine.holdCurrentPiece()).toBe(false);

    engine.hardDrop();
    expect(engine.canHoldCurrentPiece()).toBe(true);
  });

  it("hard drop aumenta score pela distancia", () => {
    const engine = new TetrisEngine(() => 0.61);
    const before = engine.score;
    const distance = engine.hardDrop();

    expect(distance).toBeGreaterThan(0);
    expect(engine.score).toBeGreaterThan(before);
  });

  it("limpa linha completa e incrementa contador de linhas", () => {
    const engine = new TetrisEngine(() => 0.17);

    for (let x = 1; x < 10; x += 1) {
      engine.board[19][x] = 2;
    }

    engine.current = {
      type: "O",
      matrix: [[1]],
      x: 0,
      y: 0
    };

    engine.hardDrop();
    expect(engine.lines).toBe(1);
    expect(engine.score).toBeGreaterThan(0);
  });
});
