/**
 * WebSocket Dynamic Import Wrapper
 * 
 * The `ws` npm package is a Node.js-only module that cannot be bundled
 * by Turbopack (Next.js 16 default bundler) during build time.
 * 
 * This module provides a lazy-loaded wrapper that only imports `ws`
 * at runtime (when the WebSocket server is actually started), never
 * during the build/SSR phase.
 * 
 * IMPORTANT: No static type references to "ws" module to avoid
 * Turbopack trying to resolve it during build.
 * 
 * On Vercel serverless, the WebSocket server never starts, so `ws`
 * is never imported.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WsModule = any;

let _wsModule: WsModule | null = null;
let _loadAttempted = false;
let _loadError: string | null = null;

/**
 * Dynamically load the `ws` module. Returns null if unavailable
 * (e.g. in Vercel serverless build, or if `ws` is not installed).
 */
export async function loadWs(): Promise<WsModule | null> {
  if (_loadAttempted) {
    return _wsModule;
  }

  _loadAttempted = true;

  try {
    // Dynamic import — only resolves at runtime, never at build time
    const mod = await import("ws");
    _wsModule = mod;
    return _wsModule;
  } catch (err) {
    _loadError = err instanceof Error ? err.message : String(err);
    console.warn(`[WS] Failed to load 'ws' module: ${_loadError}`);
    console.warn("[WS] WebSocket server will be unavailable. This is normal on Vercel/serverless.");
    return null;
  }
}

/**
 * Check if ws module is available (synchronous check after load attempted)
 */
export function isWsAvailable(): boolean {
  return _wsModule !== null;
}

export function getLoadError(): string | null {
  return _loadError;
}
