type Route = string;
type IP = string;
type Entry = { count: number; resetAt: number };

const store = new Map<`${IP}:${Route}`, Entry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
  lastCleanup = now;
}

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  default: { max: 30, windowMs: 60_000 },
  "/api/reports/[id]/pdf": { max: 10, windowMs: 60_000 },
  "/api/reports/[id]/send-email": { max: 5, windowMs: 60_000 },
  "/api/reports/[id]/send-telegram": { max: 5, windowMs: 60_000 },
  "/api/setup": { max: 3, windowMs: 3600_000 },
};

export function checkRateLimit(
  ip: string,
  route: string,
  overrides?: Partial<RateLimitConfig>
): { allowed: boolean; limit: number; remaining: number; resetIn: number } {
  cleanup();
  const config = { ...(DEFAULTS[route] ?? DEFAULTS.default), ...overrides };
  const key: `${IP}:${Route}` = `${ip}:${route}`;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, limit: config.max, remaining: config.max - 1, resetIn: config.windowMs };
  }

  existing.count++;
  if (existing.count > config.max) {
    return { allowed: false, limit: config.max, remaining: 0, resetIn: existing.resetAt - now };
  }

  return { allowed: true, limit: config.max, remaining: config.max - existing.count, resetIn: existing.resetAt - now };
}

export function rateLimitHeaders(result: { limit: number; remaining: number; resetIn: number }): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetIn / 1000)),
  };
}
