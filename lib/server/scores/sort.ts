import type { ScoreEntry } from "@/lib/server/scores/types";

export function compareScoreEntries(a: ScoreEntry, b: ScoreEntry): number {
  if (a.mode !== b.mode) {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    if (a.lines !== b.lines) {
      return b.lines - a.lines;
    }
    return a.durationMs - b.durationMs;
  }

  if (a.mode === "sprint40") {
    if (a.lines !== b.lines) {
      return b.lines - a.lines;
    }
    if (a.durationMs !== b.durationMs) {
      return a.durationMs - b.durationMs;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return b.createdAt.localeCompare(a.createdAt);
  }

  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.lines !== b.lines) {
    return b.lines - a.lines;
  }
  if (a.durationMs !== b.durationMs) {
    return a.durationMs - b.durationMs;
  }
  return b.createdAt.localeCompare(a.createdAt);
}
