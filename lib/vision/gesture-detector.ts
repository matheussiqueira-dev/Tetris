/* eslint-disable @typescript-eslint/no-explicit-any */
export type GestureKind = "move_left" | "move_right" | "rotate_cw" | "rotate_ccw" | "hard_drop";

export interface GestureEvent {
  kind: GestureKind;
  label: string;
  confidence: number;
  timestamp: number;
}

export interface DetectionDebug {
  detected: boolean;
  centroid: { x: number; y: number } | null;
  fingertip: { x: number; y: number } | null;
  angleDeg: number;
  confidence: number;
  contourArea: number;
  maskFillRatio: number;
  velocity: { x: number; y: number };
  controlZoneX: number;
  frame: { width: number; height: number };
}

export interface DetectionResult {
  gesture: GestureEvent | null;
  debug: DetectionDebug;
}

interface GestureDetectorOptions {
  width?: number;
  height?: number;
  minContourArea?: number;
  thresholds?: Partial<GestureThresholds>;
}

export interface GestureThresholds {
  lateralVelocity: number;
  verticalDropVelocity: number;
  verticalNoiseCap: number;
  rotationAccumulatedDeg: number;
  rotationAngularVelocity: number;
}

const LABELS: Record<GestureKind, string> = {
  move_left: "Mover esquerda",
  move_right: "Mover direita",
  rotate_cw: "Rotacao horaria",
  rotate_ccw: "Rotacao anti-horaria",
  hard_drop: "Drop instantaneo"
};

const DEFAULT_THRESHOLDS: GestureThresholds = {
  lateralVelocity: 430,
  verticalDropVelocity: 760,
  verticalNoiseCap: 560,
  rotationAccumulatedDeg: 16,
  rotationAngularVelocity: 80
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number, width: number, height: number): number {
  let normalized = angle;
  if (width < height) {
    normalized += 90;
  }

  while (normalized > 90) {
    normalized -= 180;
  }

  while (normalized < -90) {
    normalized += 180;
  }

  return normalized;
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > 90) {
    delta -= 180;
  }
  while (delta < -90) {
    delta += 180;
  }
  return delta;
}

export class HandGestureDetector {
  private readonly cv: any;

  private frameWidth: number;

  private frameHeight: number;

  private minContourArea: number;

  private src: any;

  private rgb: any;

  private hsv: any;

  private mask1: any;

  private mask2: any;

  private mask: any;

  private blurred: any;

  private kernel: any;

  private lower1: any;

  private upper1: any;

  private lower2: any;

  private upper2: any;

  private filteredCenter: { x: number; y: number } | null = null;

  private filteredAngle: number | null = null;

  private lastCenter: { x: number; y: number } | null = null;

  private lastAngle: number | null = null;

  private lastTimestamp = 0;

  private stableFrames = 0;

  private accumulatedRotation = 0;

  private lastGestureAt: Partial<Record<GestureKind, number>> = {};

  private lastAnyGestureAt = 0;

  private thresholds: GestureThresholds = DEFAULT_THRESHOLDS;

  constructor(cv: any, options: GestureDetectorOptions = {}) {
    this.cv = cv;
    this.frameWidth = options.width ?? 320;
    this.frameHeight = options.height ?? 240;
    this.minContourArea = options.minContourArea ?? 1700;
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...options.thresholds
    };
    this.allocateMats(this.frameWidth, this.frameHeight);
  }

  dispose(): void {
    this.releaseMats();
  }

  setThresholds(next: Partial<GestureThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...next
    };
  }

  process(imageData: ImageData, timestamp: number): DetectionResult {
    if (imageData.width !== this.frameWidth || imageData.height !== this.frameHeight) {
      this.frameWidth = imageData.width;
      this.frameHeight = imageData.height;
      this.allocateMats(this.frameWidth, this.frameHeight);
    }

    this.src.data.set(imageData.data);
    this.cv.cvtColor(this.src, this.rgb, this.cv.COLOR_RGBA2RGB);
    this.cv.cvtColor(this.rgb, this.hsv, this.cv.COLOR_RGB2HSV);
    this.cv.inRange(this.hsv, this.lower1, this.upper1, this.mask1);
    this.cv.inRange(this.hsv, this.lower2, this.upper2, this.mask2);
    this.cv.bitwise_or(this.mask1, this.mask2, this.mask);
    this.cv.GaussianBlur(
      this.mask,
      this.blurred,
      new this.cv.Size(7, 7),
      0,
      0,
      this.cv.BORDER_DEFAULT
    );
    this.cv.morphologyEx(this.blurred, this.mask, this.cv.MORPH_OPEN, this.kernel);
    this.cv.morphologyEx(this.mask, this.mask, this.cv.MORPH_CLOSE, this.kernel);

    const contours = new this.cv.MatVector();
    const hierarchy = new this.cv.Mat();
    let bestContour: any = null;
    let bestArea = 0;

    try {
      this.cv.findContours(
        this.mask,
        contours,
        hierarchy,
        this.cv.RETR_EXTERNAL,
        this.cv.CHAIN_APPROX_SIMPLE
      );

      for (let i = 0; i < contours.size(); i += 1) {
        const contour = contours.get(i);
        const area = this.cv.contourArea(contour, false);
        if (area > bestArea) {
          if (bestContour) {
            bestContour.delete();
          }
          bestContour = contour;
          bestArea = area;
        } else {
          contour.delete();
        }
      }

      const hasHand = Boolean(bestContour) && bestArea >= this.minContourArea;
      const frameArea = this.frameWidth * this.frameHeight;
      const debugBase: DetectionDebug = {
        detected: false,
        centroid: null,
        fingertip: null,
        angleDeg: 0,
        confidence: 0,
        contourArea: bestArea,
        maskFillRatio: this.cv.countNonZero(this.mask) / frameArea,
        velocity: { x: 0, y: 0 },
        controlZoneX: this.frameWidth * 0.85,
        frame: { width: this.frameWidth, height: this.frameHeight }
      };

      if (!hasHand || !bestContour) {
        this.handleTrackingLoss(timestamp);
        return { gesture: null, debug: debugBase };
      }

      const moments = this.cv.moments(bestContour, false);
      if (!moments.m00) {
        this.handleTrackingLoss(timestamp);
        return { gesture: null, debug: debugBase };
      }

      const cx = moments.m10 / moments.m00;
      const cy = moments.m01 / moments.m00;
      const rect = this.cv.minAreaRect(bestContour);
      const handAngle = normalizeAngle(rect.angle, rect.size.width, rect.size.height);

      const fingertip = this.extractFingertip(bestContour, cx, cy);
      const confidence = clamp(bestArea / (frameArea * 0.33), 0, 1);
      this.stableFrames += 1;

      if (!this.filteredCenter) {
        this.filteredCenter = { x: cx, y: cy };
      } else {
        const alpha = 0.44;
        this.filteredCenter = {
          x: this.filteredCenter.x + (cx - this.filteredCenter.x) * alpha,
          y: this.filteredCenter.y + (cy - this.filteredCenter.y) * alpha
        };
      }

      if (this.filteredAngle === null) {
        this.filteredAngle = handAngle;
      } else {
        this.filteredAngle += shortestAngleDelta(this.filteredAngle, handAngle) * 0.35;
      }

      let velocity = { x: 0, y: 0 };
      if (this.lastCenter && this.lastTimestamp > 0) {
        const dt = (timestamp - this.lastTimestamp) / 1000;
        if (dt > 0.002) {
          velocity = {
            x: (this.filteredCenter.x - this.lastCenter.x) / dt,
            y: (this.filteredCenter.y - this.lastCenter.y) / dt
          };
        }
      }

      let angleVelocity = 0;
      if (this.lastAngle !== null && this.lastTimestamp > 0 && this.filteredAngle !== null) {
        const dt = (timestamp - this.lastTimestamp) / 1000;
        if (dt > 0.002) {
          const delta = shortestAngleDelta(this.lastAngle, this.filteredAngle);
          angleVelocity = delta / dt;
          this.accumulatedRotation += delta;
          this.accumulatedRotation = clamp(this.accumulatedRotation, -60, 60);
        }
      }

      this.lastCenter = this.filteredCenter;
      this.lastAngle = this.filteredAngle;
      this.lastTimestamp = timestamp;

      const debug: DetectionDebug = {
        detected: true,
        centroid: this.filteredCenter,
        fingertip,
        angleDeg: this.filteredAngle ?? 0,
        confidence,
        contourArea: bestArea,
        maskFillRatio: debugBase.maskFillRatio,
        velocity,
        controlZoneX: debugBase.controlZoneX,
        frame: debugBase.frame
      };

      const gesture = this.detectGesture(
        velocity,
        angleVelocity,
        confidence,
        timestamp,
        this.filteredCenter.x,
        debug.controlZoneX
      );

      return { gesture, debug };
    } finally {
      if (bestContour) {
        bestContour.delete();
      }
      contours.delete();
      hierarchy.delete();
    }
  }

  private detectGesture(
    velocity: { x: number; y: number },
    angleVelocity: number,
    confidence: number,
    timestamp: number,
    centroidX: number,
    controlZoneX: number
  ): GestureEvent | null {
    if (this.stableFrames < 5 || confidence < 0.12) {
      return null;
    }

    const inControlZone = centroidX <= controlZoneX;
    const absoluteVx = Math.abs(velocity.x);
    const absoluteVy = Math.abs(velocity.y);
    const absoluteAngleSpeed = Math.abs(angleVelocity);

    if (
      inControlZone &&
      velocity.y > this.thresholds.verticalDropVelocity &&
      absoluteVx < 520 &&
      this.canTrigger("hard_drop", timestamp, 450)
    ) {
      return this.trigger("hard_drop", confidence, timestamp);
    }

    if (
      inControlZone &&
      Math.abs(this.accumulatedRotation) > this.thresholds.rotationAccumulatedDeg &&
      absoluteVy < this.thresholds.verticalNoiseCap &&
      absoluteAngleSpeed > this.thresholds.rotationAngularVelocity
    ) {
      const kind: GestureKind = this.accumulatedRotation > 0 ? "rotate_cw" : "rotate_ccw";
      if (this.canTrigger(kind, timestamp, 320)) {
        this.accumulatedRotation = 0;
        return this.trigger(kind, confidence, timestamp);
      }
    }

    if (inControlZone && absoluteVx > this.thresholds.lateralVelocity && absoluteVy < 600) {
      const kind: GestureKind = velocity.x > 0 ? "move_right" : "move_left";
      if (this.canTrigger(kind, timestamp, 190)) {
        return this.trigger(kind, confidence, timestamp);
      }
    }

    this.accumulatedRotation *= 0.86;
    return null;
  }

  private trigger(kind: GestureKind, confidence: number, timestamp: number): GestureEvent {
    this.lastGestureAt[kind] = timestamp;
    this.lastAnyGestureAt = timestamp;
    return {
      kind,
      label: LABELS[kind],
      confidence,
      timestamp
    };
  }

  private canTrigger(kind: GestureKind, timestamp: number, cooldownMs: number): boolean {
    if (timestamp - this.lastAnyGestureAt < 90) {
      return false;
    }

    const last = this.lastGestureAt[kind] ?? -Number.MAX_SAFE_INTEGER;
    return timestamp - last >= cooldownMs;
  }

  private extractFingertip(contour: any, fallbackX: number, fallbackY: number): { x: number; y: number } {
    const points = contour.data32S as Int32Array;
    if (!points || points.length < 2) {
      return { x: fallbackX, y: fallbackY };
    }

    let bestX = fallbackX;
    let bestY = fallbackY;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      if (y < bestY) {
        bestX = x;
        bestY = y;
      }
    }

    return { x: bestX, y: bestY };
  }

  private handleTrackingLoss(timestamp: number): void {
    this.stableFrames = 0;
    this.filteredCenter = null;
    this.filteredAngle = null;
    this.lastCenter = null;
    this.lastAngle = null;
    this.lastTimestamp = timestamp;
    this.accumulatedRotation *= 0.72;
  }

  private allocateMats(width: number, height: number): void {
    this.releaseMats();

    this.src = new this.cv.Mat(height, width, this.cv.CV_8UC4);
    this.rgb = new this.cv.Mat(height, width, this.cv.CV_8UC3);
    this.hsv = new this.cv.Mat(height, width, this.cv.CV_8UC3);
    this.mask1 = new this.cv.Mat(height, width, this.cv.CV_8UC1);
    this.mask2 = new this.cv.Mat(height, width, this.cv.CV_8UC1);
    this.mask = new this.cv.Mat(height, width, this.cv.CV_8UC1);
    this.blurred = new this.cv.Mat(height, width, this.cv.CV_8UC1);
    this.kernel = this.cv.getStructuringElement(this.cv.MORPH_ELLIPSE, new this.cv.Size(5, 5));

    this.lower1 = new this.cv.Scalar(0, 30, 45, 0);
    this.upper1 = new this.cv.Scalar(25, 185, 255, 255);
    this.lower2 = new this.cv.Scalar(160, 30, 45, 0);
    this.upper2 = new this.cv.Scalar(180, 185, 255, 255);
  }

  private releaseMats(): void {
    this.safeDelete(this.src);
    this.safeDelete(this.rgb);
    this.safeDelete(this.hsv);
    this.safeDelete(this.mask1);
    this.safeDelete(this.mask2);
    this.safeDelete(this.mask);
    this.safeDelete(this.blurred);
    this.safeDelete(this.kernel);
    this.safeDelete(this.lower1);
    this.safeDelete(this.upper1);
    this.safeDelete(this.lower2);
    this.safeDelete(this.upper2);
  }

  private safeDelete(mat: unknown): void {
    if (mat && typeof mat === "object" && "delete" in mat && typeof (mat as any).delete === "function") {
      (mat as any).delete();
    }
  }
}
