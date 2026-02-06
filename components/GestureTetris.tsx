"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { fetchScores, submitScore, type ScoreItem } from "@/lib/client/scoreboard-api";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { renderTetris } from "@/lib/tetris/render";
import { TetrisSession, type SessionEndReason } from "@/lib/tetris/session";
import { GAME_MODE_LIST, type GameModeId } from "@/lib/shared/game-mode";
import {
  HandGestureDetector,
  type DetectionDebug,
  type GestureKind,
  type GestureThresholds
} from "@/lib/vision/gesture-detector";
import { loadOpenCv } from "@/lib/vision/opencv-loader";

type RuntimeStatus = "loading" | "ready" | "error";

interface GestureUiState {
  label: string;
  confidence: number;
  expiresAt: number;
}

interface HudState {
  score: number;
  lines: number;
  level: number;
  fps: number;
  objective: string;
  progress: number;
  remainingMs: number | null;
  paused: boolean;
  running: boolean;
}

interface FinalSnapshot {
  mode: GameModeId;
  score: number;
  lines: number;
  level: number;
  durationMs: number;
  endReason: SessionEndReason;
}

interface GestureTimelineItem {
  id: string;
  label: string;
  confidence: number;
  timestamp: number;
}

const PROCESS_WIDTH = 320;
const PROCESS_HEIGHT = 240;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyGesture(session: TetrisSession, kind: GestureKind): void {
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

function fitCanvasToDisplay(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function sensitivityToThresholds(value: number): Partial<GestureThresholds> {
  const normalized = clamp(value / 100, 0, 1);
  return {
    lateralVelocity: 620 - normalized * 340,
    verticalDropVelocity: 980 - normalized * 420,
    verticalNoiseCap: 660 - normalized * 190,
    rotationAccumulatedDeg: 24 - normalized * 12,
    rotationAngularVelocity: 122 - normalized * 60
  };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function endReasonLabel(reason: SessionEndReason): string {
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

function drawCameraPreview(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  debug: DetectionDebug | null,
  gesture: GestureUiState | null,
  now: number,
  cameraReady: boolean
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#091524");
  bg.addColorStop(1, "#162943");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (cameraReady && video && video.readyState >= 2) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(226, 237, 249, 0.85)";
    ctx.font = "500 14px 'Space Grotesk', sans-serif";
    ctx.fillText("Aguardando camera...", 14, height / 2);
  }

  if (debug) {
    ctx.save();
    ctx.strokeStyle = "rgba(245, 178, 103, 0.88)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(debug.controlZoneX, 0);
    ctx.lineTo(debug.controlZoneX, height);
    ctx.stroke();

    if (debug.detected && debug.centroid) {
      const { x, y } = debug.centroid;
      ctx.fillStyle = "rgba(80, 206, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      if (debug.fingertip) {
        ctx.strokeStyle = "rgba(130, 255, 191, 0.92)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(debug.fingertip.x, debug.fingertip.y);
        ctx.stroke();
      }

      const angleRad = (debug.angleDeg * Math.PI) / 180;
      ctx.strokeStyle = "rgba(255, 126, 126, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angleRad) * 32, y + Math.sin(angleRad) * 32);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillStyle = "rgba(7, 16, 29, 0.72)";
  ctx.fillRect(0, 0, width, 38);
  ctx.fillStyle = "rgba(226, 239, 252, 0.92)";
  ctx.font = "500 12px 'Space Grotesk', sans-serif";
  if (debug) {
    ctx.fillText(`Confianca ${(debug.confidence * 100).toFixed(0)}%`, 10, 14);
    ctx.fillText(`Area ${Math.round(debug.contourArea)}`, 10, 30);
    ctx.fillText(`VY ${Math.round(debug.velocity.y)} px/s`, width - 138, 14);
    ctx.fillText(`Ang ${debug.angleDeg.toFixed(1)} deg`, width - 138, 30);
  } else {
    ctx.fillText("Sem deteccao ativa", 10, 22);
  }

  if (gesture && now <= gesture.expiresAt) {
    const alpha = clamp((gesture.expiresAt - now) / 700, 0.18, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(252, 174, 93, 0.9)";
    ctx.fillRect(10, height - 44, width - 20, 30);
    ctx.fillStyle = "#132137";
    ctx.font = "700 14px 'Space Grotesk', sans-serif";
    ctx.fillText(`${gesture.label} (${Math.round(gesture.confidence * 100)}%)`, 16, height - 24);
    ctx.globalAlpha = 1;
  }
}

export default function GestureTetris() {
  const sessionRef = useRef(new TetrisSession("classic"));
  const detectorRef = useRef<HandGestureDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const debugRef = useRef<DetectionDebug | null>(null);
  const gestureRef = useRef<GestureUiState | null>(null);
  const scorePromptShownRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const cvReadyRef = useRef(false);
  const sensitivityRef = useRef(52);

  const [mode, setMode] = usePersistentState<GameModeId>("gesture_tetris_mode", "classic");
  const [sensitivity, setSensitivity] = usePersistentState<number>("gesture_tetris_sensitivity", 52);
  const [playerName, setPlayerName] = usePersistentState<string>("gesture_tetris_player_name", "Player");

  const [cameraStatus, setCameraStatus] = useState<RuntimeStatus>("loading");
  const [cvStatus, setCvStatus] = useState<RuntimeStatus>("loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  const [gestureLabel, setGestureLabel] = useState("Aguardando gesto");
  const [hud, setHud] = useState<HudState>({
    score: 0,
    lines: 0,
    level: 1,
    fps: 0,
    objective: "Sobreviva o maximo possivel.",
    progress: 0,
    remainingMs: null,
    paused: false,
    running: true
  });

  const [leaderboard, setLeaderboard] = useState<ScoreItem[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [gestureTimeline, setGestureTimeline] = useState<GestureTimelineItem[]>([]);

  const [finalSnapshot, setFinalSnapshot] = useState<FinalSnapshot | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const selectedMode = useMemo(() => GAME_MODE_LIST.find((item) => item.id === mode), [mode]);

  useEffect(() => {
    if (!GAME_MODE_LIST.some((item) => item.id === mode)) {
      setMode("classic");
    }
  }, [mode, setMode]);

  const loadLeaderboard = useCallback(async (selectedModeId: GameModeId) => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const items = await fetchScores(selectedModeId, 8);
      setLeaderboard(items);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "Falha ao carregar placar.");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const resetSession = useCallback(
    (nextMode?: GameModeId) => {
      const targetMode = nextMode ?? mode;
      sessionRef.current.reset(targetMode);
      scorePromptShownRef.current = false;
      debugRef.current = null;
      gestureRef.current = null;
      setFinalSnapshot(null);
      setSubmitMessage(null);
      setGestureLabel("Aguardando gesto");
      setGestureTimeline([]);
      setHud((previous) => ({
        ...previous,
        score: 0,
        lines: 0,
        level: 1,
        objective:
          targetMode === "classic"
            ? "Sobreviva o maximo possivel."
            : targetMode === "sprint40"
              ? "Linhas: 0/40"
              : "Tempo restante: 120s",
        progress: 0,
        remainingMs: targetMode === "blitz120" ? 120_000 : null,
        paused: false,
        running: true
      }));
    },
    [mode]
  );

  useEffect(() => {
    const processCanvas = document.createElement("canvas");
    processCanvas.width = PROCESS_WIDTH;
    processCanvas.height = PROCESS_HEIGHT;
    processingCanvasRef.current = processCanvas;
  }, []);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    const setup = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 960 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          throw new Error("Elemento de video nao encontrado.");
        }
        video.srcObject = stream;
        await video.play();
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraReadyRef.current = true;
        setCameraStatus("ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nao foi possivel acessar camera.";
        cameraReadyRef.current = false;
        setCameraStatus("error");
        setCameraError(message);
      }
    };

    setup();

    return () => {
      active = false;
      cameraReadyRef.current = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    const setup = async () => {
      try {
        const cvRuntime = await loadOpenCv();
        if (!active) {
          return;
        }
        detectorRef.current = new HandGestureDetector(cvRuntime, {
          width: PROCESS_WIDTH,
          height: PROCESS_HEIGHT,
          thresholds: sensitivityToThresholds(sensitivityRef.current)
        });
        cvReadyRef.current = true;
        setCvStatus("ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao iniciar OpenCV.js.";
        cvReadyRef.current = false;
        setCvStatus("error");
        setCvError(message);
      }
    };

    setup();

    return () => {
      active = false;
      cvReadyRef.current = false;
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, []);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
    detectorRef.current?.setThresholds(sensitivityToThresholds(sensitivity));
  }, [sensitivity]);

  useEffect(() => {
    resetSession(mode);
    loadLeaderboard(mode).catch(() => {});
  }, [mode, loadLeaderboard, resetSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const session = sessionRef.current;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          session.moveHorizontal(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          session.moveHorizontal(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          session.rotate(true);
          break;
        case "ArrowDown":
          event.preventDefault();
          session.softDrop();
          break;
        case " ":
          event.preventDefault();
          session.hardDrop();
          break;
        case "c":
        case "C":
          event.preventDefault();
          session.hold();
          break;
        case "p":
        case "P":
          event.preventDefault();
          session.togglePause();
          break;
        case "r":
        case "R":
          event.preventDefault();
          resetSession();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetSession]);

  useEffect(() => {
    let last = performance.now();
    let hudAccumulator = 0;
    let gestureAccumulator = 0;
    let fpsAccumulator = 0;
    let frameCount = 0;
    let lastFps = 0;

    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      frameCount += 1;
      fpsAccumulator += dt;

      const session = sessionRef.current;
      session.update(dt);
      const snapshot = session.getSnapshot();

      const gameCanvas = gameCanvasRef.current;
      if (gameCanvas) {
        fitCanvasToDisplay(gameCanvas);
        const gameCtx = gameCanvas.getContext("2d");
        if (gameCtx) {
          renderTetris(gameCtx, session.getEngine(), { now });
          if (snapshot.paused) {
            gameCtx.fillStyle = "rgba(5, 10, 18, 0.7)";
            gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
            gameCtx.fillStyle = "#f4f8ff";
            gameCtx.font = "700 42px 'Bebas Neue', sans-serif";
            gameCtx.fillText("PAUSADO", gameCanvas.width * 0.39, gameCanvas.height * 0.5);
          }
        }
      }

      const cameraCanvas = cameraCanvasRef.current;
      if (cameraCanvas) {
        const cameraCtx = cameraCanvas.getContext("2d");
        if (cameraCtx) {
          drawCameraPreview(
            cameraCtx,
            videoRef.current,
            debugRef.current,
            gestureRef.current,
            now,
            cameraReadyRef.current
          );
        }
      }

      gestureAccumulator += dt;
      if (
        gestureAccumulator >= 32 &&
        detectorRef.current &&
        cameraReadyRef.current &&
        cvReadyRef.current &&
        snapshot.running &&
        !snapshot.paused
      ) {
        gestureAccumulator = 0;
        const processCanvas = processingCanvasRef.current;
        const video = videoRef.current;
        if (processCanvas && video && video.readyState >= 2) {
          const processCtx = processCanvas.getContext("2d", { willReadFrequently: true });
          if (processCtx) {
            processCtx.save();
            processCtx.translate(PROCESS_WIDTH, 0);
            processCtx.scale(-1, 1);
            processCtx.drawImage(video, 0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
            processCtx.restore();
            const imageData = processCtx.getImageData(0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
            const result = detectorRef.current.process(imageData, now);
            debugRef.current = result.debug;

            if (result.gesture) {
              const recognized = result.gesture;
              applyGesture(session, recognized.kind);
              gestureRef.current = {
                label: recognized.label,
                confidence: recognized.confidence,
                expiresAt: now + 700
              };
              setGestureLabel(recognized.label);
              setGestureTimeline((previous) =>
                [
                  {
                    id: `${now}-${Math.random().toString(16).slice(2, 8)}`,
                    label: recognized.label,
                    confidence: recognized.confidence,
                    timestamp: now
                  },
                  ...previous
                ].slice(0, 6)
              );
            }
          }
        }
      }

      hudAccumulator += dt;
      if (hudAccumulator >= 120) {
        hudAccumulator = 0;
        const fps = fpsAccumulator >= 1000 ? Math.round((frameCount * 1000) / fpsAccumulator) : lastFps;
        if (fpsAccumulator >= 1000) {
          fpsAccumulator = 0;
          frameCount = 0;
          lastFps = fps;
        }

        const freshSnapshot = session.getSnapshot();
        setHud({
          score: freshSnapshot.game.score,
          lines: freshSnapshot.game.lines,
          level: freshSnapshot.game.level,
          fps,
          objective: freshSnapshot.objectiveLabel,
          progress: freshSnapshot.progress,
          remainingMs: freshSnapshot.remainingMs,
          paused: freshSnapshot.paused,
          running: freshSnapshot.running
        });

        if (gestureRef.current && now > gestureRef.current.expiresAt) {
          setGestureLabel("Aguardando gesto");
        }

        if (freshSnapshot.endReason && !scorePromptShownRef.current) {
          scorePromptShownRef.current = true;
          const finalState: FinalSnapshot = {
            mode: freshSnapshot.mode,
            score: freshSnapshot.game.score,
            lines: freshSnapshot.game.lines,
            level: freshSnapshot.game.level,
            durationMs: Math.floor(freshSnapshot.elapsedMs),
            endReason: freshSnapshot.endReason
          };
          setFinalSnapshot(finalState);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const onSubmitScore = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!finalSnapshot) {
        return;
      }

      setSubmitBusy(true);
      setSubmitMessage(null);
      try {
        const response = await submitScore({
          name: playerName,
          score: finalSnapshot.score,
          lines: finalSnapshot.lines,
          level: finalSnapshot.level,
          mode: finalSnapshot.mode,
          durationMs: finalSnapshot.durationMs
        });
        setSubmitMessage(`Score salvo no ranking. Posicao #${response.placement}.`);
        await loadLeaderboard(finalSnapshot.mode);
      } catch (error) {
        setSubmitMessage(error instanceof Error ? error.message : "Falha ao enviar score.");
      } finally {
        setSubmitBusy(false);
      }
    },
    [finalSnapshot, loadLeaderboard, playerName]
  );

  return (
    <section className="product-shell" aria-label="Aplicacao principal do Tetris por gestos">
      <header className="top-hero">
        <div className="hero-copy">
          <p className="hero-kicker">Vision + Gameplay em tempo real</p>
          <h1>Tetris Gesture Arena</h1>
          <p>
            Controle as pecas sem teclado: deslocamento lateral da mao, rotacao do pulso e gesto de
            queda rapida para hard drop.
          </p>
        </div>
        <div className="hero-actions">
          <label htmlFor="mode-select">Modo</label>
          <select
            id="mode-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameModeId)}
          >
            {GAME_MODE_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <p>{selectedMode?.description}</p>
        </div>
      </header>

      <div className="layout-grid">
        <section className="board-column">
          <div className="board-card">
            <canvas
              ref={gameCanvasRef}
              className="game-canvas"
              aria-label="Tabuleiro principal do Tetris"
              role="img"
            />
            <div className="board-overlay">
              <span>Gesto reconhecido</span>
              <strong>{gestureLabel}</strong>
            </div>
          </div>

          <div className="progress-row" aria-live="polite">
            <div className="progress-label">
              <span>Objetivo</span>
              <strong>{hud.objective}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div style={{ width: `${Math.round(hud.progress * 100)}%` }} />
            </div>
            {hud.remainingMs !== null && <span className="timer-pill">{formatDuration(hud.remainingMs)}</span>}
          </div>

          <div className="metrics-grid">
            <article>
              <span>Score</span>
              <strong>{hud.score}</strong>
            </article>
            <article>
              <span>Linhas</span>
              <strong>{hud.lines}</strong>
            </article>
            <article>
              <span>Nivel</span>
              <strong>{hud.level}</strong>
            </article>
            <article>
              <span>FPS</span>
              <strong>{hud.fps}</strong>
            </article>
          </div>
        </section>

        <aside className="panel-column">
          <section className="panel-card camera-card">
            <div className="panel-title-row">
              <h2>Vision Feed</h2>
              <div className="badges">
                <span data-state={cameraStatus}>Camera {cameraStatus}</span>
                <span data-state={cvStatus}>OpenCV {cvStatus}</span>
                <span data-state={hud.paused ? "warn" : hud.running ? "ready" : "warn"}>
                  {hud.paused ? "Pausado" : hud.running ? "Ativo" : "Finalizado"}
                </span>
              </div>
            </div>
            <canvas
              ref={cameraCanvasRef}
              className="camera-canvas"
              width={PROCESS_WIDTH}
              height={PROCESS_HEIGHT}
              aria-label="Preview da camera com landmarks"
            />
            <video ref={videoRef} className="hidden-video" playsInline muted />
            {(cameraError || cvError) && <p className="error-line">{cameraError ?? cvError}</p>}
          </section>

          <section className="panel-card controls-card">
            <h3>Controles e Ajustes</h3>
            <div className="controls-grid">
              <button type="button" onClick={() => sessionRef.current.togglePause()}>
                Pausar / Continuar (P)
              </button>
              <button type="button" onClick={() => sessionRef.current.hold()}>
                Hold (C)
              </button>
              <button type="button" onClick={() => resetSession()}>
                Reiniciar (R)
              </button>
              <button type="button" onClick={() => loadLeaderboard(mode)}>
                Atualizar ranking
              </button>
            </div>
            <label htmlFor="sensitivity-range">Sensibilidade dos gestos: {sensitivity}%</label>
            <input
              id="sensitivity-range"
              type="range"
              min={20}
              max={95}
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
            <ul>
              <li>Mova a mao esquerda para deslocar a peca lateralmente.</li>
              <li>Gire o pulso para aplicar rotacao da peca ativa.</li>
              <li>Flick para baixo executa hard drop imediato.</li>
            </ul>
          </section>

          <section className="panel-card leaderboard-card">
            <h3>Leaderboard ({selectedMode?.label})</h3>
            {leaderboardLoading && <p>Carregando ranking...</p>}
            {!leaderboardLoading && leaderboardError && <p className="error-line">{leaderboardError}</p>}
            {!leaderboardLoading && !leaderboardError && (
              <ol>
                {leaderboard.length === 0 && <li>Nenhum score enviado ainda.</li>}
                {leaderboard.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.name}</span>
                    <strong>{entry.score}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel-card timeline-card">
            <h3>Timeline de Gestos</h3>
            <ul>
              {gestureTimeline.length === 0 && <li>Nenhum gesto capturado recentemente.</li>}
              {gestureTimeline.map((item) => (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <strong>{Math.round(item.confidence * 100)}%</strong>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {finalSnapshot && (
        <section className="result-sheet" aria-live="polite">
          <div className="result-heading">
            <h3>Partida encerrada</h3>
            <p>{endReasonLabel(finalSnapshot.endReason)}</p>
          </div>
          <div className="result-stats">
            <span>Score {finalSnapshot.score}</span>
            <span>Linhas {finalSnapshot.lines}</span>
            <span>Nivel {finalSnapshot.level}</span>
            <span>Tempo {formatDuration(finalSnapshot.durationMs)}</span>
          </div>
          <form onSubmit={onSubmitScore} className="submit-form">
            <label htmlFor="player-name">Nome no ranking</label>
            <input
              id="player-name"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              maxLength={18}
              required
            />
            <button type="submit" disabled={submitBusy}>
              {submitBusy ? "Enviando..." : "Enviar score"}
            </button>
          </form>
          {submitMessage && <p className="submit-message">{submitMessage}</p>}
        </section>
      )}
    </section>
  );
}
