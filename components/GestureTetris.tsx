"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_OBJECTIVE_BY_MODE,
  DEFAULT_SENSITIVITY,
  GESTURE_TIMELINE_LIMIT,
  INPUT_MODE_OPTIONS,
  LEADERBOARD_LIMIT,
  VISION_PRESETS,
  type InputModeId,
  type RuntimeStatus,
  type VisionPresetId
} from "@/components/tetris/config";
import {
  applyGesture,
  drawCameraPreview,
  endReasonLabel,
  fitCanvasToDisplay,
  formatDuration,
  formatTimelineTime,
  sensitivityToThresholds,
  type GestureOverlayState
} from "@/components/tetris/utils";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { fetchScores, submitScore, type ScoreItem } from "@/lib/client/scoreboard-api";
import { GAME_MODE_LIST, type GameModeId } from "@/lib/shared/game-mode";
import { renderTetris } from "@/lib/tetris/render";
import { TetrisSession, type SessionEndReason } from "@/lib/tetris/session";
import { HandGestureDetector, type DetectionDebug } from "@/lib/vision/gesture-detector";
import { loadOpenCv } from "@/lib/vision/opencv-loader";

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
  elapsedMs: number;
  dropIntervalMs: number;
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

interface GestureSessionStats {
  total: number;
  confidenceSum: number;
}

type BadgeState = RuntimeStatus | "warn";

const FPS_GOOD_THRESHOLD = 55;
const FPS_MEDIUM_THRESHOLD = 35;

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function statusLabel(status: RuntimeStatus): string {
  if (status === "ready") {
    return "pronto";
  }
  if (status === "loading") {
    return "carregando";
  }
  return "erro";
}

export default function GestureTetris() {
  const sessionRef = useRef(new TetrisSession("classic"));
  const detectorRef = useRef<HandGestureDetector | null>(null);
  const cvRuntimeRef = useRef<unknown | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const processCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const debugRef = useRef<DetectionDebug | null>(null);
  const gestureOverlayRef = useRef<GestureOverlayState | null>(null);
  const scorePromptShownRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const cvReadyRef = useRef(false);
  const sensitivityRef = useRef(DEFAULT_SENSITIVITY);
  const inputModeRef = useRef<InputModeId>("hybrid");
  const detectionIntervalRef = useRef(32);
  const showDebugOverlayRef = useRef(true);
  const leaderboardRequestRef = useRef(0);
  const gestureCounterRef = useRef(0);

  const [mode, setMode] = usePersistentState<GameModeId>("gesture_tetris_mode", "classic");
  const [sensitivity, setSensitivity] = usePersistentState<number>(
    "gesture_tetris_sensitivity",
    DEFAULT_SENSITIVITY
  );
  const [playerName, setPlayerName] = usePersistentState<string>("gesture_tetris_player_name", "Player");
  const [inputMode, setInputMode] = usePersistentState<InputModeId>("gesture_tetris_input_mode", "hybrid");
  const [visionPresetId, setVisionPresetId] = usePersistentState<VisionPresetId>(
    "gesture_tetris_vision_preset",
    "balanced"
  );
  const [autoPauseOnBlur, setAutoPauseOnBlur] = usePersistentState<boolean>(
    "gesture_tetris_auto_pause",
    true
  );
  const [showDebugOverlay, setShowDebugOverlay] = usePersistentState<boolean>(
    "gesture_tetris_show_debug",
    true
  );
  const [highContrastUi, setHighContrastUi] = usePersistentState<boolean>(
    "gesture_tetris_high_contrast",
    false
  );

  const [cameraStatus, setCameraStatus] = useState<RuntimeStatus>("loading");
  const [cvStatus, setCvStatus] = useState<RuntimeStatus>("loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [gestureLabel, setGestureLabel] = useState("Aguardando gesto");
  const [announcement, setAnnouncement] = useState("");
  const [hud, setHud] = useState<HudState>({
    score: 0,
    lines: 0,
    level: 1,
    fps: 0,
    objective: DEFAULT_OBJECTIVE_BY_MODE.classic,
    progress: 0,
    remainingMs: null,
    paused: false,
    running: true,
    elapsedMs: 0,
    dropIntervalMs: 850
  });
  const [leaderboard, setLeaderboard] = useState<ScoreItem[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [gestureTimeline, setGestureTimeline] = useState<GestureTimelineItem[]>([]);
  const [gestureStats, setGestureStats] = useState<GestureSessionStats>({
    total: 0,
    confidenceSum: 0
  });
  const [finalSnapshot, setFinalSnapshot] = useState<FinalSnapshot | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [cvRuntimeReady, setCvRuntimeReady] = useState(false);

  const selectedMode = useMemo(() => GAME_MODE_LIST.find((item) => item.id === mode), [mode]);
  const selectedVisionPreset = useMemo(
    () => VISION_PRESETS.find((item) => item.id === visionPresetId) ?? VISION_PRESETS[1],
    [visionPresetId]
  );
  const selectedInputMode = useMemo(
    () => INPUT_MODE_OPTIONS.find((item) => item.id === inputMode) ?? INPUT_MODE_OPTIONS[0],
    [inputMode]
  );

  const averageConfidence = useMemo(() => {
    if (gestureStats.total === 0) {
      return 0;
    }
    return Math.round((gestureStats.confidenceSum / gestureStats.total) * 100);
  }, [gestureStats.confidenceSum, gestureStats.total]);

  const actionsPerMinute = useMemo(() => {
    const elapsedMinutes = Math.max(hud.elapsedMs / 60000, 1 / 60);
    return Math.round(gestureStats.total / elapsedMinutes);
  }, [gestureStats.total, hud.elapsedMs]);

  const fpsHealth = useMemo(() => {
    if (hud.fps >= FPS_GOOD_THRESHOLD) {
      return "Estavel";
    }
    if (hud.fps >= FPS_MEDIUM_THRESHOLD) {
      return "Intermediario";
    }
    return "Baixo";
  }, [hud.fps]);

  const cameraBadgeState: BadgeState = inputMode === "keyboard_only" ? "warn" : cameraStatus;
  const cameraBadgeLabel =
    inputMode === "keyboard_only" ? "camera desligada" : `camera ${statusLabel(cameraStatus)}`;
  const sessionStateLabel = hud.paused ? "pausado" : hud.running ? "rodando" : "encerrado";

  useEffect(() => {
    if (!GAME_MODE_LIST.some((item) => item.id === mode)) {
      setMode("classic");
    }
  }, [mode, setMode]);

  useEffect(() => {
    if (!INPUT_MODE_OPTIONS.some((item) => item.id === inputMode)) {
      setInputMode("hybrid");
    }
  }, [inputMode, setInputMode]);

  useEffect(() => {
    if (!VISION_PRESETS.some((item) => item.id === visionPresetId)) {
      setVisionPresetId("balanced");
    }
  }, [setVisionPresetId, visionPresetId]);

  const rebuildVisionPipeline = useCallback((runtime: unknown, width: number, height: number) => {
    const processCanvas = document.createElement("canvas");
    processCanvas.width = width;
    processCanvas.height = height;
    processingCanvasRef.current = processCanvas;
    processCtxRef.current = processCanvas.getContext("2d", { willReadFrequently: true });

    detectorRef.current?.dispose();
    detectorRef.current = new HandGestureDetector(runtime as never, {
      width,
      height,
      thresholds: sensitivityToThresholds(sensitivityRef.current)
    });
  }, []);

  const loadLeaderboard = useCallback(async (selectedModeId: GameModeId) => {
    const requestId = ++leaderboardRequestRef.current;
    setLeaderboardLoading(true);
    setLeaderboardError(null);

    try {
      const items = await fetchScores(selectedModeId, LEADERBOARD_LIMIT);
      if (requestId !== leaderboardRequestRef.current) {
        return;
      }
      setLeaderboard(items);
    } catch (error) {
      if (requestId !== leaderboardRequestRef.current) {
        return;
      }
      setLeaderboardError(error instanceof Error ? error.message : "Falha ao carregar placar.");
    } finally {
      if (requestId === leaderboardRequestRef.current) {
        setLeaderboardLoading(false);
      }
    }
  }, []);

  const resetSession = useCallback(
    (nextMode?: GameModeId) => {
      const targetMode = nextMode ?? mode;
      sessionRef.current.reset(targetMode);
      scorePromptShownRef.current = false;
      debugRef.current = null;
      gestureOverlayRef.current = null;
      gestureCounterRef.current = 0;
      setFinalSnapshot(null);
      setSubmitMessage(null);
      setGestureLabel(inputModeRef.current === "keyboard_only" ? "Entrada por teclado" : "Aguardando gesto");
      setGestureTimeline([]);
      setGestureStats({
        total: 0,
        confidenceSum: 0
      });
      setHud({
        score: 0,
        lines: 0,
        level: 1,
        fps: 0,
        objective: DEFAULT_OBJECTIVE_BY_MODE[targetMode],
        progress: 0,
        remainingMs: targetMode === "blitz120" ? 120_000 : null,
        paused: false,
        running: true,
        elapsedMs: 0,
        dropIntervalMs: 850
      });
    },
    [mode]
  );

  useEffect(() => {
    sensitivityRef.current = sensitivity;
    detectorRef.current?.setThresholds(sensitivityToThresholds(sensitivity));
  }, [sensitivity]);

  useEffect(() => {
    inputModeRef.current = inputMode;
    if (inputMode === "keyboard_only") {
      debugRef.current = null;
      gestureOverlayRef.current = null;
      setGestureLabel("Entrada por teclado");
    } else if (!finalSnapshot) {
      setGestureLabel("Aguardando gesto");
    }
  }, [finalSnapshot, inputMode]);

  useEffect(() => {
    detectionIntervalRef.current = selectedVisionPreset.sampleIntervalMs;
  }, [selectedVisionPreset.sampleIntervalMs]);

  useEffect(() => {
    showDebugOverlayRef.current = showDebugOverlay;
  }, [showDebugOverlay]);

  useEffect(() => {
    let active = true;
    setCvStatus("loading");
    setCvError(null);

    const setup = async () => {
      try {
        const runtime = await loadOpenCv();
        if (!active) {
          return;
        }
        cvRuntimeRef.current = runtime;
        setCvRuntimeReady(true);
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
    };
  }, []);

  useEffect(() => {
    if (!cvRuntimeReady || !cvRuntimeRef.current) {
      return;
    }

    try {
      setCvStatus("loading");
      setCvError(null);
      rebuildVisionPipeline(cvRuntimeRef.current, selectedVisionPreset.width, selectedVisionPreset.height);
      cvReadyRef.current = true;
      setCvStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao configurar detector.";
      cvReadyRef.current = false;
      setCvStatus("error");
      setCvError(message);
    }
  }, [cvRuntimeReady, rebuildVisionPipeline, selectedVisionPreset.height, selectedVisionPreset.width]);

  useEffect(() => {
    return () => {
      detectorRef.current?.dispose();
      detectorRef.current = null;
      cvReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    if (inputMode === "keyboard_only") {
      setCameraError(null);
      setCameraStatus("ready");
      cameraReadyRef.current = false;
      return () => {
        active = false;
      };
    }

    setCameraStatus("loading");
    setCameraError(null);

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
  }, [inputMode]);

  useEffect(() => {
    resetSession(mode);
    loadLeaderboard(mode).catch(() => {});
  }, [loadLeaderboard, mode, resetSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        return;
      }

      const session = sessionRef.current;
      const allowPieceKeyboard = inputModeRef.current !== "gesture_only";

      switch (event.key) {
        case "ArrowLeft":
          if (!allowPieceKeyboard) {
            return;
          }
          event.preventDefault();
          session.moveHorizontal(-1);
          break;
        case "ArrowRight":
          if (!allowPieceKeyboard) {
            return;
          }
          event.preventDefault();
          session.moveHorizontal(1);
          break;
        case "ArrowUp":
          if (!allowPieceKeyboard) {
            return;
          }
          event.preventDefault();
          session.rotate(true);
          break;
        case "ArrowDown":
          if (!allowPieceKeyboard) {
            return;
          }
          event.preventDefault();
          session.softDrop();
          break;
        case " ":
          if (!allowPieceKeyboard) {
            return;
          }
          event.preventDefault();
          session.hardDrop();
          break;
        case "c":
        case "C":
          if (!allowPieceKeyboard) {
            return;
          }
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
    if (!autoPauseOnBlur) {
      return;
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        return;
      }
      const snapshot = sessionRef.current.getSnapshot();
      if (snapshot.running && !snapshot.paused) {
        sessionRef.current.setPaused(true);
        setAnnouncement("Partida pausada automaticamente ao trocar de aba.");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [autoPauseOnBlur]);

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
        if (!gameCtxRef.current || gameCtxRef.current.canvas !== gameCanvas) {
          gameCtxRef.current = gameCanvas.getContext("2d");
        }
        const gameCtx = gameCtxRef.current;
        if (gameCtx) {
          renderTetris(gameCtx, session.getEngine(), { now });
          if (snapshot.paused) {
            gameCtx.fillStyle = "rgba(6, 12, 20, 0.68)";
            gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
            gameCtx.fillStyle = "#f4f8ff";
            gameCtx.font = "700 42px 'Oswald', sans-serif";
            gameCtx.fillText("PAUSADO", gameCanvas.width * 0.37, gameCanvas.height * 0.5);
          }
        }
      }

      const cameraCanvas = cameraCanvasRef.current;
      if (cameraCanvas) {
        if (!cameraCtxRef.current || cameraCtxRef.current.canvas !== cameraCanvas) {
          cameraCtxRef.current = cameraCanvas.getContext("2d");
        }
        const cameraCtx = cameraCtxRef.current;
        if (cameraCtx) {
          drawCameraPreview({
            ctx: cameraCtx,
            video: videoRef.current,
            debug: debugRef.current,
            gesture: gestureOverlayRef.current,
            now,
            cameraReady: cameraReadyRef.current && inputModeRef.current !== "keyboard_only",
            showDebug: showDebugOverlayRef.current
          });
        }
      }

      gestureAccumulator += dt;
      if (
        gestureAccumulator >= detectionIntervalRef.current &&
        detectorRef.current &&
        processCtxRef.current &&
        processingCanvasRef.current &&
        cameraReadyRef.current &&
        cvReadyRef.current &&
        snapshot.running &&
        !snapshot.paused &&
        inputModeRef.current !== "keyboard_only"
      ) {
        gestureAccumulator = 0;

        const processCanvas = processingCanvasRef.current;
        const processCtx = processCtxRef.current;
        const video = videoRef.current;
        if (processCanvas && processCtx && video && video.readyState >= 2) {
          processCtx.save();
          processCtx.translate(processCanvas.width, 0);
          processCtx.scale(-1, 1);
          processCtx.drawImage(video, 0, 0, processCanvas.width, processCanvas.height);
          processCtx.restore();
          const imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
          const result = detectorRef.current.process(imageData, now);
          debugRef.current = result.debug;

          if (result.gesture) {
            const recognized = result.gesture;
            applyGesture(session, recognized.kind);
            gestureOverlayRef.current = {
              label: recognized.label,
              confidence: recognized.confidence,
              expiresAt: now + 700
            };
            setGestureLabel(recognized.label);
            setGestureTimeline((previous) =>
              [
                {
                  id: `gesture-${gestureCounterRef.current++}`,
                  label: recognized.label,
                  confidence: recognized.confidence,
                  timestamp: Date.now()
                },
                ...previous
              ].slice(0, GESTURE_TIMELINE_LIMIT)
            );
            setGestureStats((previous) => ({
              total: previous.total + 1,
              confidenceSum: previous.confidenceSum + recognized.confidence
            }));
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
          running: freshSnapshot.running,
          elapsedMs: freshSnapshot.elapsedMs,
          dropIntervalMs: freshSnapshot.game.dropIntervalMs
        });

        if (gestureOverlayRef.current && now > gestureOverlayRef.current.expiresAt) {
          setGestureLabel(inputModeRef.current === "keyboard_only" ? "Entrada por teclado" : "Aguardando gesto");
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
          setAnnouncement("Partida encerrada. Voce pode enviar o score para o ranking.");
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

  useEffect(() => {
    if (cameraError) {
      setAnnouncement(`Erro na camera: ${cameraError}`);
    }
  }, [cameraError]);

  useEffect(() => {
    if (cvError) {
      setAnnouncement(`Erro no OpenCV: ${cvError}`);
    }
  }, [cvError]);

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
        setAnnouncement(`Score enviado. Posicao ${response.placement}.`);
        await loadLeaderboard(finalSnapshot.mode);
      } catch (error) {
        setSubmitMessage(error instanceof Error ? error.message : "Falha ao enviar score.");
      } finally {
        setSubmitBusy(false);
      }
    },
    [finalSnapshot, loadLeaderboard, playerName]
  );

  const autoTuneSensitivity = useCallback(() => {
    if (gestureStats.total < 4) {
      setAnnouncement("Calibracao indisponivel. Gere mais gestos antes de ajustar.");
      return;
    }

    const average = gestureStats.confidenceSum / gestureStats.total;
    let nextSensitivity = sensitivity;
    if (average < 0.35) {
      nextSensitivity = Math.max(24, sensitivity - 10);
    } else if (average > 0.72) {
      nextSensitivity = Math.min(92, sensitivity + 8);
    }

    setSensitivity(nextSensitivity);
    setAnnouncement(`Sensibilidade ajustada automaticamente para ${nextSensitivity}%.`);
  }, [gestureStats.confidenceSum, gestureStats.total, sensitivity, setSensitivity]);

  return (
    <section
      className="arena-shell"
      data-contrast={highContrastUi ? "high" : "normal"}
      aria-label="Aplicacao principal do Tetris por gestos"
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header className="arena-hero">
        <div className="hero-copy">
          <p className="hero-kicker">Realtime vision controlled gameplay</p>
          <h1>Tetris Gesture Control Deck</h1>
          <p>
            Direcione pecas por gesto da mao, combine com teclado quando quiser e acompanhe a saude
            de runtime em um painel tecnico de alto contraste.
          </p>
          <div className="hero-meta-grid">
            <article>
              <span>Input atual</span>
              <strong>{selectedInputMode.label}</strong>
            </article>
            <article>
              <span>Preset visao</span>
              <strong>{selectedVisionPreset.label}</strong>
            </article>
            <article>
              <span>Estado</span>
              <strong>{sessionStateLabel}</strong>
            </article>
            <article>
              <span>FPS</span>
              <strong>
                {hud.fps} ({fpsHealth})
              </strong>
            </article>
          </div>
        </div>

        <div className="hero-config">
          <label htmlFor="mode-select">Modo de jogo</label>
          <select id="mode-select" value={mode} onChange={(event) => setMode(event.target.value as GameModeId)}>
            {GAME_MODE_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <p>{selectedMode?.description}</p>

          <div className="toggle-group">
            <span>Perfil de input</span>
            <div className="chip-row">
              {INPUT_MODE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === inputMode ? "chip is-active" : "chip"}
                  onClick={() => setInputMode(item.id)}
                  aria-pressed={item.id === inputMode}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p>{selectedInputMode.description}</p>
          </div>

          <div className="toggle-group">
            <span>Preset de visao</span>
            <div className="chip-row">
              {VISION_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === visionPresetId ? "chip is-active" : "chip"}
                  onClick={() => setVisionPresetId(item.id)}
                  aria-pressed={item.id === visionPresetId}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p>{selectedVisionPreset.description}</p>
          </div>
        </div>
      </header>

      <div className="arena-layout">
        <section className="board-column">
          <article className="board-card">
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
          </article>

          <article className="objective-card" aria-live="polite">
            <div className="objective-labels">
              <span>Objetivo</span>
              <strong>{hud.objective}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div style={{ width: `${Math.round(hud.progress * 100)}%` }} />
            </div>
            <div className="objective-tail">
              {hud.remainingMs !== null && <span className="timer-pill">{formatDuration(hud.remainingMs)}</span>}
              <span className="drop-pill">drop {Math.round(1000 / Math.max(1, hud.dropIntervalMs))}/s</span>
            </div>
          </article>

          <div className="metrics-grid">
            <article className="metric-card">
              <span>Score</span>
              <strong>{hud.score}</strong>
            </article>
            <article className="metric-card">
              <span>Linhas</span>
              <strong>{hud.lines}</strong>
            </article>
            <article className="metric-card">
              <span>Nivel</span>
              <strong>{hud.level}</strong>
            </article>
            <article className="metric-card">
              <span>Tempo</span>
              <strong>{formatDuration(hud.elapsedMs)}</strong>
            </article>
          </div>

          <article className="insights-card">
            <h2>Session Insights</h2>
            <div className="insights-grid">
              <div>
                <span>Gestos totais</span>
                <strong>{gestureStats.total}</strong>
              </div>
              <div>
                <span>Confianca media</span>
                <strong>{averageConfidence}%</strong>
              </div>
              <div>
                <span>APM</span>
                <strong>{actionsPerMinute}</strong>
              </div>
              <div>
                <span>Qualidade</span>
                <strong>{fpsHealth}</strong>
              </div>
            </div>
          </article>
        </section>

        <aside className="dock-column">
          <section className="panel-card vision-card">
            <div className="panel-head">
              <h2>Vision Feed</h2>
              <div className="badge-row">
                <span data-state={cameraBadgeState}>{cameraBadgeLabel}</span>
                <span data-state={cvStatus}>opencv {statusLabel(cvStatus)}</span>
                <span data-state={hud.paused ? "warn" : hud.running ? "ready" : "warn"}>{sessionStateLabel}</span>
              </div>
            </div>
            <canvas
              ref={cameraCanvasRef}
              className="camera-canvas"
              width={selectedVisionPreset.width}
              height={selectedVisionPreset.height}
              aria-label="Preview da camera com deteccao de gestos"
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

            <div className="slider-row">
              <label htmlFor="sensitivity-range">Sensibilidade dos gestos: {sensitivity}%</label>
              <input
                id="sensitivity-range"
                type="range"
                min={20}
                max={95}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
              />
              <button type="button" className="subtle-button" onClick={autoTuneSensitivity}>
                Auto calibrar via confianca media
              </button>
            </div>

            <div className="switch-grid">
              <label>
                <input
                  type="checkbox"
                  checked={autoPauseOnBlur}
                  onChange={(event) => setAutoPauseOnBlur(event.target.checked)}
                />
                Auto pausar ao trocar de aba
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showDebugOverlay}
                  onChange={(event) => setShowDebugOverlay(event.target.checked)}
                />
                Exibir overlay tecnico da visao
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={highContrastUi}
                  onChange={(event) => setHighContrastUi(event.target.checked)}
                />
                Ativar UI de alto contraste
              </label>
            </div>

            <ul className="help-list">
              <li>Seta esquerda/direita para ajuste fino da peca.</li>
              <li>Flick para baixo no gesto executa hard drop.</li>
              <li>Modo teclado reduz carga do detector para foco em performance.</li>
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
                    <div>
                      <span>{entry.name}</span>
                      <small>{formatDuration(entry.durationMs)}</small>
                    </div>
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
                  <div>
                    <span>{item.label}</span>
                    <small>{formatTimelineTime(item.timestamp)}</small>
                  </div>
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
