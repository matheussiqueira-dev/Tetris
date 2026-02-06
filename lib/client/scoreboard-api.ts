/**
 * Scoreboard Client API
 * Provides typed methods for interacting with the scores API.
 */

import type { GameModeId } from "@/lib/shared/game-mode";

export interface ScoreItem {
  id: string;
  name: string;
  score: number;
  lines: number;
  level: number;
  mode: GameModeId;
  durationMs: number;
  createdAt: string;
}

export interface SubmitScorePayload {
  name: string;
  score: number;
  lines: number;
  level: number;
  mode: GameModeId;
  durationMs: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    error: string;
    code: string;
    retryAfterMs?: number;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

interface ScoresListData {
  items: ScoreItem[];
  total: number;
  mode?: GameModeId;
}

interface SubmitScoreData {
  item: ScoreItem;
  placement: number;
  isHighScore: boolean;
}

const SCORES_ENDPOINT = "/api/v1/scores";

/**
 * Fetches scores from the API with optional filtering.
 */
export async function fetchScores(mode: GameModeId, limit = 8): Promise<ScoreItem[]> {
  const response = await fetch(`${SCORES_ENDPOINT}?mode=${mode}&limit=${limit}`, {
    method: "GET",
    cache: "no-store"
  });

  const json = (await response.json()) as ApiResponse<ScoresListData>;

  if (!response.ok || !json.success) {
    throw new Error(json.error?.error ?? "Falha ao carregar placar.");
  }

  return json.data?.items ?? [];
}

/**
 * Gets total score count for a mode.
 */
export async function getScoresCount(mode?: GameModeId): Promise<number> {
  const url = mode ? `${SCORES_ENDPOINT}?mode=${mode}&limit=1` : `${SCORES_ENDPOINT}?limit=1`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  const json = (await response.json()) as ApiResponse<ScoresListData>;

  if (!response.ok || !json.success) {
    return 0;
  }

  return json.data?.total ?? 0;
}

/**
 * Submits a new score to the API.
 */
export async function submitScore(
  payload: SubmitScorePayload
): Promise<{ item: ScoreItem; placement: number; isHighScore: boolean }> {
  const response = await fetch(SCORES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const json = (await response.json()) as ApiResponse<SubmitScoreData>;

  if (!response.ok || !json.success) {
    const errorMessage = json.error?.error ?? "Falha ao salvar score.";
    const retryAfter = json.error?.retryAfterMs;

    if (retryAfter) {
      throw new Error(`${errorMessage} Tente novamente em ${Math.ceil(retryAfter / 1000)}s.`);
    }

    throw new Error(errorMessage);
  }

  return json.data!;
}
