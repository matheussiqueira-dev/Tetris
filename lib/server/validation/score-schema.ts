import { z } from "zod";
import { GAME_MODES } from "@/lib/shared/game-mode";

export const scoreSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres.")
    .max(18, "Nome deve ter no maximo 18 caracteres.")
    .regex(/^[a-zA-Z0-9 _.-]+$/, "Nome possui caracteres invalidos."),
  score: z.number().int().min(0).max(9_999_999),
  lines: z.number().int().min(0).max(9999),
  level: z.number().int().min(1).max(999),
  mode: z.enum([GAME_MODES.classic.id, GAME_MODES.sprint40.id, GAME_MODES.blitz120.id]),
  durationMs: z.number().int().min(0).max(3_600_000)
});

export type ScoreSubmissionInput = z.infer<typeof scoreSubmissionSchema>;
