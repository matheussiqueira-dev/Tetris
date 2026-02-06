/**
 * Scores API Routes
 * Handles score listing, submission, and administrative operations.
 */

import { createResponse } from "@/lib/server/api/response-builder";
import { ApiError } from "@/lib/server/errors/api-error";
import { scoreService } from "@/lib/server/scores/store";

/**
 * GET /api/scores
 * Lists scores with optional filtering by mode and limit.
 */
export async function GET(request: Request) {
  const res = createResponse(request);

  try {
    const url = new URL(request.url);
    const data = scoreService.list({
      mode: url.searchParams.get("mode"),
      limit: url.searchParams.get("limit")
    });

    return res.success(data);
  } catch (error) {
    return res.error(error);
  }
}

/**
 * POST /api/scores
 * Submits a new score entry.
 */
export async function POST(request: Request) {
  const res = createResponse(request);

  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw ApiError.badRequest("JSON invalido.");
    }

    const result = scoreService.submit({
      ip: res.ip,
      requestId: res.requestId,
      payload
    });

    return res.success(result, 201);
  } catch (error) {
    return res.error(error);
  }
}

/**
 * DELETE /api/scores
 * Clears all scores. Requires admin token.
 */
export async function DELETE(request: Request) {
  const res = createResponse(request);

  try {
    const configuredToken = process.env.SCOREBOARD_ADMIN_TOKEN;
    const providedToken = request.headers.get("x-admin-token");

    if (!configuredToken || configuredToken !== providedToken) {
      throw ApiError.unauthorized();
    }

    scoreService.clear(res.requestId);
    return res.success({ cleared: true });
  } catch (error) {
    return res.error(error);
  }
}

/**
 * OPTIONS /api/scores
 * Handles CORS preflight requests.
 */
export async function OPTIONS(request: Request) {
  return createResponse(request).options();
}
