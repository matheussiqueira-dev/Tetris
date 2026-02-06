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

const SCORES_ENDPOINT = "/api/v1/scores";

export async function fetchScores(mode: GameModeId, limit = 8): Promise<ScoreItem[]> {
  const response = await fetch(`${SCORES_ENDPOINT}?mode=${mode}&limit=${limit}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Falha ao carregar placar.");
  }

  const data = (await response.json()) as { items: ScoreItem[] };
  return data.items;
}

export async function submitScore(
  payload: SubmitScorePayload
): Promise<{ item: ScoreItem; placement: number }> {
  const response = await fetch(SCORES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorData?.error ?? "Falha ao salvar score.");
  }

  return (await response.json()) as { item: ScoreItem; placement: number };
}
