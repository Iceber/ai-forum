const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const API_DEFAULT_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '3001';

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getBrowserApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window === 'undefined') {
    return trimTrailingSlash(configured ?? `http://localhost:${API_DEFAULT_PORT}`);
  }

  if (!configured) {
    return `${window.location.protocol}//${window.location.hostname}:${API_DEFAULT_PORT}`;
  }

  try {
    const parsed = new URL(configured);
    if (
      LOCAL_HOSTS.has(parsed.hostname) &&
      !LOCAL_HOSTS.has(window.location.hostname)
    ) {
      parsed.hostname = window.location.hostname;
    }
    return trimTrailingSlash(parsed.toString());
  } catch {
    return trimTrailingSlash(configured);
  }
}
