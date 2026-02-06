/**
 * Health Check API Route
 * Provides service health status for monitoring and load balancers.
 */

import { createResponse } from "@/lib/server/api/response-builder";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    memory: { status: string; usedMb: number };
  };
}

const startTime = Date.now();

export async function GET(request: Request) {
  const res = createResponse(request);

  const memoryUsage = process.memoryUsage();
  const usedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

  const health: HealthStatus = {
    status: "healthy",
    service: "gesture-tetris-api",
    version: process.env.npm_package_version ?? "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      memory: {
        status: usedMb < 512 ? "ok" : "warning",
        usedMb
      }
    }
  };

  return res.success(health);
}

export async function OPTIONS(request: Request) {
  return createResponse(request).options();
}
