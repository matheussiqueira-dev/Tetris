import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECES,
  cloneMatrix,
  generateBag,
  rotateMatrix
} from "@/lib/tetris/pieces";
import type { ActivePiece, GameSnapshot, PieceType } from "@/lib/tetris/types";

const SCORE_TABLE = [0, 100, 300, 500, 800];
const MAX_DROP_SPEED = 90;
const BASE_DROP_SPEED = 850;
const DROP_SPEED_STEP = 70;

function createBoard(): number[][] {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

export class TetrisEngine {
  public board: number[][] = createBoard();

  public current: ActivePiece | null = null;

  public score = 0;

  public lines = 0;

  public level = 1;

  public gameOver = false;

  private bag: PieceType[] = [];

  private nextPieceType: PieceType = "I";

  private holdPieceType: PieceType | null = null;

  private canHold = true;

  private gravityAccumulator = 0;

  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.reset();
  }

  reset(): void {
    this.board = createBoard();
    this.current = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.gravityAccumulator = 0;
    this.bag = [];
    this.holdPieceType = null;
    this.canHold = true;
    this.nextPieceType = this.pullNextType();
    this.spawnPiece();
  }

  update(deltaMs: number): void {
    if (this.gameOver || !this.current) {
      return;
    }

    this.gravityAccumulator += deltaMs;
    const interval = this.getDropIntervalMs();
    while (this.gravityAccumulator >= interval) {
      this.gravityAccumulator -= interval;
      this.softDrop();
      if (this.gameOver) {
        return;
      }
    }
  }

  moveHorizontal(direction: -1 | 1): boolean {
    if (!this.current || this.gameOver) {
      return false;
    }

    const nextX = this.current.x + direction;
    if (this.collides(this.current.matrix, nextX, this.current.y)) {
      return false;
    }

    this.current.x = nextX;
    return true;
  }

  rotate(clockwise = true): boolean {
    if (!this.current || this.gameOver) {
      return false;
    }

    const rotated = rotateMatrix(this.current.matrix, clockwise);
    const kicks = [0, -1, 1, -2, 2];

    for (const offset of kicks) {
      const nextX = this.current.x + offset;
      if (!this.collides(rotated, nextX, this.current.y)) {
        this.current.matrix = rotated;
        this.current.x = nextX;
        return true;
      }
    }

    return false;
  }

  softDrop(): boolean {
    if (!this.current || this.gameOver) {
      return false;
    }

    const nextY = this.current.y + 1;
    if (this.collides(this.current.matrix, this.current.x, nextY)) {
      this.lockPiece();
      return false;
    }

    this.current.y = nextY;
    return true;
  }

  hardDrop(): number {
    if (!this.current || this.gameOver) {
      return 0;
    }

    let distance = 0;
    while (!this.collides(this.current.matrix, this.current.x, this.current.y + 1)) {
      this.current.y += 1;
      distance += 1;
    }

    this.score += distance * 2;
    this.lockPiece();
    return distance;
  }

  holdCurrentPiece(): boolean {
    if (!this.current || this.gameOver || !this.canHold) {
      return false;
    }

    const currentType = this.current.type;
    if (this.holdPieceType === null) {
      this.holdPieceType = currentType;
      this.spawnPiece();
    } else {
      const holdType = this.holdPieceType;
      this.holdPieceType = currentType;
      this.spawnPiece(holdType);
    }

    this.canHold = false;
    this.gravityAccumulator = 0;
    return !this.gameOver;
  }

  getDropIntervalMs(): number {
    return Math.max(MAX_DROP_SPEED, BASE_DROP_SPEED - (this.level - 1) * DROP_SPEED_STEP);
  }

  getGhostY(): number {
    if (!this.current) {
      return 0;
    }

    let ghostY = this.current.y;
    while (!this.collides(this.current.matrix, this.current.x, ghostY + 1)) {
      ghostY += 1;
    }
    return ghostY;
  }

  getNextPieceType(): PieceType {
    return this.nextPieceType;
  }

  getHoldPieceType(): PieceType | null {
    return this.holdPieceType;
  }

  canHoldCurrentPiece(): boolean {
    return this.canHold && !this.gameOver;
  }

  getSnapshot(): GameSnapshot {
    return {
      board: cloneBoard(this.board),
      current: this.current
        ? {
            type: this.current.type,
            matrix: cloneMatrix(this.current.matrix),
            x: this.current.x,
            y: this.current.y
          }
        : null,
      next: this.nextPieceType,
      hold: this.holdPieceType,
      canHold: this.canHoldCurrentPiece(),
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.gameOver,
      dropIntervalMs: this.getDropIntervalMs()
    };
  }

  private pullNextType(): PieceType {
    if (this.bag.length === 0) {
      this.bag = generateBag(this.random);
    }
    const piece = this.bag.shift();
    if (!piece) {
      return "I";
    }
    return piece;
  }

  private spawnPiece(forcedType?: PieceType): void {
    const pieceType = forcedType ?? this.nextPieceType;
    if (!forcedType) {
      this.nextPieceType = this.pullNextType();
    }

    const piece = this.createPiece(pieceType);

    if (this.collides(piece.matrix, piece.x, piece.y)) {
      this.gameOver = true;
      this.current = null;
      return;
    }

    this.current = piece;
  }

  private createPiece(type: PieceType): ActivePiece {
    const matrix = cloneMatrix(PIECES[type]);
    const x = Math.floor((BOARD_WIDTH - matrix[0].length) / 2);
    const y = -1;
    return { type, matrix, x, y };
  }

  private lockPiece(): void {
    if (!this.current) {
      return;
    }

    for (let y = 0; y < this.current.matrix.length; y += 1) {
      for (let x = 0; x < this.current.matrix[y].length; x += 1) {
        const value = this.current.matrix[y][x];
        if (value === 0) {
          continue;
        }

        const boardY = this.current.y + y;
        const boardX = this.current.x + x;
        if (boardY < 0) {
          this.gameOver = true;
          this.current = null;
          return;
        }

        this.board[boardY][boardX] = value;
      }
    }

    const cleared = this.clearLines();
    if (cleared > 0) {
      this.lines += cleared;
      this.score += SCORE_TABLE[cleared] * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
    }

    this.spawnPiece();
    this.canHold = true;
    this.gravityAccumulator = 0;
  }

  private clearLines(): number {
    let cleared = 0;

    for (let y = this.board.length - 1; y >= 0; y -= 1) {
      if (this.board[y].every((cell) => cell !== 0)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(BOARD_WIDTH).fill(0));
        cleared += 1;
        y += 1;
      }
    }

    return cleared;
  }

  private collides(matrix: number[][], targetX: number, targetY: number): boolean {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (matrix[y][x] === 0) {
          continue;
        }

        const boardX = targetX + x;
        const boardY = targetY + y;

        if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
          return true;
        }

        if (boardY >= 0 && this.board[boardY][boardX] !== 0) {
          return true;
        }
      }
    }

    return false;
  }
}
