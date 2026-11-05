/**
 * True only in the end-to-end build (e2e/playwright*.config.ts sets VITE_E2E). Timer-driven UI
 * (animations, "tap again to confirm" windows, auto-hiding toasts) is made static there, because a
 * spec that races a wall-clock timer fails whenever a CI machine is slow.
 */
export const E2E_BUILD = import.meta.env.VITE_E2E === "true";
