import { BOARD_HEIGHT, BOARD_WIDTH, CELL_COLORS, PIECES } from "@/lib/tetris/pieces";
import type { TetrisEngine } from "@/lib/tetris/engine";
import type { PieceType } from "@/lib/tetris/types";

interface RenderOptions {
  now: number;
}

const GRID_COLOR = "rgba(163, 187, 210, 0.12)";
const GHOST_ALPHA = 0.22;

function drawCell(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  size: number,
  alpha = 1
): void {
  if (value === 0) {
    return;
  }

  const color = CELL_COLORS[value] ?? "#ffffff";
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(x + 1, y + 1, size - 2, Math.max(2, size * 0.25));
  ctx.strokeStyle = "rgba(10, 20, 30, 0.45)";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.restore();
}

function drawMiniPiece(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  x: number,
  y: number,
  cellSize: number
): void {
  const matrix = PIECES[type];
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      drawCell(ctx, matrix[row][col], x + col * cellSize, y + row * cellSize, cellSize);
    }
  }
}

export function renderTetris(
  ctx: CanvasRenderingContext2D,
  engine: TetrisEngine,
  options: RenderOptions
): void {
  const { canvas } = ctx;
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0a121d");
  bg.addColorStop(1, "#071421");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const boardPixelWidth = Math.floor(width * 0.62);
  const cellSize = Math.floor(Math.min(boardPixelWidth / BOARD_WIDTH, height / BOARD_HEIGHT));
  const boardW = BOARD_WIDTH * cellSize;
  const boardH = BOARD_HEIGHT * cellSize;
  const offsetX = Math.floor(width * 0.07);
  const offsetY = Math.floor((height - boardH) / 2);

  ctx.fillStyle = "rgba(12, 22, 36, 0.9)";
  ctx.fillRect(offsetX - 8, offsetY - 8, boardW + 16, boardH + 16);
  ctx.strokeStyle = "rgba(120, 158, 189, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX - 8, offsetY - 8, boardW + 16, boardH + 16);

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const px = offsetX + x * cellSize;
      const py = offsetY + y * cellSize;
      drawCell(ctx, engine.board[y][x], px, py, cellSize);
      ctx.strokeStyle = GRID_COLOR;
      ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
    }
  }

  if (engine.current) {
    const ghostY = engine.getGhostY();
    for (let y = 0; y < engine.current.matrix.length; y += 1) {
      for (let x = 0; x < engine.current.matrix[y].length; x += 1) {
        const value = engine.current.matrix[y][x];
        if (value === 0) {
          continue;
        }

        const gx = engine.current.x + x;
        const gy = ghostY + y;
        if (gy >= 0) {
          drawCell(
            ctx,
            value,
            offsetX + gx * cellSize,
            offsetY + gy * cellSize,
            cellSize,
            GHOST_ALPHA
          );
        }
      }
    }

    const pulse = 1 + Math.sin(options.now / 90) * 0.06;
    const pieceSize = cellSize * pulse;
    const pieceOffset = (pieceSize - cellSize) / 2;

    for (let y = 0; y < engine.current.matrix.length; y += 1) {
      for (let x = 0; x < engine.current.matrix[y].length; x += 1) {
        const value = engine.current.matrix[y][x];
        if (value === 0) {
          continue;
        }

        const boardX = engine.current.x + x;
        const boardY = engine.current.y + y;
        if (boardY < 0) {
          continue;
        }

        const drawX = offsetX + boardX * cellSize - pieceOffset;
        const drawY = offsetY + boardY * cellSize - pieceOffset;
        drawCell(ctx, value, drawX, drawY, pieceSize);
      }
    }
  }

  const panelX = offsetX + boardW + 26;
  const panelWidth = width - panelX - 20;
  ctx.fillStyle = "rgba(14, 28, 45, 0.85)";
  ctx.fillRect(panelX, offsetY, panelWidth, boardH);
  ctx.strokeStyle = "rgba(118, 161, 196, 0.36)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(panelX + 0.5, offsetY + 0.5, panelWidth - 1, boardH - 1);

  ctx.fillStyle = "#b9d8f2";
  ctx.font = "600 17px 'Sora', sans-serif";
  ctx.fillText("NEXT", panelX + 14, offsetY + 30);
  drawMiniPiece(ctx, engine.getNextPieceType(), panelX + 14, offsetY + 44, Math.max(14, cellSize * 0.55));

  ctx.fillStyle = "#b9d8f2";
  ctx.font = "600 17px 'Sora', sans-serif";
  ctx.fillText("HOLD", panelX + 14, offsetY + 114);
  const holdType = engine.getHoldPieceType();
  if (holdType) {
    drawMiniPiece(ctx, holdType, panelX + 14, offsetY + 126, Math.max(12, cellSize * 0.5));
  } else {
    ctx.fillStyle = "rgba(176, 205, 228, 0.8)";
    ctx.font = "500 13px 'Sora', sans-serif";
    ctx.fillText("vazio", panelX + 14, offsetY + 147);
  }

  const statBaseY = offsetY + Math.max(218, cellSize * 9.4);
  const lineGap = 34;
  ctx.fillStyle = "rgba(157, 190, 215, 0.9)";
  ctx.font = "500 15px 'Sora', sans-serif";
  ctx.fillText("SCORE", panelX + 14, statBaseY);
  ctx.fillStyle = "#f9be73";
  ctx.font = "700 26px 'Oswald', sans-serif";
  ctx.fillText(String(engine.score), panelX + 14, statBaseY + 27);

  ctx.fillStyle = "rgba(157, 190, 215, 0.9)";
  ctx.font = "500 15px 'Sora', sans-serif";
  ctx.fillText("LINHAS", panelX + 14, statBaseY + lineGap + 8);
  ctx.fillStyle = "#8fd6ff";
  ctx.font = "700 24px 'Oswald', sans-serif";
  ctx.fillText(String(engine.lines), panelX + 14, statBaseY + lineGap + 33);

  ctx.fillStyle = "rgba(157, 190, 215, 0.9)";
  ctx.font = "500 15px 'Sora', sans-serif";
  ctx.fillText("NIVEL", panelX + 14, statBaseY + lineGap * 2 + 14);
  ctx.fillStyle = "#ffd166";
  ctx.font = "700 24px 'Oswald', sans-serif";
  ctx.fillText(String(engine.level), panelX + 14, statBaseY + lineGap * 2 + 39);

  if (engine.gameOver) {
    ctx.fillStyle = "rgba(2, 8, 14, 0.72)";
    ctx.fillRect(offsetX, offsetY, boardW, boardH);
    ctx.fillStyle = "#ff8787";
    ctx.font = "700 34px 'Oswald', sans-serif";
    ctx.fillText("GAME OVER", offsetX + boardW * 0.18, offsetY + boardH * 0.48);
    ctx.fillStyle = "#d1e5f7";
    ctx.font = "500 15px 'Sora', sans-serif";
    ctx.fillText("Use o botao Reiniciar para jogar novamente.", offsetX + boardW * 0.12, offsetY + boardH * 0.56);
  }
}
