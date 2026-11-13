// Thin, fail-safe wrapper around the W-Radar browser SDK (window.Radar),
// which is loaded asynchronously by the bootstrap script in index.html.
// Analytics must NEVER break the user path, so every call is guarded.

interface RadarApi {
  track?: (name: string, data?: Record<string, unknown>) => void;
  identify?: (id: string, traits?: Record<string, unknown>) => void;
}

function radar(): RadarApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Radar?: RadarApi }).Radar;
}

/** Fire a named conversion/interaction event to W-Radar (no-op if SDK not ready). */
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  try {
    radar()?.track?.(name, {
      ...data,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  } catch {
    // Telemetry delivery must never break the application path.
  }
}
