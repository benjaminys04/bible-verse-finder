// Tiny in-memory token-bucket rate limiter for the server API routes.
//
// This protects the LLM key from abuse during dev and single-instance hosting.
// NOTE: it is per-process, so on a multi-instance/serverless deployment it is
// best-effort only. For production at scale, back this with Redis/Upstash.

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();

const CAPACITY = 12; // burst size
const REFILL_PER_SEC = 0.2; // ~12 requests/min sustained

export function rateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: CAPACITY, updated: now };

  // Refill based on elapsed time.
  const elapsed = (now - b.updated) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_SEC);
  b.updated = now;

  if (b.tokens < 1) {
    buckets.set(key, b);
    const retryAfter = Math.ceil((1 - b.tokens) / REFILL_PER_SEC);
    return { ok: false, retryAfter };
  }

  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

// Best-effort client key from request headers.
export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}
