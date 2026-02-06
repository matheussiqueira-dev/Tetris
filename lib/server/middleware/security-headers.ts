/**
 * Security Headers Module
 * Provides common security headers for API responses.
 */

export interface SecurityHeadersOptions {
  allowCredentials?: boolean;
  allowedOrigins?: string[];
  maxAge?: number;
}

const DEFAULT_OPTIONS: SecurityHeadersOptions = {
  allowCredentials: false,
  allowedOrigins: ["*"],
  maxAge: 86400
};

/**
 * Creates security headers for API responses.
 */
export function createSecurityHeaders(
  options: SecurityHeadersOptions = {}
): HeadersInit {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-Admin-Token",
    "Access-Control-Max-Age": String(config.maxAge),
    ...(config.allowCredentials && { "Access-Control-Allow-Credentials": "true" })
  };
}

/**
 * Creates CORS headers based on request origin.
 */
export function createCorsHeaders(
  request: Request,
  options: SecurityHeadersOptions = {}
): HeadersInit {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const origin = request.headers.get("origin") ?? "*";

  const allowedOrigin =
    config.allowedOrigins?.includes("*") || config.allowedOrigins?.includes(origin)
      ? origin
      : config.allowedOrigins?.[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    ...createSecurityHeaders(options)
  };
}

/**
 * Merges multiple header objects.
 */
export function mergeHeaders(...headerSets: (HeadersInit | undefined)[]): HeadersInit {
  const result: Record<string, string> = {};

  for (const headers of headerSets) {
    if (!headers) continue;

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(headers)) {
      for (const [key, value] of headers) {
        result[key] = value;
      }
    } else {
      Object.assign(result, headers);
    }
  }

  return result;
}
