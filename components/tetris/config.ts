import type { GameModeId } from "@/lib/shared/game-mode";

export type RuntimeStatus = "loading" | "ready" | "error";

export type InputModeId = "hybrid" | "gesture_only" | "keyboard_only";

export interface InputModeOption {
  id: InputModeId;
  label: string;
  description: string;
}

export const INPUT_MODE_OPTIONS: readonly InputModeOption[] = [
  {
    id: "hybrid",
    label: "Hibrido",
    description: "Gestos e teclado ativos ao mesmo tempo."
  },
  {
    id: "gesture_only",
    label: "Somente gesto",
    description: "Bloqueia setas e acoes de peca via teclado."
  },
  {
    id: "keyboard_only",
    label: "Somente teclado",
    description: "Desliga reconhecimento de gestos para poupar CPU."
  }
];

export type VisionPresetId = "eco" | "balanced" | "precision";

export interface VisionPreset {
  id: VisionPresetId;
  label: string;
  description: string;
  width: number;
  height: number;
  sampleIntervalMs: number;
}

export const VISION_PRESETS: readonly VisionPreset[] = [
  {
    id: "eco",
    label: "Eco 240p",
    description: "Menor uso de CPU para notebooks e baterias.",
    width: 240,
    height: 180,
    sampleIntervalMs: 45
  },
  {
    id: "balanced",
    label: "Balanceado 320p",
    description: "Melhor equilibrio entre estabilidade e latencia.",
    width: 320,
    height: 240,
    sampleIntervalMs: 32
  },
  {
    id: "precision",
    label: "Precisao 400p",
    description: "Mais fidelidade para gestos finos em maquinas fortes.",
    width: 400,
    height: 300,
    sampleIntervalMs: 24
  }
];

export const LEADERBOARD_LIMIT = 10;
export const GESTURE_TIMELINE_LIMIT = 8;
export const DEFAULT_SENSITIVITY = 52;

export const DEFAULT_OBJECTIVE_BY_MODE: Record<GameModeId, string> = {
  classic: "Sobreviva o maximo possivel.",
  sprint40: "Linhas: 0/40",
  blitz120: "Tempo restante: 120s"
};
