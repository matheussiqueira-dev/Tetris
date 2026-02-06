import { describe, expect, it } from "vitest";
import { TetrisSession } from "@/lib/tetris/session";

describe("TetrisSession", () => {
  it("encerra blitz quando tempo limite termina", () => {
    const session = new TetrisSession("blitz120");
    session.update(120_200);

    const snapshot = session.getSnapshot();
    expect(snapshot.endReason).toBe("time_up");
    expect(snapshot.running).toBe(false);
  });

  it("encerra sprint quando meta de linhas eh atingida", () => {
    const session = new TetrisSession("sprint40");
    session.getEngine().lines = 40;
    session.update(0);

    const snapshot = session.getSnapshot();
    expect(snapshot.endReason).toBe("sprint_complete");
  });

  it("nao avanca tempo quando pausado", () => {
    const session = new TetrisSession("classic");
    session.setPaused(true);
    const before = session.getSnapshot().elapsedMs;

    session.update(10_000);
    const after = session.getSnapshot().elapsedMs;
    expect(after).toBe(before);
  });
});
