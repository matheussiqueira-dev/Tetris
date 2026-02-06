import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      openapi: "3.0.0",
      info: {
        title: "Gesture Tetris API",
        version: "1.0.0"
      },
      paths: {
        "/api/v1/health": {
          get: {
            summary: "Healthcheck"
          }
        },
        "/api/v1/scores": {
          get: {
            summary: "Lista scores",
            parameters: [
              { name: "mode", in: "query", schema: { type: "string" } },
              { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } }
            ]
          },
          post: {
            summary: "Envia score"
          }
        }
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
