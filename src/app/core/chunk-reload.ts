/**
 * After a Vercel deploy, hashed lazy chunks from the previous build 404.
 * An open tab still references the old filenames → navigation dies.
 * Detect that and hard-reload once (cooldown) so the browser picks up the new index.
 */

const RELOAD_AT_KEY = 'qet3etak.chunk_reload_at';
const COOLDOWN_MS = 30_000;

export function isStaleChunkError(err: unknown): boolean {
  const parts: string[] = [];
  if (typeof err === 'string') parts.push(err);
  if (err instanceof Error) {
    parts.push(err.name, err.message);
  }
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; error?: unknown; rejection?: unknown };
    if (typeof o.message === 'string') parts.push(o.message);
    if (o.error instanceof Error) parts.push(o.error.message);
    if (typeof o.error === 'string') parts.push(o.error);
    if (o.rejection instanceof Error) parts.push(o.rejection.message);
  }
  const text = parts.join(' ');
  return (
    /Failed to fetch dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text) ||
    /ChunkLoadError/i.test(text) ||
    /Loading chunk [\w-]+ failed/i.test(text)
  );
}

/** Returns true if a reload was triggered. */
export function reloadOnStaleChunk(err: unknown): boolean {
  if (typeof window === 'undefined' || !isStaleChunkError(err)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || '0');
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {
    /* private mode — still attempt reload */
  }
  window.location.reload();
  return true;
}

/** Install global listeners before Angular boots. */
export function installStaleChunkReload(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    if (reloadOnStaleChunk(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    reloadOnStaleChunk(event.error ?? event.message);
  });
}
