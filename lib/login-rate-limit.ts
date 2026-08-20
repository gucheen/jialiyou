const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const MAX_TRACKED_CLIENTS = 4096;

type FailureWindow = {
  count: number;
  resetAt: number;
};

const failures = new Map<string, FailureWindow>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const identifier = forwarded || direct || "unknown";
  return identifier.slice(0, 128);
}

function prune(now: number) {
  for (const [key, window] of failures) {
    if (window.resetAt <= now) failures.delete(key);
  }
  while (failures.size >= MAX_TRACKED_CLIENTS) {
    const oldest = failures.keys().next().value as string | undefined;
    if (!oldest) break;
    failures.delete(oldest);
  }
}

export function checkLoginRateLimit(request: Request) {
  const now = Date.now();
  prune(now);
  const key = clientKey(request);
  const window = failures.get(key);
  if (!window || window.count < MAX_FAILURES) return { allowed: true, key, retryAfter: 0 };
  return { allowed: false, key, retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000)) };
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const current = failures.get(key);
  if (!current || current.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}
