export {};

declare global {
  interface Window {
    /** Injected by the static prerenderer so hydration matches the rendered route. */
    __APP__?: { path: string };
  }
}
