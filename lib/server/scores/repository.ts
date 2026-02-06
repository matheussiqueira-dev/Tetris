/**
 * Score Repository Module
 * Provides data access layer for score persistence with in-memory implementation.
 */

import type { GameModeId } from "@/lib/shared/game-mode";
import type { ScoreEntry, ScoreSubmission } from "@/lib/server/scores/types";
import { compareScoreEntries } from "@/lib/server/scores/sort";

export interface ScoreRepository {
  add(submission: ScoreSubmission): ScoreEntry;
  list(options?: { mode?: GameModeId; limit?: number }): ScoreEntry[];
  count(mode?: GameModeId): number;
  getLastUpdated(): string | null;
  clear(): void;
}

/**
 * In-memory implementation of ScoreRepository.
 * Suitable for development and testing. Replace with database implementation for production.
 */
export class InMemoryScoreRepository implements ScoreRepository {
  private readonly scores: ScoreEntry[] = [];
  private lastUpdatedAt: string | null = null;

  add(submission: ScoreSubmission): ScoreEntry {
    const entry: ScoreEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...submission
    };
    this.scores.push(entry);
    this.lastUpdatedAt = entry.createdAt;
    return entry;
  }

  list(options: { mode?: GameModeId; limit?: number } = {}): ScoreEntry[] {
    const filtered = options.mode
      ? this.scores.filter((entry) => entry.mode === options.mode)
      : this.scores;
    const limit = options.limit ?? 10;

    return [...filtered].sort(compareScoreEntries).slice(0, Math.max(1, Math.min(limit, 50)));
  }

  count(mode?: GameModeId): number {
    if (mode) {
      return this.scores.filter((entry) => entry.mode === mode).length;
    }
    return this.scores.length;
  }

  getLastUpdated(): string | null {
    return this.lastUpdatedAt;
  }

  clear(): void {
    this.scores.length = 0;
    this.lastUpdatedAt = null;
  }
}
