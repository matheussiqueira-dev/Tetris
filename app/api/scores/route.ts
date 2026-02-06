import { NextResponse } from "next/server";
import { scoreService } from "@/lib/server/scores/store";

function noStoreHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "Cache-Control": "no-store",
    ...extra
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = scoreService.list({
    mode: url.searchParams.get("mode"),
    limit: url.searchParams.get("limit")
  });

  return NextResponse.json(data, {
    headers: noStoreHeaders()
  });
}

export async function POST(request: Request) {
  const result = await scoreService.submit(request);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        details: result.details,
        retryAfterMs: result.retryAfterMs
      },
      {
        status: result.status,
        headers: noStoreHeaders(
          result.retryAfterMs
            ? {
                "Retry-After": String(Math.ceil(result.retryAfterMs / 1000))
              }
            : undefined
        )
      }
    );
  }

  return NextResponse.json(
    {
      item: result.item,
      placement: result.placement
    },
    {
      status: 201,
      headers: noStoreHeaders()
    }
  );
}

export async function DELETE(request: Request) {
  const configuredToken = process.env.SCOREBOARD_ADMIN_TOKEN;
  const providedToken = request.headers.get("x-admin-token");

  if (!configuredToken || configuredToken !== providedToken) {
    return NextResponse.json(
      {
        error: "Nao autorizado."
      },
      {
        status: 401,
        headers: noStoreHeaders()
      }
    );
  }

  scoreService.clear();
  return NextResponse.json(
    {
      ok: true
    },
    {
      headers: noStoreHeaders()
    }
  );
}
