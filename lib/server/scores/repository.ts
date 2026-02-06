import type { GameModeId } from "@/lib/shared/game-mode";
import type { ScoreEntry, ScoreSubmission } from "@/lib/server/scores/types";
import { compareScoreEntries } from "@/lib/server/scores/sort";

export interface ScoreRepository {
  add(submission: ScoreSubmission): ScoreEntry;
  list(options?: { mode?: GameModeId; limit?: number }): ScoreEntry[];
  clear(): void;
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

    return [...filtered].sort(compareScoreEntries).slice(0, Math.max(1, Math.min(limit, 50)));
  }

  clear(): void {
    this.scores.length = 0;
  }
}
