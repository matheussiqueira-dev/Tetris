import { describe, expect, it } from "vitest";
import { compareScoreEntries } from "@/lib/server/scores/sort";
import type { ScoreEntry } from "@/lib/server/scores/types";

function entry(partial: Partial<ScoreEntry>): ScoreEntry {
  return {
    id: partial.id ?? "id",
    createdAt: partial.createdAt ?? new Date().toISOString(),
    name: partial.name ?? "Player",
    score: partial.score ?? 0,
    lines: partial.lines ?? 0,
    level: partial.level ?? 1,
    mode: partial.mode ?? "classic",
    durationMs: partial.durationMs ?? 0
  };
}

describe("compareScoreEntries", () => {
  it("prioriza maior score no modo classic", () => {
    const result = compareScoreEntries(
      entry({ mode: "classic", score: 2000, lines: 10, durationMs: 50000 }),
      entry({ mode: "classic", score: 1000, lines: 30, durationMs: 10000 })
    );
    expect(result).toBeLessThan(0);
  });

  it("prioriza menor tempo no sprint quando linhas iguais", () => {
    const result = compareScoreEntries(
      entry({ mode: "sprint40", lines: 40, durationMs: 70_000, score: 900 }),
      entry({ mode: "sprint40", lines: 40, durationMs: 82_000, score: 1200 })
    );
    expect(result).toBeLessThan(0);
  });

  it("prioriza mais linhas no sprint mesmo com tempo pior", () => {
    const result = compareScoreEntries(
      entry({ mode: "sprint40", lines: 41, durationMs: 95_000 }),
      entry({ mode: "sprint40", lines: 40, durationMs: 60_000 })
    );
    expect(result).toBeLessThan(0);
  });
});
