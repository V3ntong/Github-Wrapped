type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Fallback to remoteAddress from Next.js Request
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(key: string, limit = 30, windowMs = 60000): { allowed: boolean; remaining?: number; resetAt?: Date } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.resetAt > windowMs) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    const retryAfter = bucket.resetAt - now;
    return { allowed: false, remaining: 0, resetAt: new Date(bucket.resetAt) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}