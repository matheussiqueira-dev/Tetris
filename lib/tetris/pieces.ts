import type { PieceType } from "@/lib/tetris/types";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const PIECES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [2, 2],
    [2, 2]
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0]
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0]
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0]
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0]
  ]
};

const ORDER: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export const CELL_COLORS: string[] = [
  "#0f1726",
  "#3ad6ff",
  "#ffd166",
  "#f78c6c",
  "#7bdc7b",
  "#ff7e79",
  "#7f9cff",
  "#ffa94d"
];

export function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => [...row]);
}

export function rotateMatrix(matrix: number[][], clockwise = true): number[][] {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (clockwise) {
        rotated[x][size - 1 - y] = matrix[y][x];
      } else {
        rotated[size - 1 - x][y] = matrix[y][x];
      }
    }
  }

  return rotated;
}

export function generateBag(random: () => number): PieceType[] {
  const bag = [...ORDER];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}
