import { InMemoryScoreRepository } from "@/lib/server/scores/repository";
import { InMemoryRateLimiter } from "@/lib/server/security/rate-limiter";

export const scoreStore = new InMemoryScoreRepository();

export const scoreSubmissionRateLimiter = new InMemoryRateLimiter(8, 60_000);

export function resetScoreRuntimeForTests(): void {
  scoreStore.clear();
  scoreSubmissionRateLimiter.resetAll();
}
