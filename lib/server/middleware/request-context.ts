/**
 * Request Context Module
 * Provides request tracing and correlation IDs for logging and debugging.
 */

import { headers } from "next/headers";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Generates a unique request ID using timestamp and random suffix.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Extracts or generates a request ID from the incoming request.
 * If the client provides one, it's used; otherwise, a new one is generated.
 */
export function getRequestId(request: Request): string {
  const provided = request.headers.get(REQUEST_ID_HEADER);
  if (provided && /^[a-zA-Z0-9-]{8,64}$/.test(provided)) {
    return provided;
  }
  return generateRequestId();
}

/**
 * Creates response headers with the request ID included.
 */
export function withRequestIdHeaders(
  requestId: string,
  extra?: HeadersInit
): HeadersInit {
  return {
    [REQUEST_ID_HEADER]: requestId,
    "Cache-Control": "no-store",
    ...extra
  };
}

/**
 * Request context object passed through the request lifecycle.
 */
export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string;
  startTime: number;
  path: string;
  method: string;
}

/**
 * Creates a request context from an incoming request.
 */
export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  let ip = "unknown";
  if (forwardedFor) {
    ip = forwardedFor.split(",")[0].trim();
  } else if (realIp) {
    ip = realIp.trim();
  }

  // Validate IP format to prevent header injection
  if (!/^[\d.:a-fA-F]+$/.test(ip)) {
    ip = "invalid";
  }

  return {
    requestId: getRequestId(request),
    ip,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    startTime: Date.now(),
    path: url.pathname,
    method: request.method
  };
}
