/**
 * Server Module - Scores
 * Centralized exports for score management.
 */

export { InMemoryScoreRepository } from "./repository";
export type { ScoreRepository } from "./repository";

export { ScoreService } from "./service";
export type { ListScoresParams, ListScoresResult, SubmitScoreResult, SubmitScoreInput } from "./service";

export { compareScoreEntries } from "./sort";

export { scoreStore, scoreService, scoreSubmissionRateLimiter, resetScoreRuntimeForTests } from "./store";

export type { ScoreEntry, ScoreSubmission } from "./types";
