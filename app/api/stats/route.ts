/**
 * Stats API Route
 * Provides scoreboard statistics and metrics.
 */

import { createResponse } from "@/lib/server/api/response-builder";
import { scoreService } from "@/lib/server/scores/store";

/**
 * GET /api/stats
 * Returns scoreboard statistics.
 */
export async function GET(request: Request) {
  const res = createResponse(request);

  try {
    const stats = scoreService.getStats();
    return res.success(stats);
  } catch (error) {
    return res.error(error);
  }
}

export async function OPTIONS(request: Request) {
  return createResponse(request).options();
}
