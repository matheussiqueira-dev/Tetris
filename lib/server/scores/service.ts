import { logger } from "@/lib/server/logger";
import type { ScoreRepository } from "@/lib/server/scores/repository";
import type { ScoreEntry } from "@/lib/server/scores/types";
import { getClientIp } from "@/lib/server/security/ip";
import type { InMemoryRateLimiter } from "@/lib/server/security/rate-limiter";
import { scoreSubmissionSchema } from "@/lib/server/validation/score-schema";
import { isGameMode, type GameModeId } from "@/lib/shared/game-mode";

export interface ListScoresParams {
  mode?: string | null;
  limit?: string | null;
}

export interface SubmitScoreResult {
  ok: true;
  item: ScoreEntry;
  placement: number;
}

export interface ServiceErrorResult {
  ok: false;
  status: number;
  error: string;
  details?: unknown;
  retryAfterMs?: number;
}

type ServiceResult<T> = T | ServiceErrorResult;

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
}): ServiceErrorResult | null {
  if (payload.mode === "sprint40" && payload.lines < 40) {
    return {
      ok: false,
      status: 400,
      error: "No modo Sprint 40, o score precisa ter ao menos 40 linhas."
    };
  }

  if (payload.mode === "blitz120" && payload.durationMs > 125_000) {
    return {
      ok: false,
      status: 400,
      error: "No modo Blitz 120, a duracao nao pode exceder 125 segundos."
    };
  }

  return null;
}

export class ScoreService {
  constructor(
    private readonly repository: ScoreRepository,
    private readonly limiter: InMemoryRateLimiter
  ) {}

  list(params: ListScoresParams): { items: ScoreEntry[] } {
    const limit = parseLimit(params.limit);
    const mode = normalizeMode(params.mode);
    return {
      items: this.repository.list({ limit, mode })
    };
  }

  async submit(request: Request): Promise<ServiceResult<SubmitScoreResult>> {
    const ip = getClientIp(request);
    const rateLimit = this.limiter.take(ip);
    if (!rateLimit.allowed) {
      return {
        ok: false,
        status: 429,
        error: "Muitas tentativas. Aguarde antes de enviar novamente.",
        retryAfterMs: rateLimit.retryAfterMs
      };
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return {
        ok: false,
        status: 400,
        error: "JSON invalido."
      };
    }

    const parsed = scoreSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "Payload invalido.",
        details: parsed.error.flatten()
      };
    }

    const validationError = validateModeConsistency(parsed.data);
    if (validationError) {
      return validationError;
    }

    const prepared = {
      ...parsed.data,
      name: normalizeName(parsed.data.name)
    };
    const item = this.repository.add(prepared);
    const ranking = this.repository.list({ mode: prepared.mode, limit: 1000 });
    const placement = ranking.findIndex((entry) => entry.id === item.id) + 1;

    logger.info("Score submitted", {
      ip,
      mode: prepared.mode,
      score: prepared.score,
      placement
    });

    return {
      ok: true,
      item,
      placement
    };
  }

  clear(): void {
    this.repository.clear();
    logger.warn("Scoreboard cleared by admin token");
  }
}
