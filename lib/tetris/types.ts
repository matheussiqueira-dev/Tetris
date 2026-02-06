export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface ActivePiece {
  type: PieceType;
  matrix: number[][];
  x: number;
  y: number;
}

export interface GameSnapshot {
  board: number[][];
  current: ActivePiece | null;
  next: PieceType;
  hold: PieceType | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  dropIntervalMs: number;
}
