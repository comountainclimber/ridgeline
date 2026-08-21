type AppUrlEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

/** Canonical public origin. Magic-link emails and metadata must use this, never localhost in prod. */
export function resolveAppUrl(env: AppUrlEnv | NodeJS.ProcessEnv = process.env): string {
  const explicit = normalizeOrigin(env.NEXT_PUBLIC_APP_URL);
  if (explicit && !isLoopback(explicit)) return explicit;

  if (env.VERCEL_ENV === "production") {
    const production = normalizeOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
    if (production) return production;
  }

  const deployment = normalizeOrigin(env.VERCEL_URL);
  if (deployment) return deployment;

  return explicit ?? "http://localhost:3000";
}

function normalizeOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopback(origin: string): boolean {
  const host = new URL(origin).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
