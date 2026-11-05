/** WebSocket origin: explicit VITE_WS_URL, else the API origin with its scheme swapped, else the page. */
export function resolveWsOrigin(
  wsUrl: string | undefined,
  apiUrl: string | undefined,
  page: { protocol: string; host: string },
): string {
  if (wsUrl) return wsUrl;
  if (apiUrl) return apiUrl.replace(/^http/, "ws");
  return `${page.protocol === "https:" ? "wss" : "ws"}://${page.host}`;
}

/** The WebSocket origin for this build and page. */
export const currentWsOrigin = (): string =>
  resolveWsOrigin(import.meta.env.VITE_WS_URL, import.meta.env.VITE_API_URL, window.location);
