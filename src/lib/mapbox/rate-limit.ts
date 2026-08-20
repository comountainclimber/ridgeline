const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now > hit.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (hit.count >= limit) return false;
  hit.count += 1;
  return true;
}
