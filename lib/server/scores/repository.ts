import type { GameModeId } from "@/lib/shared/game-mode";
import type { ScoreEntry, ScoreSubmission } from "@/lib/server/scores/types";

export interface ScoreRepository {
  add(submission: ScoreSubmission): ScoreEntry;
  list(options?: { mode?: GameModeId; limit?: number }): ScoreEntry[];
  clear(): void;
}

function compareScore(a: ScoreEntry, b: ScoreEntry): number {
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

export class InMemoryScoreRepository implements ScoreRepository {
  private readonly scores: ScoreEntry[] = [];

  add(submission: ScoreSubmission): ScoreEntry {
    const entry: ScoreEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...submission
    };
    this.scores.push(entry);
    return entry;
  }

  list(options: { mode?: GameModeId; limit?: number } = {}): ScoreEntry[] {
    const filtered = options.mode
      ? this.scores.filter((entry) => entry.mode === options.mode)
      : this.scores;
    const limit = options.limit ?? 10;

    return [...filtered].sort(compareScore).slice(0, Math.max(1, Math.min(limit, 50)));
  }

  clear(): void {
    this.scores.length = 0;
  }
}
