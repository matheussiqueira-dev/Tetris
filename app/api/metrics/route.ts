/**
 * Metrics API Route
 * Provides Prometheus-compatible metrics endpoint.
 */

import { createResponse } from "@/lib/server/api/response-builder";
import { scoreService } from "@/lib/server/scores/store";

const startTime = Date.now();

interface Metric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  value: number;
  labels?: Record<string, string>;
}

function formatPrometheusMetrics(metrics: Metric[]): string {
  const lines: string[] = [];

  for (const metric of metrics) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);

    if (metric.labels) {
      const labelStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${metric.name}{${labelStr}} ${metric.value}`);
    } else {
      lines.push(`${metric.name} ${metric.value}`);
    }
  }

  return lines.join("\n");
}

export async function GET(request: Request) {
  const res = createResponse(request);
  const acceptHeader = request.headers.get("accept") ?? "";

  const stats = scoreService.getStats();
  const memoryUsage = process.memoryUsage();

  const metrics: Metric[] = [
    {
      name: "gesture_tetris_uptime_seconds",
      help: "Time since service started in seconds",
      type: "gauge",
      value: Math.floor((Date.now() - startTime) / 1000)
    },
    {
      name: "gesture_tetris_scores_total",
      help: "Total number of scores submitted",
      type: "counter",
      value: stats.totalScores
    },
    {
      name: "gesture_tetris_scores_by_mode",
      help: "Number of scores by game mode",
      type: "gauge",
      value: stats.scoresByMode.classic,
      labels: { mode: "classic" }
    },
    {
      name: "gesture_tetris_scores_by_mode",
      help: "Number of scores by game mode",
      type: "gauge",
      value: stats.scoresByMode.sprint40,
      labels: { mode: "sprint40" }
    },
    {
      name: "gesture_tetris_scores_by_mode",
      help: "Number of scores by game mode",
      type: "gauge",
      value: stats.scoresByMode.blitz120,
      labels: { mode: "blitz120" }
    },
    {
      name: "gesture_tetris_memory_heap_used_bytes",
      help: "Process heap memory used in bytes",
      type: "gauge",
      value: memoryUsage.heapUsed
    },
    {
      name: "gesture_tetris_memory_heap_total_bytes",
      help: "Process heap memory total in bytes",
      type: "gauge",
      value: memoryUsage.heapTotal
    },
    {
      name: "gesture_tetris_memory_rss_bytes",
      help: "Process resident set size in bytes",
      type: "gauge",
      value: memoryUsage.rss
    }
  ];

  // Return Prometheus format if requested
  if (acceptHeader.includes("text/plain")) {
    return new Response(formatPrometheusMetrics(metrics), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  // Return JSON format by default
  return res.success({
    uptime: Math.floor((Date.now() - startTime) / 1000),
    scores: stats,
    memory: {
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024)
    }
  });
}

export async function OPTIONS(request: Request) {
  return createResponse(request).options();
}
