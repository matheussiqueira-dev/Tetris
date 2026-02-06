interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export class InMemoryRateLimiter {
  private readonly store = new Map<string, RateLimitWindow>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  take(key: string, now = Date.now()): RateLimitResult {
    const current = this.store.get(key);
    if (!current || now >= current.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    current.count += 1;
    this.store.set(key, current);
    if (current.count <= this.maxRequests) {
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(0, current.resetAt - now)
    };
  }

  resetAll(): void {
    this.store.clear();
  }
}
