const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '3001';
let cachedBrowserApiBase: string | null = null;

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Browser-side API base resolution:
 * - SSR: use configured NEXT_PUBLIC_API_URL, otherwise localhost + default API port.
 * - Browser: if configured API host is localhost/127.0.0.1 but frontend is opened via LAN IP/host, rewrite API host to current frontend host while keeping protocol/port.
 * - Browser fallback: if NEXT_PUBLIC_API_URL is not set, use current frontend protocol+host with NEXT_PUBLIC_API_PORT (default 3001); if parsing fails, return configured raw value.
 */
export function getBrowserApiBase(): string {
  if (typeof window !== 'undefined' && cachedBrowserApiBase !== null) {
    return cachedBrowserApiBase;
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window === 'undefined') {
    return trimTrailingSlash(configured ?? `http://localhost:${API_PORT}`);
  }

  if (!configured) {
    cachedBrowserApiBase = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
    return cachedBrowserApiBase;
  }

  try {
    const parsed = new URL(configured);
    if (
      LOCAL_HOSTS.has(parsed.hostname) &&
      !LOCAL_HOSTS.has(window.location.hostname)
    ) {
      parsed.hostname = window.location.hostname;
    }
    cachedBrowserApiBase = trimTrailingSlash(parsed.toString());
    return cachedBrowserApiBase;
  } catch {
    cachedBrowserApiBase = trimTrailingSlash(configured);
    return cachedBrowserApiBase;
  }
}
