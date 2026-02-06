export const GAME_MODES = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Partida tradicional sem limite de tempo."
  },
  sprint40: {
    id: "sprint40",
    label: "Sprint 40",
    description: "Finalize 40 linhas no menor tempo possivel.",
    targetLines: 40
  },
  blitz120: {
    id: "blitz120",
    label: "Blitz 120",
    description: "Pontue o maximo em 120 segundos.",
    durationMs: 120_000
  }
} as const;

export type GameModeId = keyof typeof GAME_MODES;

export const GAME_MODE_LIST = Object.values(GAME_MODES);

export function isGameMode(value: string): value is GameModeId {
  return value in GAME_MODES;
}
