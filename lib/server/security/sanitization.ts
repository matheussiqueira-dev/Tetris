/**
 * Input Sanitization Module
 * Provides utilities for sanitizing and validating user input.
 */

/**
 * Removes potentially dangerous HTML/script content from strings.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

/**
 * Validates and sanitizes a player name.
 */
export function sanitizePlayerName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .slice(0, 18);
}

/**
 * Validates that a value is a safe integer within bounds.
 */
export function sanitizeInteger(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, num));
}

/**
 * Validates IP address format (IPv4 or IPv6).
 */
export function isValidIp(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$/;

  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

/**
 * Extracts and validates client IP from request headers.
 */
export function extractClientIp(request: Request): string {
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip"
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      const ip = value.split(",")[0].trim();
      // Basic validation to prevent header injection
      if (/^[\d.:a-fA-F]+$/.test(ip) && ip.length <= 45) {
        return ip;
      }
    }
  }

  return "unknown";
}
