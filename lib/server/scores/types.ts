import type { GameModeId } from "@/lib/shared/game-mode";

export interface ScoreSubmission {
  name: string;
  score: number;
  lines: number;
  level: number;
  mode: GameModeId;
  durationMs: number;
}

export interface ScoreEntry extends ScoreSubmission {
  id: string;
  createdAt: string;
}
