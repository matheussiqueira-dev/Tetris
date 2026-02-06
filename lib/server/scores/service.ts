/**
 * Score Service Module
 * Handles business logic for score submission and retrieval with validation and rate limiting.
 */

import { createLogger } from "@/lib/server/logger";
import { ApiError } from "@/lib/server/errors/api-error";
import type { ScoreRepository } from "@/lib/server/scores/repository";
import type { ScoreEntry } from "@/lib/server/scores/types";
import type { InMemoryRateLimiter } from "@/lib/server/security/rate-limiter";
import { scoreSubmissionSchema } from "@/lib/server/validation/score-schema";
import { isGameMode, type GameModeId } from "@/lib/shared/game-mode";

const logger = createLogger({ service: "score-service" });

export interface ListScoresParams {
  mode?: string | null;
  limit?: string | null;
}

export interface ListScoresResult {
  items: ScoreEntry[];
  total: number;
  mode?: GameModeId;
}

export interface SubmitScoreResult {
  item: ScoreEntry;
  placement: number;
  isHighScore: boolean;
}

export interface SubmitScoreInput {
  ip: string;
  requestId: string;
  payload: unknown;
}

function parseLimit(value: string | null | undefined): number {
  const numeric = Number(value ?? "10");
  if (!Number.isFinite(numeric)) {
    return 10;
  }
  return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function normalizeMode(mode: string | null | undefined): GameModeId | undefined {
  if (!mode) {
    return undefined;
  }
  if (!isGameMode(mode)) {
    return undefined;
  }
  return mode;
}

function validateModeConsistency(payload: {
  mode: GameModeId;
  lines: number;
  durationMs: number;
}): void {
  if (payload.mode === "sprint40" && payload.lines < 40) {
    throw new ApiError(
      "No modo Sprint 40, o score precisa ter ao menos 40 linhas.",
      400,
      "VALIDATION_ERROR"
    );
  }

  if (payload.mode === "blitz120" && payload.durationMs > 125_000) {
    throw new ApiError(
      "No modo Blitz 120, a duracao nao pode exceder 125 segundos.",
      400,
      "VALIDATION_ERROR"
    );
  }
}

export class ScoreService {
  constructor(
    private readonly repository: ScoreRepository,
    private readonly limiter: InMemoryRateLimiter
  ) {}

  /**
   * Lists scores with optional filtering by mode and pagination.
   */
  list(params: ListScoresParams): ListScoresResult {
    const limit = parseLimit(params.limit);
    const mode = normalizeMode(params.mode);
    const items = this.repository.list({ limit, mode });
    const total = this.repository.count(mode);

    return { items, total, mode };
  }

  /**
   * Submits a new score with validation and rate limiting.
   * @throws {ApiError} When validation fails or rate limit is exceeded.
   */
  submit(input: SubmitScoreInput): SubmitScoreResult {
    const { ip, requestId, payload } = input;

    // Check rate limit
    const rateLimit = this.limiter.take(ip);
    if (!rateLimit.allowed) {
      throw ApiError.rateLimitExceeded(rateLimit.retryAfterMs);
    }

    // Validate payload
    const parsed = scoreSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      throw ApiError.validationError("Payload invalido.", parsed.error.flatten());
    }

    // Validate mode-specific rules
    validateModeConsistency(parsed.data);

    // Prepare and save
    const prepared = {
      ...parsed.data,
      name: normalizeName(parsed.data.name)
    };

    const item = this.repository.add(prepared);
    const ranking = this.repository.list({ mode: prepared.mode, limit: 1000 });
    const placement = ranking.findIndex((entry) => entry.id === item.id) + 1;
    const isHighScore = placement === 1;

    logger.info("Score submitted", {
      requestId,
      ip,
      mode: prepared.mode,
      score: prepared.score,
      placement,
      isHighScore
    });

    return { item, placement, isHighScore };
  }

  /**
   * Clears all scores. Requires admin authorization.
   */
  clear(requestId: string): void {
    this.repository.clear();
    logger.warn("Scoreboard cleared by admin", { requestId });
  }

  /**
   * Gets statistics about the scoreboard.
   */
  getStats(): {
    totalScores: number;
    scoresByMode: Record<GameModeId, number>;
    lastUpdated: string | null;
  } {
    return {
      totalScores: this.repository.count(),
      scoresByMode: {
        classic: this.repository.count("classic"),
        sprint40: this.repository.count("sprint40"),
        blitz120: this.repository.count("blitz120")
      },
      lastUpdated: this.repository.getLastUpdated()
    };
  }
}
