import { NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { getClientIp } from "@/lib/server/security/ip";
import { scoreStore, scoreSubmissionRateLimiter } from "@/lib/server/scores/store";
import { scoreSubmissionSchema } from "@/lib/server/validation/score-schema";
import { isGameMode } from "@/lib/shared/game-mode";

function toSafeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function parseLimit(searchParams: URLSearchParams): number {
  const value = Number(searchParams.get("limit") ?? "10");
  if (!Number.isFinite(value)) {
    return 10;
  }
  return Math.max(1, Math.min(50, Math.floor(value)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams);
  const modeParam = url.searchParams.get("mode");
  const mode = modeParam && isGameMode(modeParam) ? modeParam : undefined;
  const items = scoreStore.list({ limit, mode });

  return NextResponse.json(
    {
      items
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limitResult = scoreSubmissionRateLimiter.take(ip);
  if (!limitResult.allowed) {
    return NextResponse.json(
      {
        error: "Muitas tentativas. Aguarde antes de enviar novamente.",
        retryAfterMs: limitResult.retryAfterMs
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(limitResult.retryAfterMs / 1000))
        }
      }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = scoreSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido.",
        details: parsed.error.flatten()
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const cleanPayload = {
    ...parsed.data,
    name: toSafeName(parsed.data.name)
  };

  const entry = scoreStore.add(cleanPayload);
  const ranking = scoreStore.list({ mode: cleanPayload.mode, limit: 1000 });
  const placement = ranking.findIndex((item) => item.id === entry.id) + 1;

  logger.info("Score submitted", {
    ip,
    mode: cleanPayload.mode,
    score: cleanPayload.score,
    placement
  });

  return NextResponse.json(
    {
      item: entry,
      placement
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function DELETE(request: Request) {
  const configuredToken = process.env.SCOREBOARD_ADMIN_TOKEN;
  const providedToken = request.headers.get("x-admin-token");

  if (!configuredToken || providedToken !== configuredToken) {
    return NextResponse.json(
      { error: "Nao autorizado." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  scoreStore.clear();
  logger.warn("Scoreboard cleared by admin token");
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
