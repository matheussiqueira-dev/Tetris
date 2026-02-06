import type {
  DetectionDebug,
  GestureKind,
  GestureThresholds
} from "@/lib/vision/gesture-detector";
import { TetrisSession, type SessionEndReason } from "@/lib/tetris/session";

export interface GestureOverlayState {
  label: string;
  confidence: number;
  expiresAt: number;
}

export interface DrawCameraPreviewParams {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement | null;
  debug: DetectionDebug | null;
  gesture: GestureOverlayState | null;
  now: number;
  cameraReady: boolean;
  showDebug: boolean;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyGesture(session: TetrisSession, kind: GestureKind): void {
  switch (kind) {
    case "move_left":
      session.moveHorizontal(-1);
      break;
    case "move_right":
      session.moveHorizontal(1);
      break;
    case "rotate_cw":
      session.rotate(true);
      break;
    case "rotate_ccw":
      session.rotate(false);
      break;
    case "hard_drop":
      session.hardDrop();
      break;
    default:
      break;
  }
}

export function fitCanvasToDisplay(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function sensitivityToThresholds(value: number): Partial<GestureThresholds> {
  const normalized = clamp(value / 100, 0, 1);
  return {
    lateralVelocity: 620 - normalized * 340,
    verticalDropVelocity: 980 - normalized * 420,
    verticalNoiseCap: 660 - normalized * 190,
    rotationAccumulatedDeg: 24 - normalized * 12,
    rotationAngularVelocity: 122 - normalized * 60
  };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function endReasonLabel(reason: SessionEndReason): string {
  if (reason === "sprint_complete") {
    return "Sprint concluido";
  }
  if (reason === "time_up") {
    return "Tempo encerrado";
  }
  if (reason === "top_out") {
    return "Topo atingido";
  }
  return "Partida finalizada";
}

export function formatTimelineTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function drawCameraPreview({
  ctx,
  video,
  debug,
  gesture,
  now,
  cameraReady,
  showDebug
}: DrawCameraPreviewParams): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#102334");
  bg.addColorStop(1, "#061522");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (cameraReady && video && video.readyState >= 2) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(230, 240, 251, 0.84)";
    ctx.font = "500 14px 'Sora', sans-serif";
    ctx.fillText("Aguardando camera...", 14, height / 2);
  }

  if (showDebug && debug) {
    ctx.save();
    ctx.strokeStyle = "rgba(249, 191, 114, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(debug.controlZoneX, 0);
    ctx.lineTo(debug.controlZoneX, height);
    ctx.stroke();

    if (debug.detected && debug.centroid) {
      const { x, y } = debug.centroid;
      ctx.fillStyle = "rgba(107, 220, 255, 0.96)";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      if (debug.fingertip) {
        ctx.strokeStyle = "rgba(121, 252, 178, 0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(debug.fingertip.x, debug.fingertip.y);
        ctx.stroke();
      }

      const angleRad = (debug.angleDeg * Math.PI) / 180;
      ctx.strokeStyle = "rgba(255, 136, 128, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angleRad) * 32, y + Math.sin(angleRad) * 32);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillStyle = "rgba(6, 16, 30, 0.72)";
  ctx.fillRect(0, 0, width, 40);
  ctx.fillStyle = "rgba(236, 244, 255, 0.92)";
  ctx.font = "500 12px 'Sora', sans-serif";

  if (showDebug && debug) {
    ctx.fillText(`Conf ${(debug.confidence * 100).toFixed(0)}%`, 10, 14);
    ctx.fillText(`Area ${Math.round(debug.contourArea)}`, 10, 30);
    ctx.fillText(`VY ${Math.round(debug.velocity.y)} px/s`, width - 148, 14);
    ctx.fillText(`Ang ${debug.angleDeg.toFixed(1)} deg`, width - 148, 30);
  } else {
    ctx.fillText("Overlay tecnico oculto", 10, 22);
  }

  if (gesture && now <= gesture.expiresAt) {
    const alpha = clamp((gesture.expiresAt - now) / 700, 0.16, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(249, 191, 114, 0.92)";
    ctx.fillRect(10, height - 45, width - 20, 30);
    ctx.fillStyle = "#142131";
    ctx.font = "700 14px 'Sora', sans-serif";
    ctx.fillText(`${gesture.label} (${Math.round(gesture.confidence * 100)}%)`, 16, height - 24);
    ctx.globalAlpha = 1;
  }
}
